// Sunset Heist Cover Studio — editor wiring.
// SPDX-License-Identifier: MIT
//
// Owns the page state: the photos the user loaded, which layout and grade
// the cover wears, the caption text, and the undo history. Every change
// repaints the preview canvas at once, and the export buttons paint the same
// cover at full post size and hand it back as a PNG download.

import {
  COVER_GRADES,
  COVER_LAYOUTS,
  COVER_SIZES,
  blankPanels,
  clampPanelPan,
  drawCover,
  findLayout,
  findSize,
  layoutPanelRects,
  panelAtPoint,
} from './cover.js';
import { markShotReady, sceneFromQuery } from './shots.js';

const PREVIEW_MAX = 900;
const SAMPLE_PHOTOS = [
  { id: 'boulevard', label: 'Boulevard', src: 'samples/boulevard.jpg' },
  { id: 'pier', label: 'Pier', src: 'samples/pier.jpg' },
];

const $ = (id) => document.getElementById(id);

function freshState() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    size: '1080x1080',
    caption: 'SUNSET HEIST',
    subtitle: 'neon coast nights',
    badge: 'NEON COAST',
    stars: 5,
    photos: [],
    panels: blankPanels(findLayout('hero3').panels),
    selectedPanel: 0,
  };
}

function serialiseState(state) {
  return JSON.stringify({
    layout: state.layout,
    grade: state.grade,
    size: state.size,
    caption: state.caption,
    subtitle: state.subtitle,
    badge: state.badge,
    stars: state.stars,
    panels: state.panels,
    selectedPanel: state.selectedPanel,
    photoNames: state.photos.map((photo) => photo.name),
  });
}

function stateFromSnapshot(state, snapshot) {
  const data = JSON.parse(snapshot);
  state.layout = data.layout;
  state.grade = data.grade;
  state.size = data.size;
  state.caption = data.caption;
  state.subtitle = data.subtitle;
  state.badge = data.badge;
  state.stars = data.stars;
  state.panels = data.panels.map((panel) => clampPanelPan(panel));
  state.selectedPanel = data.selectedPanel;
}

