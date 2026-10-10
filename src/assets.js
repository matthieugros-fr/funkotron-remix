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
  return { detail: buildDetail(), blob: buildBlob(), booth: buildBooth() };
}
