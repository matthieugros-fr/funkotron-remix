// Toutes les images du jeu, générées au lancement en pixel art.
import { makeCanvas, painter, spriteCanvas, nearestTex } from './pixelart.js';
import { mulberry } from './rng.js';
import { drawToeJamSheet } from './toejam.js';

// Atlas des tuiles : 16 × 16 tuiles de 16 px.
export const TILE = { GRASS: 0, FLOWER: 4, SAND: 16, ROAD: 32, LIP_GRASS: 48, LIP_SAND: 49, ROCK: 50, ROCK_DARK: 52, BASIN: 53, FLOOR: 54 };
export const ATLAS = 256;

// Atlas du décor : [x, y, largeur, hauteur] dans un canevas de 256 × 128.
export const DECOR_W = 256, DECOR_H = 128;
export const DECOR = {
  palm: [0, 0, 32, 48], bush: [32, 0, 20, 16], flowers: [52, 0, 12, 10], tuft: [64, 0, 10, 7],
  rock: [74, 0, 16, 12], blobS: [90, 0, 16, 8], blobL: [106, 0, 28, 10], bang: [134, 0, 8, 12],
  palm2: [142, 0, 32, 48],
};

const G = { base: '#4cb050', d1: '#3f9f47', d2: '#2f8a3c', l1: '#5fc35a', l2: '#79d76d' };
const SD = { base: '#ecd08f', d: '#d8b46d', l: '#f8e6b2', sh: '#c49d58' };
const DIRT = { base: '#8b5a3c', strata: '#74482f', peb: '#a8734f', dark: '#5d3925' };

function grass(p, r, flowers) {
  p.rect(0, 0, 16, 16, G.base);
  for (let k = 0; k < 70; k++) {
    const x = (r() * 16) | 0, y = (r() * 16) | 0, q = r();
    p.px(x, y, q < 0.45 ? G.d1 : q < 0.8 ? G.l1 : q < 0.92 ? G.d2 : G.l2);
  }
  for (let k = 0; k < 5; k++) {
    const x = 1 + ((r() * 14) | 0), y = 2 + ((r() * 13) | 0);
    p.px(x, y, G.d2); p.px(x - 1, y - 1, G.d2); p.px(x + 1, y - 1, G.d2);
  }
  if (flowers) {
    const cols = ['#ffe36b', '#ff8ad8', '#ffffff', '#8ad8ff'];
    for (let k = 0; k < 3; k++) {
      const x = 2 + ((r() * 12) | 0), y = 2 + ((r() * 12) | 0), c = cols[(r() * cols.length) | 0];
      p.px(x, y - 1, c); p.px(x - 1, y, c); p.px(x + 1, y, c); p.px(x, y + 1, c); p.px(x, y, '#ffb000');
    }
  }
}

function sand(p, r, mask) {
  p.rect(0, 0, 16, 16, SD.base);
  for (let k = 0; k < 40; k++) p.px((r() * 16) | 0, (r() * 16) | 0, r() < 0.5 ? SD.d : SD.l);
  if (r() < 0.3) { const x = 3 + ((r() * 9) | 0), y = 3 + ((r() * 9) | 0); p.px(x, y, '#ffffff'); p.px(x + 1, y, '#f3b6c8'); }
  const set = (side, a, b, c) => {
    if (side === 1) p.px(a, b, c); else if (side === 4) p.px(a, 15 - b, c);
    else if (side === 8) p.px(b, a, c); else p.px(15 - b, a, c);
  };
  for (const side of [1, 2, 4, 8]) {
    if (!(mask & side)) continue;
    for (let a = 0; a < 16; a++) {
      const dep = 2 + (r() < 0.5 ? 1 : 0) + (a % 5 === 0 ? 1 : 0);
      for (let b = 0; b < dep; b++) set(side, a, b, b === dep - 1 ? G.d1 : r() < 0.3 ? G.l1 : G.base);
      set(side, a, dep, SD.sh);
    }
  }
}