class CoverEditor {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = freshState();
    this.history = [];
    this.future = [];
    this.dragging = null;
    this.images = [];
    this.paintCount = 0;
  }

  remember() {
    this.history.push(serialiseState(this.state));
    if (this.history.length > 60) this.history.shift();
    this.future = [];
    this.syncUndoButtons();
  }

  undo() {
    if (this.history.length === 0) return;
    this.future.push(serialiseState(this.state));
    stateFromSnapshot(this.state, this.history.pop());
    this.syncUndoButtons();
    this.syncControls();
    this.paint();
  }

  redo() {
    if (this.future.length === 0) return;
    this.history.push(serialiseState(this.state));
    stateFromSnapshot(this.state, this.future.pop());
    this.syncUndoButtons();
    this.syncControls();
    this.paint();
  }

  syncUndoButtons() {
    const undoButton = $('undoButton');
    const redoButton = $('redoButton');
    if (undoButton) undoButton.disabled = this.history.length === 0;
    if (redoButton) redoButton.disabled = this.future.length === 0;
  }

  // Keep the panel list the size the layout needs, reusing old panels.
  adoptLayout(layoutId) {
    const wanted = findLayout(layoutId).panels;
    const kept = this.state.panels.slice(0, wanted);
    while (kept.length < wanted) kept.push({ photo: 0, zoom: 1, dx: 0, dy: 0 });
    this.state.panels = kept;
    this.state.selectedPanel = 0;
  }

  addPhoto(name, image) {
    this.images.push(image);
    this.state.photos.push({ name });
    this.state.panels.forEach((panel) => {
      if (panel.photo >= this.images.length) panel.photo = this.images.length - 1;
    });
    this.renderPhotoStrip();
  }

  loadSample(sampleId) {
    const sample = SAMPLE_PHOTOS.find((entry) => entry.id === sampleId);
    if (!sample) return Promise.resolve(false);
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        this.remember();
        this.addPhoto(sample.label, image);
        this.paint();
        resolve(true);
      };
      image.onerror = () => resolve(false);
      image.src = sample.src;
    });
  }

  loadUserFiles(fileList) {
    const files = [...fileList].filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;
    this.remember();
    let pending = files.length;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          this.addPhoto(file.name, image);
          pending -= 1;
          if (pending === 0) this.paint();
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  applyPhotoToSelected(photoIndex) {
    if (photoIndex < 0 || photoIndex >= this.images.length) return;
    this.remember();
    this.state.panels[this.state.selectedPanel].photo = photoIndex;
    this.paint();
    this.renderPhotoStrip();
  }

  fillEveryPanel(photoIndex) {
    if (photoIndex < 0 || photoIndex >= this.images.length) return;
    this.remember();
    this.state.panels.forEach((panel) => {
      panel.photo = photoIndex;
    });
    this.paint();
    this.renderPhotoStrip();
  }

  paint() {
    const size = findSize(this.state.size);
    const shot = new URLSearchParams(window.location.search).get('shot');
    let width = size.width;
    let height = size.height;
    if (shot === 'cover') {
      width = window.innerWidth;
      height = window.innerHeight;
    } else {
      const scale = Math.min(1, PREVIEW_MAX / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    drawCover(this.ctx, width, height, this.state, this.images);
    this.paintCount += 1;
    this.drawSelectionOutline(width, height);
    const status = $('statusLine');
    if (status && shot !== 'cover') {
      status.textContent = `Preview ${size.width} × ${size.height} · ${findLayout(this.state.layout).label} · panel ${this.state.selectedPanel + 1} of ${this.state.panels.length} selected`;
    }
  }

  drawSelectionOutline(width, height) {
    const shot = new URLSearchParams(window.location.search).get('shot');
    if (shot === 'cover') return;
    const index = this.state.selectedPanel;
    if (index < 0 || index >= this.state.panels.length) return;
    const frame = Math.round(width * 0.028);
    const gutter = Math.round(width * 0.012);
    const bandH = Math.round(height * 0.17);
    const innerX = frame;
    const innerY = frame;
    const innerW = width - frame * 2;
    const innerH = height - frame * 2 - bandH - gutter;
    const f = layoutPanelRects(this.state.layout)[index];
    if (!f) return;
    this.ctx.save();
    this.ctx.strokeStyle = '#ff2e88';
    this.ctx.lineWidth = Math.max(2, width * 0.006);
    this.ctx.setLineDash([Math.round(width * 0.012), Math.round(width * 0.008)]);
    this.ctx.strokeRect(
      innerX + f.x * innerW,
      innerY + f.y * innerH,
      f.w * innerW,
      f.h * innerH,
    );
    this.ctx.restore();
  }

  renderPhotoStrip() {
    const strip = $('photoStrip');
    if (!strip) return;
    strip.innerHTML = '';
    this.state.photos.forEach((photo, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'photo-chip';
      button.textContent = `${index + 1} · ${photo.name}`;
      const panel = this.state.panels[this.state.selectedPanel];
      if (panel && panel.photo === index) button.classList.add('active');
      button.addEventListener('click', () => this.applyPhotoToSelected(index));
      strip.appendChild(button);
    });
    const fillButton = $('fillAllButton');
    if (fillButton) {
      fillButton.disabled = this.images.length === 0;
    }
  }

  syncControls() {
    const captionInput = $('captionInput');
    if (captionInput) captionInput.value = this.state.caption;
    const subtitleInput = $('subtitleInput');
    if (subtitleInput) subtitleInput.value = this.state.subtitle;
    const badgeInput = $('badgeInput');
    if (badgeInput) badgeInput.value = this.state.badge;
    const starsInput = $('starsInput');
    if (starsInput) starsInput.value = String(this.state.stars);
    const sizeSelect = $('sizeSelect');
    if (sizeSelect) sizeSelect.value = this.state.size;
    document.querySelectorAll('[data-layout]').forEach((button) => {
      button.classList.toggle('active', button.dataset.layout === this.state.layout);
    });
    document.querySelectorAll('[data-grade]').forEach((button) => {
      button.classList.toggle('active', button.dataset.grade === this.state.grade);
    });
    this.renderPhotoStrip();
  }

  exportPng(sizeId) {
    const size = findSize(sizeId);
    const offscreen = document.createElement('canvas');
    offscreen.width = size.width;
    offscreen.height = size.height;
    const offCtx = offscreen.getContext('2d');
    drawCover(offCtx, size.width, size.height, this.state, this.images);
    return new Promise((resolve, reject) => {
      offscreen.toBlob((blob) => {
        if (!blob) {
          reject(new Error('export produced no image'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    });
  }

  downloadExport(sizeId) {
    const size = findSize(sizeId);
    this.exportPng(sizeId)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sunset-heist-${size.width}x${size.height}.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
        const status = $('statusLine');
        if (status) status.textContent = `Exported ${size.width} × ${size.height} PNG`;
      })
      .catch(() => {
        const status = $('statusLine');
        if (status) status.textContent = 'Export failed — try again';
      });
  }

  bindPointer() {
    this.canvas.addEventListener('pointerdown', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
      const py = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
      const hit = panelAtPoint(this.canvas.width, this.canvas.height, this.state.layout, px, py);
      if (hit < 0) return;
      this.state.selectedPanel = hit;
      this.dragging = { x: px, y: py, moved: false };
      this.canvas.setPointerCapture(event.pointerId);
      this.paint();
      this.renderPhotoStrip();
    });
    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.dragging) return;
      const rect = this.canvas.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
      const py = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
      const panel = this.state.panels[this.state.selectedPanel];
      if (!panel) return;
      const rects = layoutPanelRects(this.state.layout);
      const f = rects[this.state.selectedPanel];
      const frame = Math.round(this.canvas.width * 0.028);
      const bandH = Math.round(this.canvas.height * 0.17);
      const innerW = this.canvas.width - frame * 2;
      const innerH = this.canvas.height - frame * 2 - bandH - Math.round(this.canvas.width * 0.012);
      const dx = ((px - this.dragging.x) / (f.w * innerW)) * 0.5;
      const dy = ((py - this.dragging.y) / (f.h * innerH)) * 0.5;
      if (Math.abs(px - this.dragging.x) + Math.abs(py - this.dragging.y) > 2) {
        if (!this.dragging.moved) {
          this.remember();
          this.dragging.moved = true;
        }
        this.state.panels[this.state.selectedPanel] = clampPanelPan({
          ...panel,
          dx: panel.dx + dx,
          dy: panel.dy + dy,
        });
        this.dragging.x = px;
        this.dragging.y = py;
        this.paint();
      }
    });
    const endDrag = () => {
      this.dragging = null;
    };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const panel = this.state.panels[this.state.selectedPanel];
      if (!panel) return;
      if (!this._wheelRemembered) {
        this.remember();
        this._wheelRemembered = true;
        window.setTimeout(() => {
          this._wheelRemembered = false;
        }, 600);
      }
      const step = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      this.state.panels[this.state.selectedPanel] = clampPanelPan({
        ...panel,
        zoom: panel.zoom * step,
      });
      this.paint();
    }, { passive: false });
  }
}

