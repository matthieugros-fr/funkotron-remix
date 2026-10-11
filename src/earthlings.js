// Les terriens : modèles en volumes et comportements.
// Chacun erre près de chez lui, repère ToeJam à la vue (deux fois moins loin s'il marche sur
// la pointe des pieds), le poursuit à sa façon, et le bouscule au contact.
// Une tomate bien placée les fait déguerpir.
import * as THREE from 'three';
import { EARTHLINGS, rollPresent } from './catalog.js';
import { T } from './gen.js';
import { topOf } from './terrain3d.js';
import { sound } from './audio.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const mats = new Map();
function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color, ...o }));
  return mats.get(key);
}
function add(parent, geo, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, o) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, o) : color);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function joint(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
const sph = (r, a = 14, b = 10) => new THREE.SphereGeometry(r, a, b);
const cyl = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s);
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 8);

function legs(body, color, y, spread = 0.1, len = 0.3, shoe = '#2a2440') {
  return [-1, 1].map((s) => {
    const j = joint(body, s * spread, y, 0);
    add(j, cap(0.06, len), color, 0, -len / 2 - 0.04, 0);
    add(j, new THREE.BoxGeometry(0.13, 0.08, 0.2), shoe, 0, -len - 0.08, 0.03);
    return j;
  });
}
function eyes(head, y, z, spread, r = 0.035) {
  for (const s of [-1, 1]) add(head, sph(r, 8, 6), '#1a1033', s * spread, y, z);
}