function road(p, r, mask) {
  grass(p, r, false);
  const m = new Uint8Array(256), on = (x, y) => (m[y * 16 + x] = 1);
  for (let y = 3; y <= 12; y++) for (let x = 3; x <= 12; x++) on(x, y);
  if (mask & 1) for (let y = 0; y < 3; y++) for (let x = 3; x <= 12; x++) on(x, y);
  if (mask & 4) for (let y = 13; y < 16; y++) for (let x = 3; x <= 12; x++) on(x, y);
  if (mask & 8) for (let x = 0; x < 3; x++) for (let y = 3; y <= 12; y++) on(x, y);
  if (mask & 2) for (let x = 13; x < 16; x++) for (let y = 3; y <= 12; y++) on(x, y);
  const isRoad = (x, y) => x < 0 || y < 0 || x > 15 || y > 15 || m[y * 16 + x];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!m[y * 16 + x]) continue;
    const edge = !isRoad(x + 1, y) || !isRoad(x - 1, y) || !isRoad(x, y + 1) || !isRoad(x, y - 1);
    const q = r();
    p.px(x, y, edge ? '#a9afc4' : q < 0.15 ? '#5d6175' : q < 0.3 ? '#7f8398' : '#6d7186');
  }
  if (mask === 5) for (const y of [1, 2, 3, 9, 10, 11]) { p.px(7, y, '#ffd23f'); p.px(8, y, '#ffd23f'); }
  if (mask === 10) for (const x of [1, 2, 3, 9, 10, 11]) { p.px(x, 7, '#ffd23f'); p.px(x, 8, '#ffd23f'); }
}

function dirt(p, r, variant) {
  p.rect(0, 0, 16, 16, DIRT.base);
  for (let y = variant ? 2 : 4; y < 16; y += 5) for (let x = 0; x < 16; x++) p.px(x, y + (r() < 0.25 ? 1 : 0), DIRT.strata);
  for (let k = 0; k < 14; k++) { const x = (r() * 15) | 0, y = (r() * 16) | 0; p.rect(x, y, 2, 1, DIRT.peb); }
  for (let k = 0; k < 12; k++) p.px((r() * 16) | 0, (r() * 16) | 0, DIRT.dark);
  if (variant) { const x = 3 + ((r() * 8) | 0), y = 6 + ((r() * 6) | 0); p.rect(x, y, 4, 3, '#9a6a48'); p.rect(x, y, 4, 1, '#b98552'); p.rect(x + 3, y + 1, 1, 2, '#6e442d'); }
}

function buildAtlas() {
  const [c, x] = makeCanvas(ATLAS, ATLAS);
  const at = (t) => painter(x, (t % 16) * 16, Math.floor(t / 16) * 16);
  const r = mulberry(4242);
  for (let k = 0; k < 4; k++) grass(at(TILE.GRASS + k), r, false);
  for (let k = 0; k < 2; k++) grass(at(TILE.FLOWER + k), r, true);
  for (let m = 0; m < 16; m++) sand(at(TILE.SAND + m), r, m);
  for (let m = 0; m < 16; m++) road(at(TILE.ROAD + m), r, m);
  {
    const p = at(TILE.LIP_GRASS); dirt(p, r, 0);
    p.rect(0, 0, 16, 2, G.base);
    for (let i = 0; i < 16; i++) {
      if (r() < 0.5) p.px(i, 0, G.l1);
      const hang = 1 + ((r() * 3) | 0);
      for (let b = 2; b < 2 + hang; b++) p.px(i, b, b === 1 + hang ? G.d2 : G.d1);
    }
  }
  {
    const p = at(TILE.LIP_SAND); dirt(p, r, 0);
    p.rect(0, 0, 16, 2, SD.base);
    for (let i = 0; i < 16; i++) { p.px(i, 2, r() < 0.6 ? SD.sh : SD.d); if (r() < 0.3) p.px(i, 3, SD.sh); }
  }
  dirt(at(TILE.ROCK), r, 0);
  dirt(at(TILE.ROCK + 1), r, 1);
  {
    const p = at(TILE.ROCK_DARK); p.rect(0, 0, 16, 16, '#3e261c');
    for (let k = 0; k < 20; k++) p.px((r() * 16) | 0, (r() * 16) | 0, '#55352a');
  }
  {
    const p = at(TILE.BASIN); p.rect(0, 0, 16, 16, '#c9a467'); p.rect(0, 0, 16, 1, '#9a7742');
    for (let k = 0; k < 20; k++) p.px((r() * 16) | 0, 1 + ((r() * 15) | 0), r() < 0.5 ? '#b08b52' : '#dabb80');
  }
  {
    const p = at(TILE.FLOOR); p.rect(0, 0, 16, 16, '#a8884f');
    for (let k = 0; k < 6; k++) { const y = (r() * 16) | 0, x = (r() * 12) | 0; p.rect(x, y, 3 + ((r() * 3) | 0), 1, '#bfa067'); }
  }
  return c;
}

