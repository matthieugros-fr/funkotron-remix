// La cabine d'ascenseur : un vrai volume 3D habillé de textures en pixel art.
import * as THREE from 'three';
import { PX, SY } from './config.js';
import { patchMaterial, levelUniforms } from './dither.js';

export const BOOTH = { W: 28 / PX, D: 4 / 3, H: (44 / PX) * SY, OW: 18 / PX, OH: (34 / PX) * SY };

export function createBooth(tex) {
  const { W, D, H, OW, OH } = BOOTH, PW = (W - OW) / 2;
  const U = levelUniforms(THREE);
  const lam = (o) => patchMaterial(new THREE.MeshLambertMaterial(o), U, { hole: false });
  const yellow = lam({ color: '#ffd23f' }), magenta = lam({ color: '#c23aa0' }), dark = lam({ color: '#2a1f55' });
  const faces = (front) => [yellow, yellow, yellow, yellow, front, yellow];
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };

  const pillar = lam({ map: tex.pillar });
  add(new THREE.BoxGeometry(PW, H, D), faces(pillar), -W / 2 + PW / 2, H / 2, 0);
  add(new THREE.BoxGeometry(PW, H, D), faces(pillar), W / 2 - PW / 2, H / 2, 0);
  add(new THREE.BoxGeometry(OW, H - OH, D), faces(lam({ map: tex.sign })), 0, OH + (H - OH) / 2, 0);
  add(new THREE.BoxGeometry(OW, OH, 0.08), [dark, dark, dark, dark, lam({ map: tex.inside }), dark], 0, OH / 2, -D / 2 + 0.04);
  add(new THREE.BoxGeometry(OW, 0.06, D), dark, 0, 0.03, 0);
  add(new THREE.BoxGeometry(W + 0.12, 0.28, D + 0.12), magenta, 0, H + 0.14, 0);
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffe680' });
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.32, 0.25), bulbMat);
  bulb.position.set(0, H + 0.44, 0.2); g.add(bulb);

  // Portes en accordéon : chaque battant se replie vers son montant.
  const doorMat = lam({ map: tex.door });
  const doors = [-1, 1].map((s) => {
    const pivot = new THREE.Group(); pivot.position.set(s * OW / 2, 0, D / 2 - 0.08); g.add(pivot);
    const m = new THREE.Mesh(new THREE.BoxGeometry(OW / 2, OH, 0.06), [doorMat, doorMat, doorMat, doorMat, doorMat, doorMat]);
    m.position.set(-s * OW / 4, OH / 2, 0); m.castShadow = true; pivot.add(m);
    return pivot;
  });
  g.userData = {
    U, bulbMat, traveling: false, open: 1,
    setDoors(o) { this.open = o; for (const p of doors) p.scale.x = 1 - 0.9 * o; },
  };
  g.userData.setDoors(1);
  return g;
}
