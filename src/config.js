// Réglages globaux du rendu et du monde.

export const BASE_H = 480;               // lignes de l'image 3D pixélisée (comme Petit Potager)
export const VIEW_H = 19;                // hauteur de vue en unités de monde (molette : zoom)
export const PITCH = (40 * Math.PI) / 180;

export const GAP = 12;                   // écart vertical entre deux étages
export const SIZE = 96;                  // côté de la grille d'un étage (l'original : une dizaine d'écrans de large)
export const FOG_R = 15;                 // brouillard : on ne voit le terrain qu'à 15 cases autour de soi (ce qu'on a vu reste visible)
export const BLOCK = 8;                  // la carte se découvre par cases de 8 × 8 (comme les carrés de l'original)
export const LEVELS = 25;                // comme l'original
export const WATER_Y = -0.16;            // surface des lacs
export const BASIN = 0.5;                // profondeur des lacs

// Ambiance des étages : quelques étapes clés, interpolées pour les 25 niveaux, puis en continu
// pendant les changements de niveau. On part du violet, on finit dans le noir du trou noir.
const KEYS = [
  { at: 0, skyTop: '#0a0a2e', skyBot: '#2b2276', neb1: '#ff4fd0', neb2: '#3ad6ff', sun: '#fff1d6', hemiSky: '#c9d6ff', hemiGround: '#5a3f7a', fog: '#2b2276' },
  { at: 5, skyTop: '#04172b', skyBot: '#0f5a6e', neb1: '#3affc0', neb2: '#7a5cff', sun: '#eafff6', hemiSky: '#c0fff0', hemiGround: '#2a5a70', fog: '#0f5a6e' },
  { at: 10, skyTop: '#1c0522', skyBot: '#7a1f52', neb1: '#ffb03a', neb2: '#ff3a7a', sun: '#ffd7a8', hemiSky: '#ffd2e8', hemiGround: '#6a2858', fog: '#7a1f52' },
  { at: 15, skyTop: '#021a14', skyBot: '#0d4a3a', neb1: '#7aff9a', neb2: '#ffe66a', sun: '#f0ffe0', hemiSky: '#d0ffe0', hemiGround: '#2a5a40', fog: '#0d4a3a' },
  { at: 20, skyTop: '#1a0606', skyBot: '#5a1a1a', neb1: '#ff8a3a', neb2: '#ffd06a', sun: '#ffe0c0', hemiSky: '#ffd8c8', hemiGround: '#5a2a2a', fog: '#5a1a1a' },
  { at: 24, skyTop: '#020208', skyBot: '#1c1a44', neb1: '#9a7aff', neb2: '#ffffff', sun: '#e2e8ff', hemiSky: '#d8dcff', hemiGround: '#3a3470', fog: '#1c1a44' },
];
export const PAL_KEYS = Object.keys(KEYS[0]).filter((k) => k !== 'at');
export const KEYFRAMES = KEYS;