function buildWater() {
  const [c, x] = makeCanvas(32, 32), p = painter(x), r = mulberry(77);
  p.rect(0, 0, 32, 32, '#2c78dc');
  for (let k = 0; k < 14; k++) {
    const y = (r() * 32) | 0, x0 = (r() * 32) | 0, len = 3 + ((r() * 4) | 0);
    for (let i = 0; i < len; i++) { p.px((x0 + i) % 32, y, '#5aa6ff'); if (i > 0 && i < len - 1) p.px((x0 + i) % 32, (y + 1) % 32, '#2569c4'); }
  }
  for (let k = 0; k < 5; k++) p.px((r() * 32) | 0, (r() * 32) | 0, '#e6f4ff');
  return c;
}

function leaf(p, cx, cy, ang, L, droop) {
  const a = (ang * Math.PI) / 180;
  for (let s = 0; s <= L; s += 0.5) {
    const t = s / L, x = cx + Math.cos(a) * s, y = cy + Math.sin(a) * s + t * t * L * droop;
    p.px(x, y, '#3fae4a');
    p.px(x, y - 1, '#69d06a');
    if (t < 0.75) p.px(x, y + 1, '#2c8a3a');
    if (t > 0.2 && Math.round(s) % 2 === 0) p.px(x, y + 2, '#2c8a3a');
  }
}

function palm(lean, angles, seed) {
  return spriteCanvas(32, 48, (p) => {
    const r = mulberry(seed);
    let topX = 15;
    for (let y = 47; y >= 15; y--) {
      const cx = 14 + Math.round(Math.sin((47 - y) / 13) * 3 * lean), ring = (47 - y) % 4 === 0;
      p.px(cx - 1, y, ring ? '#5e3d22' : '#7a5230');
      p.px(cx, y, ring ? '#6a4426' : '#9b6b3f');
      p.px(cx + 1, y, ring ? '#6a4426' : '#9b6b3f');
      p.px(cx + 2, y, ring ? '#7a5230' : '#b98552');
      topX = cx;
    }
    for (const a of angles) leaf(p, topX + 1, 14, a, 11 + r() * 3, 0.55);
    p.rect(topX - 1, 15, 2, 2, '#5a3a1e'); p.px(topX - 1, 15, '#8a5a30');
    p.rect(topX + 2, 16, 2, 2, '#5a3a1e'); p.px(topX + 2, 16, '#8a5a30');
  });
}