function buildControlButtons(container, items, key, onPick) {
  if (!container) return;
  container.innerHTML = '';
  items.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button';
    button.dataset[key] = item.id;
    button.textContent = item.label;
    button.addEventListener('click', () => onPick(item.id));
    container.appendChild(button);
  });
}

async function boot() {
  const canvas = $('coverCanvas');
  const editor = new CoverEditor(canvas);
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const scene = sceneFromQuery(window.location.search);

  await Promise.all([
    document.fonts.load('40px Anton'),
    document.fonts.load('40px Pacifico'),
    document.fonts.ready,
  ]).catch(() => undefined);

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    editor.state.layout = scene.layout;
    editor.state.grade = scene.grade;
    editor.state.caption = scene.caption;
    editor.state.subtitle = scene.subtitle;
    editor.state.badge = scene.badge;
    editor.state.stars = scene.stars;
    editor.adoptLayout(scene.layout);
    await editor.loadSample(scene.photo);
    const other = SAMPLE_PHOTOS.find((entry) => entry.id !== scene.photo);
    if (other) await editor.loadSample(other.id);
    editor.state.panels.forEach((panel, index) => {
      panel.photo = index % editor.images.length;
      if (scene.pans && scene.pans[index]) {
        panel.dx = scene.pans[index].dx || 0;
        panel.dy = scene.pans[index].dy || 0;
        panel.zoom = scene.pans[index].zoom || 1;
      }
    });
    editor.paint();
    markShotReady();
    window.__sunsetHeist = editor;
    return;
  }

  buildControlButtons($('layoutButtons'), COVER_LAYOUTS, 'layout', (id) => {
    editor.remember();
    editor.state.layout = id;
    editor.adoptLayout(id);
    editor.syncControls();
    editor.paint();
  });
  buildControlButtons($('gradeButtons'), COVER_GRADES, 'grade', (id) => {
    editor.remember();
    editor.state.grade = id;
    editor.syncControls();
    editor.paint();
  });

  const sizeSelect = $('sizeSelect');
  if (sizeSelect) {
    COVER_SIZES.forEach((size) => {
      const option = document.createElement('option');
      option.value = size.id;
      option.textContent = size.label;
      sizeSelect.appendChild(option);
    });
    sizeSelect.value = editor.state.size;
    sizeSelect.addEventListener('change', () => {
      editor.remember();
      editor.state.size = sizeSelect.value;
      editor.paint();
    });
  }

  $('captionInput')?.addEventListener('input', (event) => {
    editor.state.caption = event.target.value;
    editor.paint();
  });
  $('subtitleInput')?.addEventListener('input', (event) => {
    editor.state.subtitle = event.target.value;
    editor.paint();
  });
  $('badgeInput')?.addEventListener('input', (event) => {
    editor.state.badge = event.target.value;
    editor.paint();
  });
  $('starsInput')?.addEventListener('input', (event) => {
    editor.state.stars = Number(event.target.value) || 0;
    editor.paint();
  });
  $('captionInput')?.addEventListener('change', () => editor.remember());
  $('subtitleInput')?.addEventListener('change', () => editor.remember());

  $('undoButton')?.addEventListener('click', () => editor.undo());
  $('redoButton')?.addEventListener('click', () => editor.redo());
  $('fillAllButton')?.addEventListener('click', () => {
    const panel = editor.state.panels[editor.state.selectedPanel];
    if (panel) editor.fillEveryPanel(panel.photo);
  });

  document.querySelectorAll('[data-export]').forEach((button) => {
    button.addEventListener('click', () => editor.downloadExport(button.dataset.export));
  });

  document.querySelectorAll('[data-sample]').forEach((button) => {
    button.addEventListener('click', () => editor.loadSample(button.dataset.sample));
  });

  const fileInput = $('photoInput');
  fileInput?.addEventListener('change', (event) => {
    editor.loadUserFiles(event.target.files);
    event.target.value = '';
  });

  editor.bindPointer();

  if (shot === 'editor') {
    document.body.classList.add('shot-editor');
    editor.state.layout = scene.layout;
    editor.state.grade = scene.grade;
    editor.state.caption = scene.caption;
    editor.state.subtitle = scene.subtitle;
    editor.state.badge = scene.badge;
    editor.state.stars = scene.stars;
    editor.adoptLayout(scene.layout);
    await editor.loadSample(scene.photo);
    const other = SAMPLE_PHOTOS.find((entry) => entry.id !== scene.photo);
    if (other) await editor.loadSample(other.id);
    editor.state.panels.forEach((panel, index) => {
      panel.photo = index % editor.images.length;
    });
  } else {
    await editor.loadSample('pier');
  }

  editor.syncControls();
  editor.paint();
  markShotReady();
  window.__sunsetHeist = editor;
}

boot();
