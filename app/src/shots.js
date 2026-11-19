// Sunset Heist Cover Studio — fixed screenshot scenes.
// SPDX-License-Identifier: MIT
//
// Each scene names one photographed moment the maker captures: which sample
// photo fills the panels, which layout and grade the cover wears, and what
// the caption says. The editor reads these from the page address so the
// screenshots always show a real render of the app, never a mock-up.

export const SHOT_SCENES = {
  cover: {
    photo: 'pier',
    layout: 'hero3',
    grade: 'sunset',
    caption: 'SUNSET HEIST',
    subtitle: 'neon coast nights',
    badge: 'NEON COAST',
    stars: 5,
    // Nudge each small side panel up so faces stay in frame.
    pans: [
      { dx: 0, dy: 0, zoom: 1 },
      { dx: 0, dy: -0.16, zoom: 1 },
      { dx: 0, dy: -0.2, zoom: 1 },
      { dx: 0, dy: -0.16, zoom: 1 },
    ],
  },
  coverSquare: {
    photo: 'boulevard',
    layout: 'grid4',
    grade: 'neon',
    caption: 'BOULEVARD QUEEN',
    subtitle: 'midnight in vice',
    badge: 'VICE NIGHTS',
    stars: 4,
  },
  coverPortrait: {
    photo: 'pier',
    layout: 'tilted',
    grade: 'golden',
    caption: 'PIER PRESSURE',
    subtitle: 'golden hour gang',
    badge: 'GOLDEN HOUR',
    stars: 5,
  },
  editor: {
    photo: 'boulevard',
    layout: 'grid4',
    grade: 'sunset',
    caption: 'BOULEVARD QUEEN',
    subtitle: 'midnight in vice',
    badge: 'VICE NIGHTS',
    stars: 4,
  },
};

export function sceneFromQuery(query) {
  const params = new URLSearchParams(query);
  const sceneName = params.get('scene') || 'cover';
  const base = SHOT_SCENES[sceneName] ?? SHOT_SCENES.cover;
  const scene = { ...base };
  if (params.get('photo')) scene.photo = params.get('photo');
  if (params.get('layout')) scene.layout = params.get('layout');
  if (params.get('grade')) scene.grade = params.get('grade');
  if (params.get('caption')) scene.caption = params.get('caption');
  if (params.get('subtitle')) scene.subtitle = params.get('subtitle');
  if (params.get('badge')) scene.badge = params.get('badge');
  if (params.get('stars')) scene.stars = Number(params.get('stars')) || scene.stars;
  return scene;
}

// A shot is done when the page has painted its cover at least once and the
// display fonts have arrived; the capture script waits on this flag.
export function markShotReady() {
  window.__shotReady = true;
}