function buildDecor() {
  const [c, x] = makeCanvas(DECOR_W, DECOR_H);
  const put = (name, canvas) => { const [ax, ay] = DECOR[name]; x.drawImage(canvas, ax, ay); };
  put('palm', palm(1, [195, 220, 250, 290, 322, 348, 160], 3));
  put('palm2', palm(-1, [200, 235, 265, 300, 335, 15, 170], 9));
  put('bush', spriteCanvas(20, 16, (p) => {
    p.disc(6, 10, 5, '#2f8a3c'); p.disc(13, 10, 5, '#2f8a3c'); p.disc(10, 6, 5, '#2f8a3c');
    p.disc(5, 9, 3, '#3f9f47'); p.disc(12, 8, 3, '#3f9f47'); p.disc(9, 5, 3, '#4cb050');
    p.px(8, 3, '#79d76d'); p.px(11, 6, '#79d76d'); p.px(4, 8, '#79d76d'); p.px(14, 7, '#79d76d');
    p.px(6, 12, '#ff4a5c'); p.px(13, 11, '#ff4a5c'); p.px(10, 9, '#ff4a5c');
  }));
  put('flowers', spriteCanvas(12, 10, (p) => {
    p.rect(3, 4, 1, 6, '#2f8a3c'); p.rect(6, 2, 1, 8, '#2f8a3c'); p.rect(9, 5, 1, 5, '#2f8a3c');
    const fl = (x, y, c) => { p.px(x, y - 1, c); p.px(x - 1, y, c); p.px(x + 1, y, c); p.px(x, y + 1, c); p.px(x, y, '#ffb000'); };
    fl(3, 3, '#ff8ad8'); fl(6, 1, '#ffe36b'); fl(9, 4, '#ffffff');
  }));
  put('tuft', spriteCanvas(10, 7, (p) => {
    for (const [x, h, c] of [[1, 3, '#3f9f47'], [3, 5, '#5fc35a'], [5, 6, '#3f9f47'], [7, 4, '#79d76d'], [8, 3, '#2f8a3c']])
      for (let i = 0; i < h; i++) p.px(x + (i > h - 2 ? (x < 5 ? -1 : 1) : 0), 6 - i, c);
  }));
  put('rock', spriteCanvas(16, 12, (p) => {
    p.ellipse(8, 7, 6, 4, '#8a8fa6');
    p.ellipse(10, 9, 4, 2, '#5d6175');
    p.ellipse(6, 5, 3, 2, '#b8bdd0');
    p.px(9, 6, '#5d6175'); p.px(10, 7, '#5d6175');
  }));
  put('blobS', spriteCanvas(16, 8, (p) => p.ellipse(8, 4, 7, 3, '#1a1033', true), false));
  put('blobL', spriteCanvas(28, 10, (p) => p.ellipse(14, 5, 13, 4, '#1a1033', true), false));
  put('bang', spriteCanvas(8, 12, (p) => { p.rect(3, 1, 2, 7, '#ffd23f'); p.rect(3, 9, 2, 2, '#ffd23f'); }));
  return c;
}

function buildBooth() {
  const pillar = spriteCanvas(5, 44, (p) => {
    p.rect(0, 0, 5, 44, '#ffd23f'); p.rect(0, 0, 1, 44, '#ffe98a'); p.rect(4, 0, 1, 44, '#d9a520');
    for (let y = 4; y < 44; y += 8) p.px(2, y, '#8a6410');
    p.rect(0, 10, 5, 2, '#ff5fd2'); p.rect(0, 30, 5, 2, '#ff5fd2'); p.rect(0, 43, 5, 1, '#8a6410');
  }, false);
  const sign = spriteCanvas(18, 10, (p) => {
    p.rect(0, 0, 18, 10, '#ff5fd2'); p.rect(1, 1, 16, 8, '#1a1033');
    p.rect(8, 2, 2, 1, '#ffd23f'); p.rect(7, 3, 4, 1, '#ffd23f'); p.rect(6, 4, 6, 1, '#ffd23f'); p.rect(5, 5, 8, 1, '#ffd23f');
    p.rect(8, 6, 2, 2, '#ffd23f');
  }, false);
  const door = spriteCanvas(9, 34, (p) => {
    p.rect(0, 0, 9, 34, '#c9d2ea'); p.rect(0, 0, 1, 34, '#eef2ff'); p.rect(8, 0, 1, 34, '#9aa3c0');
    p.rect(0, 8, 9, 1, '#9aa3c0'); p.rect(0, 25, 9, 1, '#9aa3c0');
    p.rect(0, 16, 9, 2, '#ff5fd2'); p.rect(2, 3, 5, 3, '#6fd6ff'); p.px(2, 3, '#eef2ff');
  }, false);
  const inside = spriteCanvas(18, 34, (p) => {
    p.rect(0, 0, 18, 34, '#2a1f55');
    for (let x = 1; x < 18; x += 4) p.rect(x, 3, 1, 31, '#3c2d78');
    p.rect(4, 1, 10, 1, '#ffe680');
  }, false);
  return { pillar: nearestTex(pillar), sign: nearestTex(sign), door: nearestTex(door), inside: nearestTex(inside) };
}

export function makeAssets() {
  return {
    atlas: nearestTex(buildAtlas()),
    decor: nearestTex(buildDecor()),
    water: nearestTex(buildWater(), true),
    toejam: nearestTex(drawToeJamSheet()),
    booth: buildBooth(),
  };
}
