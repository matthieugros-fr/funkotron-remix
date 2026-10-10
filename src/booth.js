// La cabine d'ascenseur, en volumes : socle, montants jaunes, enseigne lumineuse, portes en accordéon.
import * as THREE from 'three';
import { patchMaterial, levelUniforms } from './dither.js';

export const BOOTH = { W: 1.7, D: 1.5, H: 2.6, OW: 1.0, OH: 1.9 };

export function createBooth(tex) {
  const { W, D, H, OW, OH } = BOOTH, PW = (W - OW) / 2;
  const U = levelUniforms(THREE);
  const lam = (o) => patchMaterial(new THREE.MeshLambertMaterial(o), U, { hole: false });
  const yellow = lam({ color: '#ffc83a' }), magenta = lam({ color: '#c8379a' }), dark = lam({ color: '#2a1f55' }), base = lam({ color: '#4a2f70' });
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };

  add(new THREE.BoxGeometry(W + 0.24, 0.12, D + 0.24), base, 0, 0.06, 0);
  const pillar = lam({ map: tex.pillar });
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(PW, H - 0.12, D), [yellow, yellow, yellow, yellow, pillar, yellow], s * (W / 2 - PW / 2), 0.12 + (H - 0.12) / 2, 0);
  add(new THREE.BoxGeometry(OW, H - OH - 0.12, D), yellow, 0, OH + 0.12 + (H - OH - 0.12) / 2, 0);
  // enseigne lumineuse « flèche vers le haut »
  const basic = (o) => patchMaterial(new THREE.MeshBasicMaterial(o), U, { hole: false });
  const signMat = basic({ map: tex.sign });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(OW * 0.9, (H - OH - 0.12) * 0.85), signMat);
  sign.position.set(0, OH + 0.12 + (H - OH - 0.12) / 2, D / 2 + 0.01);
  g.add(sign);
  add(new THREE.BoxGeometry(OW, OH, 0.08), dark, 0, 0.12 + OH / 2, -D / 2 + 0.04);
  add(new THREE.BoxGeometry(W + 0.14, 0.2, D + 0.14), magenta, 0, H + 0.1, 0);
  add(new THREE.BoxGeometry(W - 0.2, 0.12, D - 0.2), magenta, 0, H + 0.26, 0);
  const bulbMat = basic({ color: '#ffe680' });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), bulbMat);
  bulb.position.set(0, H + 0.42, 0);
  g.add(bulb);
  // lumière intérieure
  const glow = new THREE.Mesh(new THREE.BoxGeometry(OW * 0.8, 0.04, 0.3), basic({ color: '#ffe9a0' }));
  glow.position.set(0, OH + 0.08, 0); g.add(glow);

  const doorMat = lam({ map: tex.door });
  const doors = [-1, 1].map((s) => {
    const pivot = new THREE.Group(); pivot.position.set(s * OW / 2, 0.12, D / 2 - 0.1); g.add(pivot);
    const m = new THREE.Mesh(new THREE.BoxGeometry(OW / 2, OH, 0.06), doorMat);
    m.position.set(-s * OW / 4, OH / 2, 0); m.castShadow = true; pivot.add(m);
    return pivot;
  });
  g.userData = {
    U, bulbMat, traveling: false, open: 1,
    setDoors(o) { this.open = o; for (const p of doors) p.scale.x = 1 - 0.88 * o; },
  };
  g.userData.setDoors(1);
  return g;
}
