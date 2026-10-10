// Modèles des objets à ramasser : cadeaux emballés, billets, boîte aux lettres,
// morceaux du vaisseau avec leur colonne de lumière.
import * as THREE from 'three';
import { WRAPS } from './catalog.js';
import { makeCanvas, painter, nearestTex } from './pixelart.js';
import { patchMaterial } from './dither.js';

// Papiers cadeaux en pixel art (16 × 16), un par emballage.
function wrapCanvas(w) {
  const [c, x] = makeCanvas(16, 16), p = painter(x);
  p.rect(0, 0, 16, 16, w.base);
  const dark = 'rgba(0,0,0,0.18)', light = 'rgba(255,255,255,0.45)';
  for (let y = 0; y < 16; y++) for (let i = 0; i < 16; i++) {
    let on = false;
    switch (w.pattern) {
      case 'dots': on = (i % 6 === 2 && y % 6 === 2) || (i % 6 === 5 && y % 6 === 5); break;
      case 'stripes': on = (i + y) % 6 < 2; break;
      case 'checks': on = ((i >> 2) + (y >> 2)) % 2 === 0; break;
      case 'zigzag': on = (y + Math.abs((i % 8) - 4)) % 6 < 2; break;
      case 'stars': on = (i % 8 === 3 && (y % 8 >= 2 && y % 8 <= 4)) || (y % 8 === 3 && i % 8 >= 2 && i % 8 <= 4); break;
    }
    if (on) p.px(i, y, w.pattern === 'checks' ? dark : light);
  }
  return c;
}
export const WRAP_CANVAS = WRAPS.map(wrapCanvas);
const WRAP_TEX = WRAP_CANVAS.map((c) => nearestTex(c));

const BILL_TEX = (() => {
  const [c, x] = makeCanvas(16, 8), p = painter(x);
  p.rect(0, 0, 16, 8, '#3f9a4a'); p.rect(1, 1, 14, 6, '#7fd88a'); p.rect(2, 2, 12, 4, '#4fb35a');
  p.rect(6, 2, 4, 4, '#d8f5c8'); p.rect(7, 3, 2, 2, '#3f9a4a');
  return nearestTex(c);
})();

// Matériaux par étage (chaque étage a ses propres uniformes de fondu).
export function pickupMaterials(U) {
  const lam = (o) => patchMaterial(new THREE.MeshLambertMaterial(o), U, { hole: false });
  const glow = (o) => patchMaterial(new THREE.MeshBasicMaterial(o), U, { hole: false });
  const cache = new Map();
  const col = (c) => { if (!cache.has(c)) cache.set(c, lam({ color: c })); return cache.get(c); };
  return {
    wraps: WRAP_TEX.map((t) => lam({ map: t })),
    ribbons: WRAPS.map((w) => lam({ color: w.ribbon })),
    bill: lam({ map: BILL_TEX }),
    beam: glow({ color: '#ffe680', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }),
    glow: glow({ color: '#ffe680' }),
    col,
    cached: () => [...cache.values()],
  };
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function presentModel(M, wrap) {
  const g = new THREE.Group(), box = new THREE.Group();
  g.add(box);
  const rib = M.ribbons[wrap];
  box.add(mesh(new THREE.BoxGeometry(0.46, 0.4, 0.46), M.wraps[wrap], 0, 0.2, 0));
  box.add(mesh(new THREE.BoxGeometry(0.48, 0.42, 0.1), rib, 0, 0.2, 0));
  box.add(mesh(new THREE.BoxGeometry(0.1, 0.42, 0.48), rib, 0, 0.2, 0));
  for (const s of [-1, 1]) {
    const bow = mesh(new THREE.TorusGeometry(0.08, 0.03, 6, 12), rib, s * 0.07, 0.46, 0);
    bow.rotation.y = Math.PI / 2; bow.rotation.x = s * 0.5;
    box.add(bow);
  }
  g.userData.box = box;
  return g;
}
export function setPresentWrap(g, M, wrap) {
  const [paper, r1, r2, b1, b2] = g.userData.box.children;
  paper.material = M.wraps[wrap];
  for (const m of [r1, r2, b1, b2]) m.material = M.ribbons[wrap];
}

export function billModel(M) {
  const g = new THREE.Group();
  const b = mesh(new THREE.BoxGeometry(0.44, 0.02, 0.22), M.bill, 0, 0, 0);
  b.rotation.x = -0.9;
  g.add(b);
  return g;
}

export function mailboxModel(M) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.1, 0.75, 0.1), M.col('#6b4a2e'), 0, 0.37, 0));
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.3, 0.6), M.col('#3a6fe8'), 0, 0.88, 0));
  const top = mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.6, 14, 1, false, 0, Math.PI), M.col('#3a6fe8'), 0, 1.03, 0);
  top.rotation.set(Math.PI / 2, Math.PI / 2, 0);
  g.add(top);
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.06, 0.02), M.col('#1a1033'), 0, 0.98, 0.31));
  const flag = new THREE.Group(); flag.position.set(0.23, 0.9, -0.1); g.add(flag);
  flag.add(mesh(new THREE.BoxGeometry(0.03, 0.36, 0.05), M.col('#ff4a5c'), 0, 0.15, 0));
  flag.add(mesh(new THREE.BoxGeometry(0.03, 0.12, 0.16), M.col('#ff4a5c'), 0, 0.28, 0.08));
  g.userData.flag = flag;
  return g;
}