const MODELS = {
  dentist() {
    const root = new THREE.Group(), body = joint(root);
    const L = legs(body, '#3a3550', 0.45);
    add(body, cyl(0.24, 0.32, 0.75), '#f4f6ff', 0, 0.8);
    add(body, new THREE.BoxGeometry(0.1, 0.12, 0.02), '#9ad8ff', 0.1, 0.95, 0.25);
    const head = joint(body, 0, 1.36);
    add(head, sph(0.22), '#f0c39a');
    add(head, sph(0.23, 12, 6), '#9aa0b0', 0, 0.07, -0.04, 1, 0.75, 1);
    add(head, cyl(0.08, 0.08, 0.02), '#e8eef8', 0, 0.12, 0.2).rotation.x = Math.PI / 2;
    eyes(head, 0.02, 0.2, 0.08);
    add(head, new THREE.BoxGeometry(0.14, 0.04, 0.02), '#ffffff', 0, -0.09, 0.2);
    const arm = joint(body, 0.3, 1.0, 0);
    add(arm, cap(0.06, 0.25), '#f4f6ff', 0, -0.15, 0.05).rotation.x = -0.9;
    const drill = joint(arm, 0, -0.18, 0.3);
    add(drill, cyl(0.05, 0.05, 0.25), '#8b93a8').rotation.x = Math.PI / 2;
    const bit = add(drill, new THREE.ConeGeometry(0.03, 0.16, 6), '#d9e3ff', 0, 0, 0.2);
    bit.rotation.x = Math.PI / 2;
    return { root, body, legs: L, extra: { bit } };
  },
  nerd() {
    const root = new THREE.Group(), body = joint(root);
    const L = legs(body, '#4a5a8a', 0.36, 0.08, 0.24);
    add(body, cyl(0.2, 0.24, 0.5), '#ff9a3a', 0, 0.62);
    add(body, new THREE.BoxGeometry(0.1, 0.12, 0.02), '#ffffff', 0.08, 0.72, 0.22);
    const head = joint(body, 0, 1.05);
    add(head, sph(0.22), '#f2c29b');
    add(head, sph(0.23, 12, 6), '#6b4a2e', 0, 0.08, -0.03, 1, 0.7, 1);
    for (const s of [-1, 1]) { const gl = add(head, new THREE.TorusGeometry(0.07, 0.02, 6, 12), '#1a1033', s * 0.09, 0.02, 0.2); gl.rotation.y = 0; }
    add(head, new THREE.BoxGeometry(0.06, 0.02, 0.02), '#1a1033', 0, 0.02, 0.21);
    eyes(head, 0.02, 0.22, 0.09, 0.025);
    return { root, body, legs: L };
  },
  hamster() {
    const root = new THREE.Group(), body = joint(root, 0, 0.5);
    const ball = add(body, sph(0.5, 18, 12), mat('#cfe8ff', { transparent: true, opacity: 0.32, depthWrite: false }));
    ball.castShadow = false;
    const h = joint(body);
    add(h, sph(0.24), '#e8a050', 0, -0.12, 0, 1, 0.85, 1.15);
    add(h, sph(0.14), '#fff3e0', 0, -0.16, 0.12);
    for (const s of [-1, 1]) add(h, sph(0.06, 8, 6), '#ff9ab0', s * 0.13, 0.08, 0.05);
    eyes(h, -0.04, 0.24, 0.08);
    const lines = add(body, new THREE.TorusGeometry(0.5, 0.012, 4, 24), '#9ab8d8');
    lines.rotation.order = 'YXZ';
    return { root, body, extra: { ball: lines, inner: h } };
  },
  cupid() {
    const root = new THREE.Group(), body = joint(root, 0, 1.5);
    add(body, sph(0.24), '#ffc8b0', 0, 0, 0, 1, 1.1, 1);
    add(body, sph(0.2, 10, 6), '#ffffff', 0, -0.14, 0, 1.1, 0.6, 1.1);
    const head = joint(body, 0, 0.36);
    add(head, sph(0.2), '#ffc8b0');
    add(head, sph(0.21, 10, 6), '#ffe36b', 0, 0.07, -0.02, 1, 0.7, 1);
    eyes(head, 0.02, 0.18, 0.07);
    const wings = [-1, 1].map((s) => {
      const w = joint(body, s * 0.12, 0.12, -0.15);
      add(w, sph(0.22, 10, 6), '#ffffff', s * 0.22, 0, 0, 1, 0.12, 0.6);
      return w;
    });
    const bow = add(body, new THREE.TorusGeometry(0.22, 0.02, 6, 16, Math.PI), '#c8902a', 0.28, 0.05, 0.12);
    bow.rotation.z = -Math.PI / 2;
    add(body, new THREE.ConeGeometry(0.04, 0.1, 6), '#ff4a8a', 0.3, 0.05, 0.3).rotation.x = Math.PI / 2;
    return { root, body, extra: { wings } };
  },
  devil() {
    const root = new THREE.Group(), body = joint(root);
    const L = legs(body, '#c22828', 0.32, 0.08, 0.2, '#1a1033');
    add(body, sph(0.26), '#e8281f', 0, 0.55, 0, 1, 1.1, 1);
    const head = joint(body, 0, 0.92);
    add(head, sph(0.21), '#e8281f');
    for (const s of [-1, 1]) add(head, new THREE.ConeGeometry(0.05, 0.16, 6), '#fff3c0', s * 0.11, 0.2, 0).rotation.z = -s * 0.4;
    eyes(head, 0.03, 0.19, 0.07);
    add(head, new THREE.BoxGeometry(0.12, 0.025, 0.02), '#1a1033', 0, -0.07, 0.19);
    const tail = joint(body, 0, 0.45, -0.22);
    add(tail, cyl(0.025, 0.025, 0.35, 6), '#c22828', 0, 0.1, -0.1).rotation.x = -0.9;
    add(tail, new THREE.ConeGeometry(0.06, 0.12, 4), '#c22828', 0, 0.22, -0.26).rotation.x = -0.9;
    const fork = joint(body, 0.3, 0.6, 0.1);
    add(fork, cyl(0.025, 0.025, 0.9, 6), '#8b93a8', 0, 0.2, 0);
    for (const x of [-0.07, 0, 0.07]) add(fork, new THREE.ConeGeometry(0.025, 0.14, 4), '#d9e3ff', x, 0.7, 0);
    return { root, body, legs: L, extra: { fork } };
  },
  opera() {
    const root = new THREE.Group(), body = joint(root);
    add(body, new THREE.ConeGeometry(0.6, 1.1, 16), '#8a3ad0', 0, 0.55);
    add(body, sph(0.3), '#8a3ad0', 0, 1.1, 0, 1.1, 0.9, 1);
    const head = joint(body, 0, 1.55);
    add(head, sph(0.24), '#f2c29b');
    add(head, new THREE.SphereGeometry(0.26, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#a8aec2', 0, 0.06, 0);
    for (const s of [-1, 1]) add(head, new THREE.ConeGeometry(0.06, 0.3, 6), '#fff3e0', s * 0.26, 0.2, 0).rotation.z = -s * 1.0;
    for (const s of [-1, 1]) add(head, cyl(0.05, 0.03, 0.5, 6), '#ffd23f', s * 0.22, -0.3, -0.05);
    eyes(head, 0.04, 0.21, 0.08);
    const mouth = add(head, sph(0.06, 8, 6), '#5a0f22', 0, -0.09, 0.2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: '#ff8ad8', transparent: true, opacity: 0.7, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 1.4; ring.visible = false;
    root.add(ring);
    return { root, body, extra: { mouth, ring } };
  },
  wiseman() {
    const root = new THREE.Group(), body = joint(root);
    const carrot = add(body, new THREE.ConeGeometry(0.42, 1.5, 12), '#ff8a2a', 0, 0.85);
    carrot.rotation.x = Math.PI;
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; add(body, new THREE.ConeGeometry(0.07, 0.5, 5), '#3fae4a', Math.cos(a) * 0.12, 1.78, Math.sin(a) * 0.12).rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); }
    for (let y = 0.4; y < 1.4; y += 0.25) add(body, new THREE.TorusGeometry(0.3 - (1.4 - y) * 0.1, 0.012, 4, 16), '#d96a1a', 0, y, 0).rotation.x = Math.PI / 2;
    const face = joint(body, 0, 1.25, 0.3);
    add(face, sph(0.15), '#f0c39a');
    add(face, sph(0.13, 10, 8), '#f4f4f4', 0, -0.12, 0.03, 1, 1.2, 0.8);
    eyes(face, 0.03, 0.13, 0.05, 0.025);
    return { root, body };
  },
};
MODELS.hula = function () {
  const root = new THREE.Group(), body = joint(root);
  const L = legs(body, '#c98a5a', 0.4, 0.08, 0.3, '#c98a5a');
  const skirt = add(body, new THREE.ConeGeometry(0.34, 0.45, 12, 1, true), '#5fcf5a', 0, 0.55, 0);
  skirt.material = mat('#5fcf5a', { side: THREE.DoubleSide });
  add(body, cyl(0.15, 0.2, 0.4), '#c98a5a', 0, 0.9);
  add(body, sph(0.12), '#ff5fd2', -0.07, 1.0, 0.1, 1, 0.7, 0.6); add(body, sph(0.12), '#ff5fd2', 0.07, 1.0, 0.1, 1, 0.7, 0.6);
  const lei = add(body, new THREE.TorusGeometry(0.17, 0.05, 6, 14), '#ffd23f', 0, 1.12, 0); lei.rotation.x = Math.PI / 2 - 0.3;
  const head = joint(body, 0, 1.36);
  add(head, sph(0.2), '#c98a5a');
  add(head, sph(0.22, 12, 8), '#2a1a12', 0, 0.04, -0.06, 1, 1.05, 1);
  add(head, sph(0.06, 8, 6), '#ff8ad8', 0.15, 0.1, 0.05);
  eyes(head, 0.02, 0.18, 0.07);
  const arms = [-1, 1].map((s) => { const j = joint(body, s * 0.18, 1.05, 0); add(j, cap(0.045, 0.3), '#c98a5a', 0, -0.18, 0); return j; });
  return { root, body, legs: L, extra: { arms } };
};

// Le croque-mitaine : invisible de loin, seuls ses yeux et son ombre le trahissent.
MODELS.boogey = function () {
  const root = new THREE.Group(), body = joint(root);
  const fur = new THREE.MeshLambertMaterial({ color: '#2b1838', transparent: true });
  const glow = new THREE.MeshBasicMaterial({ color: '#ffe14a', transparent: true });
  const L = legs(body, fur, 0.36, 0.11, 0.3, fur);
  add(body, cap(0.3, 0.55), fur, 0, 0.95);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2, y = 0.6 + (k % 4) * 0.22;
    add(body, new THREE.ConeGeometry(0.06, 0.22, 4), fur, Math.cos(a) * 0.3, y, Math.sin(a) * 0.3).rotation.set(Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3);
  }
  const head = joint(body, 0, 1.55);
  add(head, sph(0.27), fur);
  for (const s of [-1, 1]) add(head, new THREE.ConeGeometry(0.06, 0.25, 5), fur, s * 0.16, 0.24, 0).rotation.z = -s * 0.5;
  for (const s of [-1, 1]) add(head, sph(0.065, 8, 6), glow, s * 0.1, 0.04, 0.22, 1, 0.7, 0.5);
  for (let k = 0; k < 5; k++) add(head, new THREE.ConeGeometry(0.02, 0.06, 3), glow, -0.08 + k * 0.04, -0.1, 0.23).rotation.x = Math.PI;
  const arms = [-1, 1].map((s) => {
    const j = joint(body, s * 0.32, 1.25, 0);
    add(j, cap(0.07, 0.55), fur, 0, -0.35, 0.05);
    for (const x of [-0.04, 0, 0.04]) add(j, new THREE.ConeGeometry(0.02, 0.1, 4), glow, x, -0.72, 0.08).rotation.x = Math.PI;
    return j;
  });
  return { root, body, legs: L, extra: { fur, glow, arms } };
};

