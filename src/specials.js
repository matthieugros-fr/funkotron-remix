// Éléments uniques : la fusée de ToeJam et Earl sur son pas de tir, et le jacuzzi du niveau secret.
import * as THREE from 'three';
import { patchMaterial } from './dither.js';

function kit(U) {
  const cache = new Map();
  const lam = (color, o = {}) => {
    const key = color + JSON.stringify(o);
    if (!cache.has(key)) cache.set(key, patchMaterial(new THREE.MeshLambertMaterial({ color, ...o }), U, { hole: false }));
    return cache.get(key);
  };
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, 0, rz);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  return { lam, add };
}

// La fusée : dix morceaux, un par pièce trouvée. Ceux qui manquent restent en fantôme bleuté.
export function buildRocket(U) {
  const { lam, add } = kit(U);
  const g = new THREE.Group();
  const silver = lam('#d9e3ff'), red = lam('#ff4a5c'), gold = lam('#ffcf3a'), dark = lam('#2a2440'), cyan = lam('#6fd6ff', { transparent: true, opacity: 0.55 });
  // pas de tir
  add(g, new THREE.CylinderGeometry(1.4, 1.5, 0.2, 24), lam('#4a4f63'), 0, 0.1, 0);
  add(g, new THREE.TorusGeometry(1.3, 0.05, 6, 32), lam('#ffd23f'), 0, 0.21, 0, Math.PI / 2);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    add(g, new THREE.BoxGeometry(0.12, 3.2, 0.12), lam('#8b93a8'), Math.cos(a) * 1.2, 1.7, Math.sin(a) * 1.2);
  }
  const rocket = new THREE.Group();
  rocket.position.y = 0.2;
  g.add(rocket);
  const parts = [];
  const part = (idx, build) => { const p = new THREE.Group(); rocket.add(p); build(p); parts[idx] = p; };
  part(8, (p) => add(p, new THREE.CylinderGeometry(0.32, 0.46, 0.4, 16, 1, true), dark, 0, 0.25));
  part(3, (p) => { add(p, new THREE.CylinderGeometry(0.55, 0.5, 0.6, 18), silver, 0, 0.75); add(p, new THREE.TorusGeometry(0.56, 0.05, 6, 20), gold, 0, 0.55, 0, Math.PI / 2); });
  part(1, (p) => add(p, new THREE.BoxGeometry(0.08, 0.9, 0.6), red, -0.7, 0.75, 0, 0, 0.35));
  part(2, (p) => add(p, new THREE.BoxGeometry(0.08, 0.9, 0.6), red, 0.7, 0.75, 0, 0, -0.35));
  part(5, (p) => { add(p, new THREE.CylinderGeometry(0.55, 0.55, 1.4, 18), silver, 0, 1.75); for (const y of [1.2, 2.3]) add(p, new THREE.TorusGeometry(0.56, 0.05, 6, 20), red, 0, y, 0, Math.PI / 2); });
  part(4, (p) => { add(p, new THREE.TorusGeometry(0.22, 0.06, 8, 18), gold, 0, 1.95, 0.55); add(p, new THREE.CircleGeometry(0.2, 18), cyan, 0, 1.95, 0.56); });
  part(9, (p) => { add(p, new THREE.BoxGeometry(0.22, 0.12, 0.2), red, 0, 1.85, 0.3); add(p, new THREE.BoxGeometry(0.22, 0.25, 0.06), red, 0, 1.98, 0.22); });
  part(7, (p) => { add(p, new THREE.BoxGeometry(0.3, 0.4, 0.2), dark, 0.62, 1.55, 0); add(p, new THREE.CylinderGeometry(0.12, 0.06, 0.06, 14), silver, 0.73, 1.55, 0, 0, Math.PI / 2); });
  part(0, (p) => add(p, new THREE.ConeGeometry(0.55, 1.0, 18), red, 0, 2.95));
  part(6, (p) => { add(p, new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), silver, 0, 3.65); add(p, new THREE.SphereGeometry(0.08, 10, 8), red, 0, 3.92); });
  for (const p of parts) p.traverse((o) => { if (o.isMesh) o.userData.real = o.material; });
  g.userData = {
    U, parts, rocket,
    ghost: patchMaterial(new THREE.MeshBasicMaterial({ color: '#6fd6ff', transparent: true, opacity: 0.22, depthWrite: false }), U, { hole: false }),
    shown: -1,
  };
  return g;
}

// Montre en vrai les morceaux trouvés, en fantôme les autres.
export function setRocketPieces(g, pieces) {
  const ud = g.userData;
  if (ud.shown === pieces.size) return;
  ud.shown = pieces.size;
  ud.parts.forEach((p, i) => p.traverse((o) => {
    if (!o.isMesh) return;
    o.material = pieces.has(i) ? o.userData.real : ud.ghost;
    o.castShadow = pieces.has(i);
  }));
}

// Le jacuzzi du niveau 0 : on s'y prélasse, l'énergie remonte. Assez grand pour deux danseuses et un héros.
export const TUB_R = 1.5;
export function buildHottub(U) {
  const { lam, add } = kit(U);
  const g = new THREE.Group(), R = TUB_R;
  add(g, new THREE.CylinderGeometry(R, R + 0.06, 0.45, 32, 1, true), lam('#8a5a32', { side: THREE.DoubleSide }), 0, 0.22, 0);
  add(g, new THREE.TorusGeometry(R + 0.02, 0.08, 6, 36), lam('#a76f40'), 0, 0.45, 0, Math.PI / 2);
  const water = add(g, new THREE.CircleGeometry(R - 0.03, 32), lam('#3ad6ff', { emissive: '#0a4a6a' }), 0, 0.36, 0, -Math.PI / 2);
  add(g, new THREE.CylinderGeometry(R - 0.03, R - 0.03, 0.05, 32), lam('#6a4426'), 0, 0.02, 0);
  // serviettes et cocktails sur le rebord
  add(g, new THREE.BoxGeometry(0.5, 0.04, 0.3), lam('#ff8ad8'), R - 0.05, 0.48, 0.5, 0, 0.2);
  add(g, new THREE.BoxGeometry(0.5, 0.04, 0.3), lam('#7affd0'), -0.4, 0.48, R - 0.02, 0, 1.4);
  add(g, new THREE.CylinderGeometry(0.06, 0.03, 0.14, 8), lam('#ffd23f'), -R + 0.05, 0.55, -0.4);
  add(g, new THREE.CylinderGeometry(0.06, 0.03, 0.14, 8), lam('#ff6a3a'), 0.5, 0.55, -R + 0.04);
  g.userData.water = water;
  return g;
}