// Les dix morceaux de la fusée de ToeJam et Earl, chacun sa forme.
export function pieceModel(M, index) {
  const g = new THREE.Group(), part = new THREE.Group();
  part.position.y = 0.9;
  g.add(part);
  const silver = M.col('#d9e3ff'), red = M.col('#ff4a5c'), gold = M.col('#ffcf3a'), dark = M.col('#2a2440'), cyan = M.col('#6fd6ff');
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, rz = 0) => { const m = mesh(geo, mat, x, y, z); m.rotation.set(rx, 0, rz); part.add(m); return m; };
  switch (index) {
    case 0: add(new THREE.ConeGeometry(0.3, 0.7, 14), red, 0, 0.1); add(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 14), silver, 0, -0.3); break;
    case 1: case 2: { const s = index === 1 ? -1 : 1; add(new THREE.BoxGeometry(0.08, 0.6, 0.45), red, 0, 0, 0, 0, s * 0.3); add(new THREE.BoxGeometry(0.1, 0.12, 0.47), gold, s * 0.08, -0.28); break; }
    case 3: add(new THREE.CylinderGeometry(0.28, 0.32, 0.5, 14), silver); add(new THREE.TorusGeometry(0.3, 0.05, 6, 16), gold, 0, -0.2, 0, Math.PI / 2); add(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 12), dark, 0, -0.28); break;
    case 4: add(new THREE.TorusGeometry(0.28, 0.07, 8, 18), gold); add(new THREE.CircleGeometry(0.24, 18), cyan, 0, 0, 0.01); break;
    case 5: add(new THREE.CylinderGeometry(0.32, 0.32, 0.55, 14, 1, true), silver); add(new THREE.TorusGeometry(0.32, 0.04, 6, 16), red, 0, 0.2, 0, Math.PI / 2); add(new THREE.TorusGeometry(0.32, 0.04, 6, 16), red, 0, -0.2, 0, Math.PI / 2); break;
    case 6: add(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), silver); add(new THREE.SphereGeometry(0.1, 10, 8), red, 0, 0.38); add(new THREE.BoxGeometry(0.3, 0.06, 0.3), dark, 0, -0.34); break;
    case 7: add(new THREE.BoxGeometry(0.5, 0.6, 0.3), dark); add(new THREE.CylinderGeometry(0.18, 0.1, 0.06, 16), silver, 0, 0.1, 0.16, Math.PI / 2); add(new THREE.CylinderGeometry(0.08, 0.05, 0.06, 12), silver, 0, -0.17, 0.16, Math.PI / 2); break;
    case 8: add(new THREE.CylinderGeometry(0.15, 0.3, 0.45, 14, 1, true), dark); add(new THREE.TorusGeometry(0.3, 0.04, 6, 16), gold, 0, -0.22, 0, Math.PI / 2); break;
    default: add(new THREE.BoxGeometry(0.45, 0.1, 0.4), red); add(new THREE.BoxGeometry(0.45, 0.45, 0.1), red, 0, 0.22, -0.17); add(new THREE.BoxGeometry(0.06, 0.25, 0.06), silver, 0, -0.17, 0);
  }
  const pad = mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 24), M.glow, 0, 0.05, 0);
  pad.rotation.x = Math.PI / 2;
  g.add(pad);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 9, 16, 1, true), M.beam);
  beam.position.y = 4.5; beam.renderOrder = 2;
  g.add(beam);
  g.userData.part = part;
  return g;
}