// L'homme à la tondeuse : il fonce, il tourne mal, il laisse de l'herbe coupée derrière lui.
MODELS.mower = function () {
  const root = new THREE.Group(), body = joint(root);
  const L = legs(body, '#3a5fbf', 0.42, 0.1, 0.32, '#5a3a22');
  add(body, new THREE.BoxGeometry(0.46, 0.5, 0.3), '#3a5fbf', 0, 0.68);
  add(body, new THREE.BoxGeometry(0.4, 0.32, 0.26), '#e8e0c8', 0, 1.06);
  const head = joint(body, 0, 1.4);
  add(head, sph(0.2), '#f0c39a');
  add(head, sph(0.21, 12, 6), '#e8334a', 0, 0.06, -0.02, 1, 0.6, 1);
  add(head, new THREE.BoxGeometry(0.22, 0.03, 0.16), '#e8334a', 0, 0.09, 0.2);
  add(head, new THREE.BoxGeometry(0.16, 0.05, 0.04), '#5a3a22', 0, -0.06, 0.19);
  eyes(head, 0.03, 0.19, 0.07);
  for (const s of [-1, 1]) add(body, cap(0.06, 0.32), '#e8e0c8', s * 0.22, 0.98, 0.2).rotation.x = -1.2;
  const mower = joint(body, 0, 0, 0.85);
  add(mower, new THREE.BoxGeometry(0.6, 0.18, 0.55), '#d8282c', 0, 0.2, 0);
  add(mower, cyl(0.12, 0.14, 0.2), '#3a3550', 0, 0.38, 0);
  for (const [x, z] of [[-0.3, -0.22], [0.3, -0.22], [-0.3, 0.22], [0.3, 0.22]]) add(mower, cyl(0.09, 0.09, 0.06), '#1a1033', x, 0.09, z).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) add(mower, cyl(0.02, 0.02, 0.8, 6), '#9aa3c0', s * 0.2, 0.55, -0.42).rotation.x = 0.8;
  add(mower, cyl(0.025, 0.025, 0.46, 6), '#1a1033', 0, 0.83, -0.7).rotation.z = Math.PI / 2;
  const blade = add(mower, cyl(0.24, 0.24, 0.01, 10), '#c8d0e0', 0, 0.1, 0);
  return { root, body, legs: L, extra: { blade, mower } };
};

// La dame au caddie : elle charge en ligne droite, et ne freine pas.
MODELS.cart = function () {
  const root = new THREE.Group(), body = joint(root);
  const L = legs(body, '#f2c29b', 0.34, 0.08, 0.24, '#5a2a6a');
  add(body, new THREE.ConeGeometry(0.34, 0.6, 12), '#9a4ad0', 0, 0.62);
  add(body, cyl(0.18, 0.22, 0.32), '#9a4ad0', 0, 0.98);
  const head = joint(body, 0, 1.3);
  add(head, sph(0.19), '#f2c29b');
  add(head, sph(0.2, 12, 6), '#c8c8d0', 0, 0.06, -0.03, 1, 0.75, 1);
  add(head, sph(0.1), '#c8c8d0', 0, 0.2, -0.12);
  for (const s of [-1, 1]) add(head, new THREE.TorusGeometry(0.05, 0.012, 6, 12), '#1a1033', s * 0.07, 0.02, 0.18);
  eyes(head, 0.02, 0.19, 0.07, 0.022);
  for (const s of [-1, 1]) add(body, cap(0.05, 0.3), '#9a4ad0', s * 0.18, 0.95, 0.2).rotation.x = -1.3;
  const cart = joint(body, 0, 0, 0.85);
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.62, 0.42, 0.75, 3, 2, 4)), new THREE.LineBasicMaterial({ color: '#c8d0e0' }));
  box.position.set(0, 0.55, 0);
  cart.add(box);
  add(cart, new THREE.BoxGeometry(0.6, 0.02, 0.72), '#9aa3c0', 0, 0.35, 0);
  for (const [c, x, z] of [['#ffcf3a', -0.12, -0.1], ['#3fae4a', 0.12, 0.1], ['#ff4a5c', 0.1, -0.15], ['#6fd6ff', -0.1, 0.18]]) add(cart, new THREE.BoxGeometry(0.16, 0.22, 0.14), c, x, 0.48, z);
  add(cart, cyl(0.02, 0.02, 0.62, 6), '#1a1033', 0, 0.8, -0.4).rotation.z = Math.PI / 2;
  const wheels = [];
  for (const [x, z] of [[-0.26, -0.3], [0.26, -0.3], [-0.26, 0.3], [0.26, 0.3]]) wheels.push(add(cart, cyl(0.06, 0.06, 0.04, 8), '#1a1033', x, 0.07, z));
  for (const w of wheels) w.rotation.z = Math.PI / 2;
  return { root, body, legs: L, extra: { cart, wheels } };
};

