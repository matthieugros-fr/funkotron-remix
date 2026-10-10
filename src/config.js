// Réglages globaux du rendu et du monde.

export const BASE_H = 480;               // lignes de l'image 3D pixélisée (comme Petit Potager)
export const VIEW_H = 19;                // hauteur de vue en unités de monde (molette : zoom)
export const PITCH = (40 * Math.PI) / 180;

export const GAP = 12;                   // écart vertical entre deux étages
export const SIZE = 44;                  // côté de la grille d'un étage
export const LEVELS = 4;                 // étages du socle
export const WATER_Y = -0.16;            // surface des lacs
export const BASIN = 0.5;                // profondeur des lacs

// Ambiance de chaque étage ; interpolée en continu pendant les changements de niveau.
export const PALETTES = [
  { skyTop: '#0a0a2e', skyBot: '#2b2276', neb1: '#ff4fd0', neb2: '#3ad6ff', sun: '#fff1d6', hemiSky: '#c9d6ff', hemiGround: '#5a3f7a', tint: '#ffffff', fog: '#2b2276' },
  { skyTop: '#04172b', skyBot: '#0f5a6e', neb1: '#3affc0', neb2: '#7a5cff', sun: '#eafff6', hemiSky: '#c0fff0', hemiGround: '#2a5a70', tint: '#f0fffa', fog: '#0f5a6e' },
  { skyTop: '#1c0522', skyBot: '#7a1f52', neb1: '#ffb03a', neb2: '#ff3a7a', sun: '#ffd7a8', hemiSky: '#ffd2e8', hemiGround: '#6a2858', tint: '#fff3ef', fog: '#7a1f52' },
  { skyTop: '#020208', skyBot: '#1c1a44', neb1: '#9a7aff', neb2: '#ffffff', sun: '#e2e8ff', hemiSky: '#d8dcff', hemiGround: '#3a3470', tint: '#f2f2ff', fog: '#1c1a44' },
];
