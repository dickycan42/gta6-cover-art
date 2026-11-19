// Sunset Heist Cover Studio — cover renderer.
// SPDX-License-Identifier: MIT
//
// Draws the whole poster on a 2D canvas: a white-framed set of photo panels,
// a colour grade washed over every panel, a halftone title band with a bold
// display caption and a glowing script subtitle, plus grain and a vignette.
// Nothing here touches the network; every photo is drawn from an Image the
// editor loaded from the user's own machine.

export const COVER_LAYOUTS = [
  { id: 'grid4', label: 'Four panels', panels: 4 },
  { id: 'hero3', label: 'Hero and three', panels: 4 },
  { id: 'full', label: 'Full bleed', panels: 1 },
  { id: 'nine', label: 'Nine panels', panels: 9 },
  { id: 'tilted', label: 'Tilted snapshots', panels: 3 },
];

export const COVER_GRADES = [
  {
    id: 'sunset',
    label: 'Sunset',
    stops: ['#ff9a3c', '#ff5e78', '#c86bff'],
    tint: '#ff7a45',
    ink: '#1c1030',
  },
  {
    id: 'neon',
    label: 'Neon night',
    stops: ['#ff2e88', '#7b2eff', '#00e5c7'],
    tint: '#ff2e88',
    ink: '#0d0a2e',
  },
  {
    id: 'golden',
    label: 'Golden hour',
    stops: ['#ffd166', '#ff8c42', '#b5651d'],
    tint: '#ffb347',
    ink: '#2b1a05',
  },
  {
    id: 'violet',
    label: 'Violet dusk',
    stops: ['#b388ff', '#ff6ec7', '#3d2b8f'],
    tint: '#9d6bff',
    ink: '#160b33',
  },
  {
    id: 'teal',
    label: 'Teal coast',
    stops: ['#2ee6c8', '#2e9bff', '#123a6b'],
    tint: '#2ee6c8',
    ink: '#06222e',
  },
];

export const COVER_SIZES = [
  { id: '1080x1080', label: 'Square · 1080 × 1080', width: 1080, height: 1080 },
  { id: '1080x1350', label: 'Portrait · 1080 × 1350', width: 1080, height: 1350 },
  { id: '1920x1080', label: 'Wide · 1920 × 1080', width: 1920, height: 1080 },
];

export function findLayout(layoutId) {
  return COVER_LAYOUTS.find((entry) => entry.id === layoutId) ?? COVER_LAYOUTS[0];
}

export function findGrade(gradeId) {
  return COVER_GRADES.find((entry) => entry.id === gradeId) ?? COVER_GRADES[0];
}

export function findSize(sizeId) {
  return COVER_SIZES.find((entry) => entry.id === sizeId) ?? COVER_SIZES[0];
}