// La taupe : une butte qui file sous la terre, puis une tête qui surgit… et un cadeau en moins.
MODELS.mole = function () {
  const root = new THREE.Group();
  const mound = add(root, new THREE.SphereGeometry(0.38, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#7a4a26', 0, 0, 0, 1, 0.55, 1);
  for (let k = 0; k < 6; k++) { const a = k * 1.1; add(mound, sph(0.06, 6, 4), '#5a3418', Math.cos(a) * 0.3, 0.12, Math.sin(a) * 0.3); }
  const body = joint(root, 0, -0.7);
  add(body, cap(0.2, 0.25), '#5a3a2a', 0, 0.35);
  const head = joint(body, 0, 0.66);
  add(head, sph(0.19), '#5a3a2a');
  add(head, sph(0.06, 8, 6), '#ff8ab0', 0, -0.02, 0.19);
  for (const s of [-1, 1]) add(head, new THREE.BoxGeometry(0.1, 0.06, 0.02), '#1a1033', s * 0.07, 0.07, 0.17);
  add(head, new THREE.BoxGeometry(0.04, 0.02, 0.02), '#1a1033', 0, 0.08, 0.18);
  for (const s of [-1, 1]) add(body, sph(0.08, 8, 6), '#ffb0c8', s * 0.2, 0.45, 0.12, 1.2, 0.6, 0.8);
  const loot = add(body, new THREE.BoxGeometry(0.2, 0.2, 0.2), '#ff8ad8', 0.22, 0.55, 0.1);
  loot.visible = false;
  return { root, body, extra: { mound, loot } };
};

// Les poulets artilleurs : ils gardent leurs distances et tirent des œufs au mortier.
MODELS.chicken = function () {
  const root = new THREE.Group(), body = joint(root);
  const L = legs(body, '#ffb020', 0.26, 0.07, 0.16, '#ffb020');
  add(body, sph(0.28), '#ffffff', 0, 0.46, 0, 1, 0.9, 1.2);
  add(body, new THREE.ConeGeometry(0.14, 0.3, 6), '#f4f4f4', 0, 0.6, -0.32).rotation.x = -0.9;
  const head = joint(body, 0, 0.8, 0.16);
  add(head, sph(0.15), '#ffffff');
  for (let k = 0; k < 3; k++) add(head, sph(0.045, 6, 4), '#e8281f', 0, 0.15 + (k === 1 ? 0.02 : 0), -0.04 + k * 0.05);
  add(head, new THREE.ConeGeometry(0.05, 0.12, 4), '#ffb020', 0, -0.01, 0.17).rotation.x = Math.PI / 2;
  add(head, sph(0.035, 6, 4), '#e8281f', 0, -0.08, 0.12, 1, 1.4, 1);
  eyes(head, 0.04, 0.12, 0.08, 0.025);
  const mortar = joint(body, 0.42, 0, 0);
  add(mortar, cyl(0.16, 0.18, 0.1), '#4a4f63', 0, 0.05, 0);
  const tube = add(mortar, cyl(0.08, 0.1, 0.5, 10), '#3f5a3a', 0, 0.3, 0.05);
  tube.rotation.x = 0.6;
  return { root, body, legs: L, extra: { head, tube } };
};

// Le Père Noël : il distribue des cadeaux… à qui s'approche sur la pointe des pieds.
MODELS.santa = function () {
  const root = new THREE.Group(), body = joint(root);
  const L = legs(body, '#c81e2a', 0.36, 0.1, 0.28, '#1a1033');
  add(body, cyl(0.3, 0.36, 0.62), '#c81e2a', 0, 0.72);
  add(body, sph(0.3), '#c81e2a', 0, 0.78, 0.08, 1, 1, 0.9);
  add(body, cyl(0.37, 0.37, 0.07), '#1a1033', 0, 0.62);
  add(body, new THREE.BoxGeometry(0.12, 0.1, 0.04), '#ffcf3a', 0, 0.62, 0.37);
  const head = joint(body, 0, 1.22);
  add(head, sph(0.2), '#f6c9a8');
  add(head, sph(0.2, 12, 8), '#ffffff', 0, -0.13, 0.08, 1.1, 1.1, 0.8);
  add(head, sph(0.05, 8, 6), '#ff9a8a', 0, 0.0, 0.2);
  eyes(head, 0.06, 0.18, 0.07, 0.025);
  add(head, new THREE.ConeGeometry(0.19, 0.38, 12), '#c81e2a', 0, 0.3, -0.02).rotation.x = -0.25;
  add(head, new THREE.TorusGeometry(0.19, 0.04, 6, 16), '#ffffff', 0, 0.13, 0).rotation.x = Math.PI / 2;
  add(head, sph(0.06, 8, 6), '#ffffff', 0, 0.48, -0.12);
  add(body, sph(0.3, 12, 8), '#8a5a2a', 0, 1.0, -0.36, 1, 1.1, 0.8);
  for (const s of [-1, 1]) { const a = joint(body, s * 0.34, 1.0, 0); add(a, cap(0.07, 0.25), '#c81e2a', 0, -0.17, 0); add(a, sph(0.07, 8, 6), '#ffffff', 0, -0.36, 0); }
  return { root, body, legs: L };
};

// Les pièces fixes d'un même groupe (corps, tête…) sont fusionnées en un seul maillage coloré par sommet :
// beaucoup moins d'objets à dessiner. Celles qui s'animent seules (m.extra) et les transparentes restent à part.
const VC = new THREE.MeshLambertMaterial({ vertexColors: true });
function mergeStatic(m) {
  const keep = new Set();
  const walk = (v) => { if (!v) return; if (v.isObject3D) keep.add(v); else if (Array.isArray(v)) v.forEach(walk); else if (typeof v === 'object' && !(v instanceof THREE.Material)) Object.values(v).forEach(walk); };
  walk(m.extra);
  const groups = [];
  m.root.traverse((o) => groups.push(o));
  for (const parent of groups) {
    const leaves = parent.children.filter((c) => c.isMesh && !keep.has(c) && !c.children.length && c.material?.isMeshLambertMaterial
      && !c.material.transparent && !c.material.map && !c.material.vertexColors && c.material.side !== THREE.DoubleSide);
    if (leaves.length < 2) continue;
    const geos = leaves.map((c) => {
      c.updateMatrix();
      let g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
      g.applyMatrix4(c.matrix);
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      const n = g.attributes.position.count, col = new Float32Array(n * 3), cc = c.material.color;
      for (let i = 0; i < n; i++) col.set([cc.r, cc.g, cc.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    });
    const merged = new THREE.Mesh(mergeGeometries(geos), VC);
    merged.castShadow = true;
    for (const c of leaves) parent.remove(c);
    parent.add(merged);
  }
  return m;
}

// anneaux au sol : rouge quand il va charger, jaune quand une tomate le vise
const WARN_MAT = new THREE.MeshBasicMaterial({ color: '#ff2a3a', transparent: true, opacity: 0.8, depthWrite: false });
const AIM_MAT = new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.75, depthWrite: false });
const WARN = 0.55; // secondes d'arrêt, le temps du « ! », avant de charger
function addRing(m) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 20), WARN_MAT);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.visible = false; ring.renderOrder = 2;
  m.root.add(ring);
  m.ring = ring;
  return m;
}

