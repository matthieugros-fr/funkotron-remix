// Réglages globaux du rendu et du monde.

export const PX = 16;                    // texels de pixel art par unité de monde
export const SIN_P = 0.75;               // caméra inclinée : une tuile fait 12 px de haut à l'écran
export const PITCH = Math.asin(SIN_P);
export const COS_P = Math.cos(PITCH);
export const SY = 1 / COS_P;             // étirement des sprites debout pour garder 1 texel = 1 pixel
export const BASE_H = 240;               // hauteur visée de l'image basse résolution

export const GAP = 12;                   // écart vertical entre deux étages
export const SIZE = 44;                  // côté de la grille d'un étage
export const LEVELS = 4;                 // étages du socle
export const SLAB = 0.375;               // épaisseur de la couche d'herbe au bord
export const WATER_Y = -0.15;            // surface des lacs
export const BASIN = 0.45;               // profondeur des lacs

// Ambiance de chaque étage ; interpolée en continu pendant les changements de niveau.
export const PALETTES = [
  { skyTop: '#0a0a2e', skyBot: '#2b2276', neb1: '#ff4fd0', neb2: '#3ad6ff', sun: '#fff1d6', hemiSky: '#d4dcff', hemiGround: '#6a4a8a', tint: '#ffffff', fog: '#2b2276' },
  { skyTop: '#04172b', skyBot: '#0f5a6e', neb1: '#3affc0', neb2: '#7a5cff', sun: '#eafff6', hemiSky: '#c8fff0', hemiGround: '#2a5a70', tint: '#f0fffa', fog: '#0f5a6e' },
  { skyTop: '#1c0522', skyBot: '#7a1f52', neb1: '#ffb03a', neb2: '#ff3a7a', sun: '#ffdcb4', hemiSky: '#ffd2e8', hemiGround: '#6a2858', tint: '#fff3ef', fog: '#7a1f52' },
  { skyTop: '#020208', skyBot: '#1c1a44', neb1: '#9a7aff', neb2: '#ffffff', sun: '#e2e8ff', hemiSky: '#d8dcff', hemiGround: '#3a3470', tint: '#f2f2ff', fog: '#1c1a44' },
];