// La nourriture : petits volumes posés au sol.
export function foodModel(M, type) {
  const g = new THREE.Group(), part = new THREE.Group();
  part.position.y = 0.12;
  g.add(part);
  const add = (geo, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = mesh(geo, M.col(color), x, y, z); m.scale.set(sx, sy, sz); part.add(m); return m; };
  const sph = (r) => new THREE.SphereGeometry(r, 12, 8);
  switch (type) {
    case 'burger':
      add(sph(0.2), '#d99a4a', 0, 0.16, 0, 1, 0.5, 1); add(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 14), '#6b3a1e', 0, 0.08);
      add(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 14), '#5fcf5a', 0, 0.11); add(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 14), '#d99a4a', 0, 0.02);
      break;
    case 'cake': {
      const c = add(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 12, 1, false, 0, Math.PI / 3), '#f7d9a8', 0, 0.1);
      c.rotation.y = 1; add(sph(0.05), '#ff4a5c', 0.1, 0.24, 0.05);
      const top = add(new THREE.CylinderGeometry(0.255, 0.255, 0.04, 12, 1, false, 0, Math.PI / 3), '#ff8ad8', 0, 0.2);
      top.rotation.y = 1;
      break;
    }
    case 'fries':
      add(new THREE.BoxGeometry(0.2, 0.18, 0.12), '#e8334a', 0, 0.09);
      for (let k = 0; k < 6; k++) { const f = add(new THREE.BoxGeometry(0.03, 0.18, 0.03), '#ffd23f', -0.07 + k * 0.028, 0.22, (k % 2) * 0.03 - 0.015); f.rotation.z = (k - 2.5) * 0.08; }
      break;
    case 'melon': {
      const m = add(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 14, 1, false, 0, Math.PI), '#ff5a5a', 0, 0.13);
      m.rotation.x = Math.PI / 2;
      const rind = add(new THREE.CylinderGeometry(0.26, 0.26, 0.07, 14, 1, false, 0, Math.PI), '#3f9a3d', 0, 0.12, -0.005);
      rind.rotation.x = Math.PI / 2;
      break;
    }
    case 'sundae':
      add(new THREE.CylinderGeometry(0.14, 0.05, 0.14, 12), '#d9e3ff', 0, 0.07);
      add(sph(0.1), '#fff3e0', -0.05, 0.18); add(sph(0.1), '#ff8ad8', 0.06, 0.19); add(sph(0.05), '#ff2a3a', 0, 0.3);
      break;
    default: { // poisson douteux, avec ses mouches
      add(sph(0.16), '#8a9a8a', 0, 0.08, 0, 1.4, 0.6, 0.6);
      const tail = add(new THREE.ConeGeometry(0.1, 0.15, 4), '#6a7a6a', -0.28, 0.08); tail.rotation.z = Math.PI / 2;
      add(sph(0.025), '#1a1033', 0.15, 0.12, 0.06);
      g.userData.flies = [0, 1].map((k) => add(sph(0.025), '#1a1033', 0, 0.35 + k * 0.1, 0));
    }
  }
  g.userData.part = part;
  return g;
}