// libère la géométrie d'un terrien retiré (les matériaux partagés restent ; ceux du croque-mitaine lui sont propres)
function disposeModel(e) {
  e.m.root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); if (e.type === 'boogey' && ![VC, WARN_MAT, AIM_MAT].includes(o.material)) o.material.dispose(); } });
}

const MODEL_OF = { dentist: 'dentist', nerds: 'nerd', hamster: 'hamster', cupid: 'cupid', devil: 'devil', opera: 'opera', wiseman: 'wiseman', hula: 'hula',
  boogey: 'boogey', mower: 'mower', cart: 'cart', mole: 'mole', chickens: 'chicken', santa: 'santa' };
// terriens qui vont en bande (combien au départ)
const GROUP = { nerds: 4, chickens: 2 };
// à quelle vitesse ils corrigent leur direction (les engins tournent mal)
const TURN = { hamster: 1.5, mower: 1.6, cart: 1.1 };
const EGG = { type: 'egg', def: { knock: 3, sound: 'oeuf', dmg: 6 } };

export class Earthlings {
  constructor(scene) { this.scene = scene; this.list = []; this.levels = new Set(); this.eggs = []; }

  clear() {
    for (const e of this.list) { this.scene.remove(e.m.root); disposeModel(e); }
    for (const o of this.eggs) { this.scene.remove(o.mesh); this.scene.remove(o.ring); o.mesh.geometry.dispose(); o.ring.geometry.dispose(); o.ring.material.dispose(); }
    this.list = []; this.eggs = []; this.levels = new Set();
  }

  // Les terriens vivent sur les étages où se trouvent les joueurs, et seulement ceux-là.
  sync(world, levels) {
    const want = new Set(levels);
    for (const k of [...this.levels]) if (!want.has(k)) this.dropLevel(k);
    for (const k of want) if (!this.levels.has(k)) this.spawnLevel(world, k);
  }

  setLevel(world, k) { this.clear(); this.spawnLevel(world, k); }

  dropLevel(k) {
    for (const e of this.list) if (e.level === k) { this.scene.remove(e.m.root); disposeModel(e); }
    for (const o of this.eggs) if (o.level === k) { this.scene.remove(o.mesh); this.scene.remove(o.ring); o.mesh.geometry.dispose(); o.ring.geometry.dispose(); o.ring.material.dispose(); }
    this.list = this.list.filter((e) => e.level !== k);
    this.eggs = this.eggs.filter((o) => o.level !== k);
    this.levels.delete(k);
  }

  // Avant de dessiner une vue : seuls les terriens de l'étage de cette vue (null : tous) sont visibles.
  showLevel(k) {
    for (const e of this.list) e.m.root.visible = e.shown && (k === null || e.level === k);
    for (const o of this.eggs) o.mesh.visible = o.ring.visible = o.shown && (k === null || o.level === k);
  }

  // Fait apparaître les terriens d'un étage.
  spawnLevel(world, k) {
    this.levels.add(k);
    const L = world.levels[k];
    for (const item of L.data.earthlings) {
      if (item.gone) continue;
      const n = GROUP[item.type] ? item.left ?? GROUP[item.type] : 1;
      item.left = n;
      for (let i = 0; i < n; i++) {
        const m = addRing(mergeStatic(MODELS[MODEL_OF[item.type]]()));
        if (item.type === 'nerds') m.root.scale.setScalar(0.9);
        const pos = new THREE.Vector3(item.x + (i % 2) * 0.8 - 0.4, L.y, item.z + Math.floor(i / 2) * 0.8 - 0.4);
        m.root.position.copy(pos);
        this.scene.add(m.root);
        this.list.push({ item, level: k, type: item.type, def: EARTHLINGS[item.type], m, pos, home: pos.clone(), dir: { x: 0, z: 1 }, target: null,
          state: 'wander', t: Math.random() * 5, cool: 0, idx: i, roll: 0, singT: 0, noise: 0 });
      }
    }
  }

  // Le terrien amical tout proche (le sage), s'il y en a un.
  friendNear(pos) {
    return this.list.find((e) => e.type === 'wiseman' && Math.abs(e.pos.y - pos.y) < 2 && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < 1.6) || null;
  }

  // Retire un terrien (tomate, ou sage qui s'en va) avec un nuage de fumée.
  poof(e, fx) {
    this.scene.remove(e.m.root);
    disposeModel(e);
    this.list = this.list.filter((x) => x !== e);
    fx.dust(e.pos, 18, ['#ffffff', '#d9d9e6', '#b9b0de']);
    sound.play('poof');
    if (GROUP[e.type]) { e.item.left -= 1; if (e.item.left <= 0) e.item.gone = true; }
    else e.item.gone = true;
    // la taupe touchée rend ce qu'elle avait chapardé
    if (e.loot?.length && this.g) {
      for (const t of e.loot) (e.lootOwner?.bag || this.g.bag).add(t);
      this.g.hud.toast(e.loot.length > 1 ? `LA TAUPE REND SON BUTIN : ${e.loot.length} CADEAUX.` : 'LA TAUPE REND LE CADEAU.');
    }
  }

  // Une tomate touche-t-elle quelqu'un ? Renvoie le terrien touché.
  hit(pos) {
    const e = this.list.find((e) => !e.def.friendly && (e.type !== 'mole' || e.upT > 0) && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < 0.8 && Math.abs(e.pos.y + (e.def.flies ? 1.5 : 0.6) - pos.y) < 1.2);
    return e || null;
  }

  ok(world, k, x, z) {
    const t = world.type(k, x, z);
    return t && t !== T.WATER;
  }

