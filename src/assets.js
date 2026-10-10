// Les quelques images du jeu 3D, générées au lancement.
import * as THREE from 'three';
import { makeCanvas, painter, spriteCanvas, nearestTex } from './pixelart.js';
import { mulberry } from './rng.js';

// Grain de matière en niveaux de gris, raccordable dans les deux sens.
function buildDetail() {
  const S = 64, [c, x] = makeCanvas(S, S), r = mulberry(91);
  const img = x.createImageData(S, S), v = new Float32Array(S * S).fill(0.5);
  for (let k = 0; k < 260; k++) {
    const cx = r() * S, cy = r() * S, rad = 1 + r() * 3.5, amp = (r() - 0.5) * 0.35;
    for (let y = -5; y <= 5; y++) for (let xx = -5; xx <= 5; xx++) {
      const d = Math.hypot(xx, y);
      if (d > rad) continue;
      const i = (((Math.floor(cy) + y) % S + S) % S) * S + (((Math.floor(cx) + xx) % S + S) % S);
      v[i] += amp * (1 - d / rad);
    }
  }
  for (let i = 0; i < S * S; i++) {
    const g = Math.max(0, Math.min(255, Math.round((v[i] + (r() - 0.5) * 0.12) * 255)));
    img.data.set([g, g, g, 255], i * 4);
  }
  x.putImageData(img, 0, 0);
  return nearestTex(c, true, true);
}

// Les autres grains, un par famille de biomes : même principe (gris autour de 0,5, raccordable).
function grainFrom(paintFn, seed) {
  const S = 64, [c, x] = makeCanvas(S, S), r = mulberry(seed);
  const v = new Float32Array(S * S).fill(0.5);
  const add = (px, py, amt) => { const i = (((Math.floor(py) % S) + S) % S) * S + (((Math.floor(px) % S) + S) % S); v[i] += amt; };
  paintFn(add, r, S, v);
  const img = x.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const g = Math.max(0, Math.min(255, Math.round((v[i] + (r() - 0.5) * 0.08) * 255)));
    img.data.set([g, g, g, 255], i * 4);
  }
  x.putImageData(img, 0, 0);
  return nearestTex(c, true, true);
}

// brins d'herbe : petits traits clairs et sombres, un peu penchés
const blades = () => grainFrom((add, r) => {
  for (let k = 0; k < 420; k++) {
    const x0 = r() * 64, y0 = r() * 64, h = 2 + r() * 4, lean = (r() - 0.5) * 0.8, a = r() < 0.5 ? 0.22 : -0.18;
    for (let t = 0; t < h; t++) add(x0 + lean * t, y0 - t, a * (1 - t / h * 0.5));
  }
}, 17);

// rides de sable : ondulations régulières, un peu tordues
const ripples = () => grainFrom((add, r, S, v) => {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const w = Math.sin((y + Math.sin(x * 0.2) * 2.5) * (Math.PI * 2 / 8));
    v[y * S + x] += w * 0.16 + (w > 0.85 ? 0.12 : 0);
  }
  for (let k = 0; k < 120; k++) add(r() * 64, r() * 64, (r() - 0.5) * 0.3);
}, 23);

// neige : presque lisse, avec des paillettes qui accrochent la lumière
const snow = () => grainFrom((add, r) => {
  for (let k = 0; k < 90; k++) { const x = r() * 64, y = r() * 64, rad = 2 + r() * 4, a = (r() - 0.5) * 0.12; for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= rad * rad) add(x + dx, y + dy, a); }
  for (let k = 0; k < 70; k++) add(r() * 64, r() * 64, 0.45);
}, 29);

// roche craquelée : des cellules (Voronoï) aux joints sombres
const cracks = () => grainFrom((add, r, S, v) => {
  const pts = Array.from({ length: 14 }, () => [r() * S, r() * S, (r() - 0.5) * 0.18]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let d1 = 1e9, d2 = 1e9, sh = 0;
    for (const [px, py, s] of pts) for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const d = Math.hypot(x - px - ox, y - py - oy);
      if (d < d1) { d2 = d1; d1 = d; sh = s; } else if (d < d2) d2 = d;
    }
    v[y * S + x] += sh + (d2 - d1 < 1.4 ? -0.38 : 0);
  }
}, 31);

function buildBlob() {
  const [c, x] = makeCanvas(64, 64), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.6, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildBooth() {
  const sign = spriteCanvas(20, 12, (p) => {
    p.rect(0, 0, 20, 12, '#ff5fd2'); p.rect(1, 1, 18, 10, '#1a1033');
    p.rect(9, 2, 2, 1, '#ffd23f'); p.rect(8, 3, 4, 1, '#ffd23f'); p.rect(7, 4, 6, 1, '#ffd23f'); p.rect(6, 5, 8, 1, '#ffd23f');
    p.rect(9, 6, 2, 4, '#ffd23f');
  }, false);
  const door = spriteCanvas(10, 24, (p) => {
    p.rect(0, 0, 10, 24, '#c9d2ea'); p.rect(0, 0, 1, 24, '#eef2ff'); p.rect(9, 0, 1, 24, '#9aa3c0');
    p.rect(0, 6, 10, 1, '#9aa3c0'); p.rect(0, 18, 10, 1, '#9aa3c0');
    p.rect(0, 11, 10, 2, '#ff5fd2'); p.rect(2, 2, 6, 3, '#6fd6ff'); p.px(2, 2, '#eef2ff');
  }, false);
  const pillar = spriteCanvas(6, 32, (p) => {
    p.rect(0, 0, 6, 32, '#ffd23f'); p.rect(0, 0, 1, 32, '#ffe98a'); p.rect(5, 0, 1, 32, '#d9a520');
    for (let y = 3; y < 32; y += 6) p.px(3, y, '#8a6410');
    p.rect(0, 8, 6, 2, '#ff5fd2'); p.rect(0, 22, 6, 2, '#ff5fd2');
  }, false);
  return { sign: nearestTex(sign), door: nearestTex(door), pillar: nearestTex(pillar) };
}

export function makeAssets() {
  const grain = buildDetail();
  return { detail: grain, details: { grain, blades: blades(), ripples: ripples(), snow: snow(), cracks: cracks() }, blob: buildBlob(), booth: buildBooth() };
}