// Panel rectangles for one layout, as fractions of the inner photo area.
// Every rect is { x, y, w, h, tilt } in 0..1 coordinates.
export function layoutPanelRects(layoutId) {
  switch (layoutId) {
    case 'hero3':
      return [
        { x: 0, y: 0, w: 0.6, h: 1, tilt: 0 },
        { x: 0.6, y: 0, w: 0.4, h: 0.34, tilt: 0 },
        { x: 0.6, y: 0.34, w: 0.4, h: 0.33, tilt: 0 },
        { x: 0.6, y: 0.67, w: 0.4, h: 0.33, tilt: 0 },
      ];
    case 'full':
      return [{ x: 0, y: 0, w: 1, h: 1, tilt: 0 }];
    case 'nine':
      return Array.from({ length: 9 }, (_, index) => ({
        x: (index % 3) / 3,
        y: Math.floor(index / 3) / 3,
        w: 1 / 3,
        h: 1 / 3,
        tilt: 0,
      }));
    case 'tilted':
      return [
        { x: 0.02, y: 0.02, w: 0.58, h: 0.96, tilt: -0.035 },
        { x: 0.6, y: 0.05, w: 0.38, h: 0.44, tilt: 0.05 },
        { x: 0.62, y: 0.52, w: 0.36, h: 0.43, tilt: -0.045 },
      ];
    case 'grid4':
    default:
      return [
        { x: 0, y: 0, w: 0.5, h: 0.5, tilt: 0 },
        { x: 0.5, y: 0, w: 0.5, h: 0.5, tilt: 0 },
        { x: 0, y: 0.5, w: 0.5, h: 0.5, tilt: 0 },
        { x: 0.5, y: 0.5, w: 0.5, h: 0.5, tilt: 0 },
      ];
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

// Draw one photo so it covers its panel, honouring the user's pan and zoom.
function drawPanelPhoto(ctx, image, rect, pan) {
  const base = Math.max(rect.w / image.naturalWidth, rect.h / image.naturalHeight);
  const scale = base * (pan.zoom || 1);
  const drawnW = image.naturalWidth * scale;
  const drawnH = image.naturalHeight * scale;
  const centreX = rect.x + rect.w / 2 + (pan.dx || 0) * rect.w;
  const centreY = rect.y + rect.h / 2 + (pan.dy || 0) * rect.h;
  ctx.drawImage(image, centreX - drawnW / 2, centreY - drawnH / 2, drawnW, drawnH);
}

// Wash a sunset or neon gradient over a panel so the photos share one mood.
function washGradeOverPanel(ctx, rect, grade) {
  const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  gradient.addColorStop(0, grade.stops[0]);
  gradient.addColorStop(0.55, grade.stops[1]);
  gradient.addColorStop(1, grade.stops[2]);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = gradient;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = grade.tint;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

// A soft dark edge so the white frame and title band sit on the photo.
function drawPanelVignette(ctx, rect) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.max(rect.w, rect.h) * 0.75;
  const shade = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = shade;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

function drawHalftoneDots(ctx, x, y, w, h, gap, colour) {
  ctx.save();
  ctx.fillStyle = colour;
  for (let row = 0; row * gap < h; row += 1) {
    for (let col = 0; col * gap < w; col += 1) {
      const radius = 1 + ((row + col) % 3) * 0.45;
      ctx.beginPath();
      ctx.arc(x + col * gap + gap / 2, y + row * gap + gap / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawStar(ctx, cx, cy, outer, inner, fill) {
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const px = cx + radius * Math.cos(angle);
    const py = cy + radius * Math.sin(angle);
    if (point === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawStarMeter(ctx, x, y, size, filled, colour) {
  for (let index = 0; index < 5; index += 1) {
    const cx = x + index * size * 1.25 + size / 2;
    drawStar(ctx, cx, y + size / 2, size / 2, size / 4.5, index < filled ? colour : 'rgba(0,0,0,0.14)');
    if (index >= filled) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(1, size * 0.06);
      ctx.stroke();
    }
  }
}

function drawBadgeRibbon(ctx, x, y, w, h, text, grade) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-0.06);
  ctx.fillStyle = grade.stops[1];
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, h * 0.08);
  const pad = h * 0.32;
  ctx.beginPath();
  ctx.moveTo(-w / 2 - pad, -h / 2);
  ctx.lineTo(w / 2 + pad, -h / 2);
  ctx.lineTo(w / 2, 0);
  ctx.lineTo(w / 2 + pad, h / 2);
  ctx.lineTo(-w / 2 - pad, h / 2);
  ctx.lineTo(-w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.round(h * 0.52)}px Anton, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 0, h * 0.04);
  ctx.restore();
}

// Stroke a panel's edge in white. A tilted panel is stroked in its own
// rotated space, so the stroke follows the tilt and hides the photo edge;
// an unrotated stroke would leave a sliver of photo peeking past it.
function strokePanelEdge(ctx, rect, gutter, tilt) {
  ctx.save();
  if (tilt) {
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate(tilt);
    ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = gutter;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

// Shrink the caption until it fits the title band, then letter it.
// rightReserve keeps the lettering clear of the star meter at the top right.
function drawPosterCaption(ctx, band, caption, subtitle, grade, rightReserve) {
  const pad = band.w * 0.035;
  const available = band.w - pad * 2 - (rightReserve || 0);
  let size = band.h * 0.58;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  while (size > 12) {
    ctx.font = `${Math.round(size)}px Anton, 'Arial Black', sans-serif`;
    if (ctx.measureText(caption.toUpperCase()).width <= available) break;
    size *= 0.94;
  }
  const captionY = subtitle ? band.y + band.h * 0.42 : band.y + band.h * 0.52;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = grade.ink;
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeText(caption.toUpperCase(), band.x + pad, captionY);
  const shine = ctx.createLinearGradient(band.x, band.y, band.x, band.y + band.h);
  shine.addColorStop(0, '#ffffff');
  shine.addColorStop(0.5, grade.stops[0]);
  shine.addColorStop(1, grade.stops[1]);
  ctx.fillStyle = shine;
  ctx.fillText(caption.toUpperCase(), band.x + pad, captionY);
  ctx.restore();

  if (subtitle) {
    const scriptSize = Math.max(14, band.h * 0.24);
    ctx.save();
    ctx.font = `${Math.round(scriptSize)}px Pacifico, cursive`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = grade.stops[1];
    ctx.shadowBlur = scriptSize * 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(subtitle, band.x + pad, band.y + band.h * 0.82);
    ctx.restore();
  }
  return size;
}

let grainTile = null;
function grainPattern(ctx) {
  if (grainTile) return grainTile;
  const tile = document.createElement('canvas');
  tile.width = 140;
  tile.height = 140;
  const tctx = tile.getContext('2d');
  const pixels = tctx.createImageData(140, 140);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value = Math.floor(Math.random() * 255);
    pixels.data[i] = value;
    pixels.data[i + 1] = value;
    pixels.data[i + 2] = value;
    pixels.data[i + 3] = 28;
  }
  tctx.putImageData(pixels, 0, 0);
  grainTile = ctx.createPattern(tile, 'repeat');
  return grainTile;
}

// The one entry point: paint the full cover for a state object.
// state: { layout, grade, caption, subtitle, badge, stars, panels: [{photo, zoom, dx, dy}] }
// photos: array of HTMLImageElement, indexed by panel.photo.
export function drawCover(ctx, width, height, state, photos) {
  const grade = findGrade(state.grade);
  const frame = Math.round(width * 0.028);
  const gutter = Math.round(width * 0.012);
  const bandH = Math.round(height * 0.17);
  const innerX = frame;
  const innerY = frame;
  const innerW = width - frame * 2;
  const innerH = height - frame * 2 - bandH - gutter;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const rects = layoutPanelRects(state.layout);
  rects.forEach((fraction, index) => {
    const panel = state.panels[index] ?? { photo: 0, zoom: 1, dx: 0, dy: 0 };
    const image = photos[panel.photo];
    const rect = {
      x: innerX + fraction.x * innerW,
      y: innerY + fraction.y * innerH,
      w: fraction.w * innerW,
      h: fraction.h * innerH,
    };
    ctx.save();
    if (fraction.tilt) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(fraction.tilt);
      ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
    }
    // A white snapshot border around each tilted panel.
    if (fraction.tilt) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rect.x - gutter, rect.y - gutter, rect.w + gutter * 2, rect.h + gutter * 2);
    }
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (image && image.naturalWidth > 0) {
      drawPanelPhoto(ctx, image, rect, panel);
    } else {
      const fallback = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      fallback.addColorStop(0, grade.stops[0]);
      fallback.addColorStop(1, grade.stops[2]);
      ctx.fillStyle = fallback;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    washGradeOverPanel(ctx, rect, grade);
    drawPanelVignette(ctx, rect);
    ctx.restore();
    // Crisp white gutter lines between panels, following each panel's tilt.
    strokePanelEdge(ctx, rect, gutter, fraction.tilt);
  });

  // Title band with halftone texture, caption, script subtitle, stars, ribbon.
  const band = { x: frame, y: height - frame - bandH, w: innerW, h: bandH };
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(band.x, band.y, band.w, band.h);
  drawHalftoneDots(ctx, band.x, band.y, band.w, band.h * 0.22, Math.max(7, width * 0.008), 'rgba(0,0,0,0.10)');
  drawHalftoneDots(ctx, band.x, band.y + band.h * 0.8, band.w, band.h * 0.2, Math.max(7, width * 0.008), grade.stops[1] + '33');
  ctx.fillStyle = grade.ink;
  ctx.fillRect(band.x, band.y, band.w, Math.max(3, height * 0.004));

  const starSize = Math.round(band.h * 0.2);
  drawStarMeter(ctx, band.x + band.w - starSize * 6.4, band.y + band.h * 0.16, starSize, state.stars ?? 4, grade.stops[1]);

  // The caption must stop short of the star meter, or a long title runs over it.
  drawPosterCaption(ctx, band, state.caption || 'SUNSET HEIST', state.subtitle || '', grade, starSize * 6.6);

  const ribbonW = Math.min(band.w * 0.34, width * 0.3);
  const ribbonH = Math.round(band.h * 0.26);
  drawBadgeRibbon(
    ctx,
    band.x + band.w - ribbonW - band.w * 0.02,
    band.y + band.h - ribbonH - band.h * 0.14,
    ribbonW,
    ribbonH,
    state.badge || 'NEON COAST',
    grade,
  );

  // Film grain and a final vignette over the whole poster.
  const pattern = grainPattern(ctx);
  if (pattern) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  const edge = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.42,
    width / 2, height / 2, Math.max(width, height) * 0.72,
  );
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, width, height);
}

// Find which panel a point (in canvas pixels) lands in, or -1.
export function panelAtPoint(width, height, layoutId, px, py) {
  const frame = Math.round(width * 0.028);
  const gutter = Math.round(width * 0.012);
  const bandH = Math.round(height * 0.17);
  const innerX = frame;
  const innerY = frame;
  const innerW = width - frame * 2;
  const innerH = height - frame * 2 - bandH - gutter;
  const rects = layoutPanelRects(layoutId);
  for (let index = rects.length - 1; index >= 0; index -= 1) {
    const f = rects[index];
    const rect = {
      x: innerX + f.x * innerW,
      y: innerY + f.y * innerH,
      w: f.w * innerW,
      h: f.h * innerH,
    };
    if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) {
      return index;
    }
  }
  return -1;
}

export function clampPanelPan(pan) {
  const span = 0.45;
  return {
    photo: pan.photo ?? 0,
    zoom: Math.max(1, Math.min(4, pan.zoom || 1)),
    dx: Math.max(-span, Math.min(span, pan.dx || 0)),
    dy: Math.max(-span, Math.min(span, pan.dy || 0)),
  };
}

export function blankPanels(count) {
  return Array.from({ length: count }, () => ({ photo: 0, zoom: 1, dx: 0, dy: 0 }));
}