  // œuf tiré au mortier : une cloche jusqu'à la position prévue du joueur, un cercle rouge prévient
  fire(e, p, g) {
    const from = new THREE.Vector3(e.pos.x + 0.4, e.pos.y + 0.6, e.pos.z);
    const to = new THREE.Vector3(p.pos.x + (p.vx || 0) * 0.3, p.pos.y, p.pos.z + (p.vz || 0) * 0.3);
    const mesh = new THREE.Mesh(sph(0.1, 10, 8), mat('#fffaf0'));
    mesh.scale.set(1, 1.3, 1);
    mesh.castShadow = true;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 24), new THREE.MeshBasicMaterial({ color: '#ff4a5c', transparent: true, opacity: 0.6, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(to.x, to.y + 0.05, to.z);
    this.scene.add(mesh, ring);
    this.eggs.push({ mesh, ring, from, to, t: 0, T: 1.15, level: e.level, shown: true });
    sound.play('poulet', { vol: 0.7 });
  }

  updateEggs(dt, g, targets) {
    this.eggs = this.eggs.filter((o) => {
      o.t += dt;
      const k = Math.min(1, o.t / o.T);
      o.mesh.position.lerpVectors(o.from, o.to, k);
      o.mesh.position.y += Math.sin(k * Math.PI) * 3;
      o.mesh.rotation.x += dt * 10;
      o.ring.scale.setScalar(0.4 + 0.6 * k);
      o.ring.material.opacity = 0.25 + 0.5 * k;
      if (k < 1) return true;
      this.scene.remove(o.mesh); this.scene.remove(o.ring);
      o.mesh.geometry.dispose(); o.ring.geometry.dispose(); o.ring.material.dispose();
      g.fx.dust(o.to, 14, ['#fffaf0', '#ffe14a', '#ffd23f']);
      let touched = false;
      for (const q of targets) {
        if (q.level !== o.level) continue;
        const dx = q.pos.x - o.to.x, dz = q.pos.z - o.to.z, d = Math.hypot(dx, dz);
        if (d < 0.95) { touched = true; g.hurt(EGG, dx / (d || 1), dz / (d || 1), q); }
      }
      if (!touched) sound.play('oeuf', { vol: 0.8 });
      return false;
    });
  }

  update(dt, g) {
    this.g = g;
    const world = g.world;
    const visible = !g.seq && g.state !== 'title';
    const allTargets = g.players.filter((q) => q.visible && q.control && q.active);
    const running = visible && g.state === 'play' && !g.menu && allTargets.length > 0;
    for (const o of this.eggs) o.mesh.visible = o.ring.visible = o.shown = visible;
    if (running) this.updateEggs(dt, g, allTargets);
    const leaving = [];
    for (const e of this.list) {
      e.m.root.visible = e.shown = visible;
      const L = world.levels[e.level];
      const targets = allTargets.filter((q) => q.level === e.level);
      if (!running || !targets.length) continue;
      // chacun s'intéresse au joueur le plus proche
      let p = targets[0];
      for (const q of targets) if (Math.hypot(q.pos.x - e.pos.x, q.pos.z - e.pos.z) < Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z)) p = q;
      const d = e.def, dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, dist = Math.hypot(dx, dz);
      e.t += dt; e.cool = Math.max(0, e.cool - dt);
      e.dist = dist;
      let speed = d.speed, tx, tz;
      // après un coup, il s'arrête (le dentiste ricane) : de quoi s'échapper
      if (e.pauseT > 0) { e.pauseT -= dt; e.moving = false; e.dir = { x: dx / (dist || 1), z: dz / (dist || 1) }; continue; }
      // sur la piste de disco, plus personne ne charge : on tourne sur soi en rythme
      if (e.danceT > 0) {
        e.danceT -= dt; e.dancing = true; e.moving = true; e.state = 'wander';
        e.dir = { x: Math.sin(g.t * 5 + e.idx), z: Math.cos(g.t * 5 + e.idx) };
        continue;
      }
      e.dancing = false;
      // le « ! » : il s'arrête, regarde sa cible, puis charge
      if (e.warnT > 0) { e.warnT -= dt; e.moving = false; e.dir = { x: dx / (dist || 1), z: dz / (dist || 1) }; continue; }
      const sight = d.sight * (p.sneaking ? 0.5 : 1);
      if (!d.friendly && e.state === 'wander' && dist < sight && !(e.bored > 0)) {
        e.state = 'chase';
        if (e.type !== 'opera') e.warnT = WARN;
        g.onCharge?.(e, p);
        if (e.noise <= 0) { sound.play(d.sound, { vol: 0.7 }); e.noise = 4; }
      } else if (e.state === 'chase' && (dist > sight * 1.4 || e.chaseT > 7)) {
        // trop loin, ou lassé de courir : il retourne flâner un moment
        e.state = 'wander'; e.bored = 3;
      }
      e.chaseT = e.state === 'chase' ? (e.chaseT || 0) + dt : 0;
      e.bored = Math.max(0, (e.bored || 0) - dt);
      if (e.bored > 0 && e.state === 'chase') e.state = 'wander';
      e.noise -= dt;
      // les engins font du bruit tant qu'ils chargent
      if ((e.type === 'mower' || e.type === 'cart') && e.state === 'chase' && e.noise <= 0) { sound.play(d.sound, { vol: 0.6 }); e.noise = 2.4; }

      // le Père Noël : on l'approche en douce et il donne deux cadeaux ; sinon il s'envole
      if (e.type === 'santa') {
        if (e.lift !== undefined) { e.lift += dt * (2 + e.lift * 3); if (e.lift > 14) leaving.push(e); this.animate1(e, g.t); continue; }
        if (dist < 1.7 && p.sneaking) {
          for (let k = 0; k < 2; k++) (p.bag || g.bag).add(rollPresent(Math.random));
          g.hud.showCard('HO HO HO !', 'LE PÈRE NOËL A GLISSÉ DEUX CADEAUX DANS LE SAC.');
          g.fx.sparkle(e.pos.clone().add(new THREE.Vector3(0, 1, 0)), '#ffe680', 30, 1);
          sound.play('perenoel');
          p.emote('joie', 2);
          e.lift = 0; e.item.gone = true;
          continue;
        }
        if (dist < 3.3 && !p.sneaking) {
          g.hud.toast('TROP BRUYANT ! LE PÈRE NOËL FILE. (MAJ)');
          sound.play('perenoel', { rate: 1.15 });
          e.lift = 0; e.item.gone = true;
          continue;
        }
      }

      // la taupe : file sous terre, surgit au contact, chaparde un cadeau, puis se sauve
      let custom = false;
      if (e.type === 'mole') {
        custom = true;
        const wasUp = e.upT > 0;
        e.upT = Math.max(0, (e.upT || 0) - dt);
        e.fleeT = Math.max(0, (e.fleeT || 0) - dt);
        if (wasUp && e.upT <= 0) e.fleeT = 3;
        if (e.fleeT > 0) { tx = e.pos.x - (dx / (dist || 1)) * 4; tz = e.pos.z - (dz / (dist || 1)) * 4; speed = 5; }
        else if (e.upT > 0) speed = 0;
        else if (e.state === 'chase') { tx = p.pos.x; tz = p.pos.z; speed = d.chase; }
        else custom = false;
        if (!e.fleeT && !e.upT && dist < 0.8 && e.cool <= 0) {
          e.upT = 0.9; e.cool = 6;
          sound.play('taupe');
          g.fx.dust(e.pos, 16, ['#7a4a26', '#5a3418', '#a07040']);
          const bag = p.bag || g.bag, items = bag.list();
          if (items.length) {
            const it = items[Math.floor(Math.random() * items.length)];
            bag.take(it.type);
            e.lootOwner = p;
            (e.loot ||= []).push(it.type);
            g.hud.toast(g.bag.known.has(it.type) ? `LA TAUPE A PIQUÉ : ${g.bag.label(it.type)} !` : 'LA TAUPE A PIQUÉ UN CADEAU !');
            p.emote('colere', 1.4);
          } else g.hurt(e, dx / (dist || 1), dz / (dist || 1), p);
        }
      }
      // les poulets : ni trop près, ni trop loin, et feu !
      if (e.type === 'chickens' && e.state === 'chase') {
        custom = true;
        const k = dist < 4 ? -1 : dist > 7.5 ? 1 : 0;
        if (k) { tx = e.pos.x + (dx / dist) * k * 3 + Math.cos(e.idx * 2) * 0.8; tz = e.pos.z + (dz / dist) * k * 3 + Math.sin(e.idx * 2) * 0.8; speed = d.chase; }
        else { speed = 0; e.dir = { x: dx / (dist || 1), z: dz / (dist || 1) }; }
        if (dist < 9.5 && e.cool <= 0) { e.cool = 3.4 + Math.random() * 1.6; this.fire(e, p, g); }
      }

      if (!custom) {
        if (e.type === 'opera') {
          // la cantatrice ne court pas : elle chante, et ça fait mal aux oreilles
          speed = dist < 6 ? 0 : d.speed;
          if (dist < 4.5) {
            if (e.singT <= 0 || e.singT > 3) { e.singT = 0.001; sound.play('cantatrice', { vol: 0.6 }); }
            e.singT += dt;
            g.damage(6 * dt, p);
            const push = 2.2 / Math.max(dist, 0.5);
            p.kick(dx / Math.max(dist, 0.01) * push * dt * 8, dz / Math.max(dist, 0.01) * push * dt * 8);
          } else e.singT = 0;
          e.dir = { x: dx / (dist || 1), z: dz / (dist || 1) };
        }
        if (e.type === 'cupid' && e.state === 'chase') {
          // Cupidon tourne autour de sa cible, puis pique dessus
          const a = e.t * 1.2 + e.idx, dive = (e.t % 4.5) > 3.8;
          tx = dive ? p.pos.x : p.pos.x + Math.cos(a) * 3; tz = dive ? p.pos.z : p.pos.z + Math.sin(a) * 3;
          speed = dive ? 4.6 : d.chase;
        } else if (e.state === 'chase' && e.type !== 'opera') {
          tx = p.pos.x; tz = p.pos.z; speed = d.chase;
          if (e.type === 'nerds') { const a = e.idx * 1.6 + e.t * 0.5; tx += Math.cos(a) * 0.5; tz += Math.sin(a) * 0.5; }
          if (e.type === 'hamster' || e.type === 'cart') {
            // la boule (et le caddie) foncent en ligne droite et ne visent à nouveau qu'au bout d'un moment
            e.roll -= dt;
            if (e.roll <= 0) {
              e.roll = e.type === 'cart' ? 1.7 : 1.1;
              // la dame au caddie fonce au hasard : elle ne vise le joueur qu'une fois sur trois
              if (e.type === 'cart' && Math.random() > 0.35) { const a = Math.random() * Math.PI * 2; e.dir = { x: Math.cos(a), z: Math.sin(a) }; }
              else { e.dir = { x: dx / (dist || 1), z: dz / (dist || 1) }; if (e.type === 'cart') e.warnT = 0.45; }
              if (e.type === 'hamster') sound.play('hamster', { vol: 0.5 });
            }
            tx = e.pos.x + e.dir.x * 5; tz = e.pos.z + e.dir.z * 5;
          }
        } else if (e.type !== 'opera') {
          if (!e.target || Math.hypot(e.target.x - e.pos.x, e.target.z - e.pos.z) < 0.3 || e.t > 6) {
            e.t = 0;
            const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 4;
            e.target = { x: e.home.x + Math.cos(a) * r, z: e.home.z + Math.sin(a) * r };
          }
          tx = e.target.x; tz = e.target.z; speed = d.speed * 0.6;
        }
      }
      if (tx !== undefined && speed > 0) {
        let vx = tx - e.pos.x, vz = tz - e.pos.z;
        const l = Math.hypot(vx, vz) || 1;
        vx /= l; vz /= l;
        // on s'écarte des copains
        for (const o of this.list) {
          if (o === e) continue;
          const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, od = Math.hypot(ox, oz);
          if (od < 0.7 && od > 0.001) { vx += (ox / od) * 0.8; vz += (oz / od) * 0.8; }
        }
        const l2 = Math.hypot(vx, vz) || 1;
        vx /= l2; vz /= l2;
        e.dir.x += (vx - e.dir.x) * Math.min(1, dt * (TURN[e.type] ?? 8));
        e.dir.z += (vz - e.dir.z) * Math.min(1, dt * (TURN[e.type] ?? 8));
        const nx = e.pos.x + e.dir.x * speed * dt, nz = e.pos.z + e.dir.z * speed * dt;
        if (d.flies || this.ok(world, e.level, nx, nz)) { e.pos.x = nx; e.pos.z = nz; e.moving = true; }
        else { e.target = null; e.moving = false; if (e.type === 'hamster' || e.type === 'cart') { e.dir.x *= -1; e.dir.z *= -1; e.roll = 0.6; } }
        // la tondeuse laisse de l'herbe coupée derrière elle
        if (e.type === 'mower' && e.moving && e.state === 'chase' && Math.random() < dt * 14) g.fx.dust(e.pos, 2, ['#5fcf5a', '#3fae4a', '#8be06a']);
      } else e.moving = false;
      const ty = world.type(e.level, e.pos.x, e.pos.z);
      e.pos.y = L.y + (ty ? topOf(ty) : 0);

      // contact
      const reach = { hamster: 0.85, cupid: 0.9, mower: 1.0, cart: 1.0 }[e.type] ?? 0.7;
      if (!d.friendly && !['opera', 'mole', 'chickens'].includes(e.type) && dist < reach && e.cool <= 0) {
        e.cool = 1.6;
        e.pauseT = e.type === 'dentist' ? 1.8 : e.type === 'cart' || e.type === 'hamster' ? 0 : 0.9;
        g.hurt(e, dx / (dist || 1), dz / (dist || 1), p);
        if (e.type === 'hamster' || e.type === 'cart') { e.dir.x *= -1; e.dir.z *= -1; e.roll = 0.8; }
      }
    }
    // le Père Noël a disparu dans le ciel
    for (const e of leaving) { this.scene.remove(e.m.root); disposeModel(e); this.list = this.list.filter((x) => x !== e); }
    if (visible) this.animate(g.t);
  }

  animate(t) {
    WARN_MAT.opacity = 0.55 + 0.35 * Math.sin(t * 22);
    for (const e of this.list) this.animate1(e, t);
  }

  animate1(e, t) {
    {
      const m = e.m, ph = t * 9 + e.idx;
      m.root.position.copy(e.pos);
      if (m.ring) {
        const w = e.warnT > 0, a = !w && e.aimed;
        m.ring.visible = w || a;
        if (w) { m.ring.material = WARN_MAT; m.ring.scale.setScalar(1.5 - e.warnT); }
        else if (a) { m.ring.material = AIM_MAT; m.ring.scale.setScalar(1 + Math.sin(t * 8) * 0.08); }
      }
      if (e.dancing) m.root.position.y += Math.abs(Math.sin(t * 7 + e.idx)) * 0.18;
      if (e.type !== 'hamster') m.root.rotation.y = Math.atan2(e.dir.x, e.dir.z);
      if (m.legs) m.legs.forEach((l, i) => { l.rotation.x = e.moving ? Math.sin(ph + i * Math.PI) * 0.7 : 0; });
      switch (e.type) {
        case 'dentist': m.extra.bit.rotation.y = t * 40; m.body.position.y = e.moving ? Math.abs(Math.sin(ph)) * 0.05 : 0; break;
        case 'nerds': m.body.rotation.z = Math.sin(ph * 0.5) * 0.08; break;
        case 'hamster': {
          const sp = e.moving ? 1 : 0;
          m.extra.ball.rotation.set(t * 6 * sp, Math.atan2(e.dir.x, e.dir.z), 0);
          m.extra.inner.rotation.y = Math.atan2(e.dir.x, e.dir.z);
          m.extra.inner.position.y = Math.abs(Math.sin(t * 14)) * 0.04 * sp;
          break;
        }
        case 'cupid': m.body.position.y = 1.5 + Math.sin(t * 3 + e.idx) * 0.15; m.extra.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 18) * 0.6; }); break;
        case 'devil': m.body.position.y = Math.abs(Math.sin(t * 7)) * 0.18; m.extra.fork.rotation.x = Math.sin(t * 7) * 0.3; break;
        case 'opera': {
          const sing = e.singT > 0;
          m.extra.mouth.scale.setScalar(sing ? 1.6 + Math.sin(t * 20) * 0.3 : 0.6);
          m.extra.ring.visible = sing;
          const s = 1 + ((t * 2) % 1) * 3.5;
          m.extra.ring.scale.setScalar(s); m.extra.ring.material.opacity = 0.7 * (1 - (s - 1) / 3.5);
          break;
        }
        case 'wiseman': m.body.rotation.z = Math.sin(t * 1.2) * 0.05; break;
        case 'boogey': {
          // invisible de loin (seuls les yeux luisent), il se révèle en approchant
          const a = Math.min(1, Math.max(0, (3.4 - (e.dist ?? 99)) / 1.6));
          m.extra.fur.opacity = 0.03 + a * 0.97;
          m.extra.fur.depthWrite = a > 0.6;
          m.extra.glow.opacity = 0.35 + a * 0.65;
          m.extra.arms.forEach((j, i) => { j.rotation.x = -0.5 + Math.sin(t * 5 + i * Math.PI) * 0.5; });
          m.body.position.y = Math.sin(t * 3) * 0.05;
          break;
        }
        case 'mower':
          m.extra.blade.rotation.y = t * 50;
          m.body.position.y = e.moving ? Math.sin(t * 60) * 0.012 : 0;
          break;
        case 'cart':
          m.extra.wheels.forEach((w) => { w.rotation.x = e.moving ? t * 20 : 0; });
          m.body.rotation.x = e.moving && e.state === 'chase' ? 0.15 : 0;
          break;
        case 'mole': {
          const up = e.upT > 0 ? Math.min(1, (0.9 - e.upT) * 8) : 0;
          m.body.position.y = -0.7 + up * 0.75;
          m.extra.loot.visible = up > 0.5 && !!e.loot?.length;
          m.extra.mound.scale.y = 0.55 + (e.moving ? Math.abs(Math.sin(t * 16)) * 0.15 : 0);
          m.extra.mound.rotation.y = t * (e.moving ? 4 : 0.5);
          break;
        }
        case 'chickens':
          m.extra.head.position.z = 0.16 + Math.max(0, Math.sin(t * 12 + e.idx * 2)) * 0.06;
          m.extra.tube.scale.y = e.cool > 2.2 ? 0.85 : 1;
          break;
        case 'santa':
          if (e.lift !== undefined) { m.root.position.y += e.lift; m.root.rotation.y += t * 0.1; }
          m.body.rotation.z = Math.sin(t * 2) * 0.05;
          break;
        case 'hula':
          m.body.rotation.z = Math.sin(t * 4 + e.idx) * 0.12;
          m.extra.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (1.2 + Math.sin(t * 4 + i * Math.PI) * 0.4); a.rotation.x = Math.sin(t * 2) * 0.3; });
          break;
      }
    }
  }
}
