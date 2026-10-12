// Les terriens : modèles en volumes et comportements.
// Chacun erre près de chez lui, repère ToeJam à la vue (deux fois moins loin s'il marche sur
// la pointe des pieds), le poursuit à sa façon, et le bouscule au contact.
// Un rosier ne les intéresse pas, un leurre en carton les attire tous.
// Une tomate (ou un caillou) bien placée les fait déguerpir.
// La plupart dorment : on passe à côté sur la pointe des pieds. Quelques-uns vivent à leur façon : le requin
// dans l'eau, la tornade au gré du vent, le camion de glaces sur la route.
import * as THREE from 'three';
import { EARTHLINGS, rollPresent } from './catalog.js';
import { T, cellX } from './gen.js';
import { WATER_Y } from './config.js';
import { topOf } from './terrain3d.js';
import { sound } from './audio.js';
import { FallSeq, UnfallSeq, separate } from './sequences.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeTerrien, animateTerrien, disposeTerrien } from './terrien3d.js';

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

// matières partagées des nouveaux venus (transparentes : jamais fusionnées)
const FOAM_MAT = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false });
const WIND_MAT = new THREE.MeshLambertMaterial({ color: '#e4e8ff', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
const WING_MAT = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false });

// Le requin : sous l'eau, on ne voit que l'aileron qui tourne ; il ne sort la tête que pour mordre.
// La racine est au fond du lac, la surface à 0,34 au-dessus.
MODELS.shark = function () {
  const root = new THREE.Group(), body = joint(root);
  const fish = joint(body, 0, 0.12, 0);
  add(fish, sph(0.32, 16, 10), '#5a6f9a', 0, 0, 0, 1, 0.75, 2.0);
  add(fish, sph(0.28, 14, 8), '#eef2fa', 0, -0.08, 0.12, 0.9, 0.55, 1.7);
  for (const s of [-1, 1]) {
    add(fish, sph(0.085, 10, 8), '#ffffff', s * 0.18, 0.09, 0.42);
    add(fish, sph(0.045, 8, 6), '#1a1033', s * 0.2, 0.1, 0.48);
    add(fish, new THREE.ConeGeometry(0.1, 0.3, 3), '#4a5f8a', s * 0.3, -0.08, 0.05, 0.3, 1, 1).rotation.z = s * 1.9;
  }
  for (let k = 0; k < 6; k++) add(fish, new THREE.ConeGeometry(0.026, 0.08, 4), '#ffffff', -0.12 + k * 0.048, -0.04, 0.56).rotation.x = Math.PI;
  const jaw = joint(fish, 0, -0.08, 0.36);
  add(jaw, sph(0.16, 12, 8), '#8a1a2a', 0, 0, 0.1, 1.2, 0.4, 0.9);
  for (let k = 0; k < 5; k++) add(jaw, new THREE.ConeGeometry(0.024, 0.07, 4), '#ffffff', -0.1 + k * 0.05, 0.05, 0.2);
  const tail = joint(fish, 0, 0.02, -0.6);
  add(tail, new THREE.ConeGeometry(0.2, 0.42, 3), '#5a6f9a', 0, 0.14, -0.1, 0.3, 1, 1).rotation.x = -0.7;
  add(tail, new THREE.ConeGeometry(0.14, 0.3, 3), '#5a6f9a', 0, -0.1, -0.08, 0.3, 1, 1).rotation.x = -2.4;
  // l'aileron : une lame triangulaire qui dépasse de l'eau
  const fin = add(body, new THREE.ConeGeometry(0.34, 0.85, 3), '#8296c0', 0, 0.68, -0.06, 0.32, 1, 1);
  fin.rotation.x = -0.25;
  const foam = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.52, 16), FOAM_MAT);
  foam.rotation.x = -Math.PI / 2; foam.position.y = 0.36; foam.renderOrder = 2;
  root.add(foam);
  return { root, body, extra: { fish, jaw, tail, fin, foam } };
};

// Le sorcier : robe étoilée, chapeau pointu, barbe blanche. Un billet, et toute l'énergie revient.
MODELS.wizard = function () {
  const root = new THREE.Group(), body = joint(root);
  add(body, new THREE.ConeGeometry(0.42, 1.0, 14), '#3a3ab8', 0, 0.5);
  add(body, cyl(0.43, 0.43, 0.06, 14), '#ffd23f', 0, 0.04);
  for (const [x, y, z] of [[0.17, 0.42, 0.26], [-0.2, 0.25, 0.3], [0.06, 0.72, 0.15], [-0.11, 0.56, 0.2], [0.27, 0.14, 0.3], [-0.3, 0.1, 0.26]]) add(body, new THREE.OctahedronGeometry(0.045), '#ffe36b', x, y, z);
  const head = joint(body, 0, 1.12);
  add(head, sph(0.2), '#f0c39a');
  add(head, new THREE.ConeGeometry(0.19, 0.45, 10), '#f4f4f4', 0, -0.22, 0.1).rotation.x = Math.PI + 0.3;
  add(head, sph(0.12, 10, 8), '#f4f4f4', 0, -0.08, 0.13, 1.3, 0.6, 0.8);
  add(head, sph(0.05, 8, 6), '#ff9a8a', 0, 0.0, 0.21);
  for (const s of [-1, 1]) { add(head, sph(0.06, 10, 8), '#ffffff', s * 0.08, 0.07, 0.16); add(head, sph(0.032, 8, 6), '#1a1033', s * 0.08, 0.07, 0.215); }
  add(head, cyl(0.34, 0.34, 0.04, 16), '#2a2a8a', 0, 0.13, 0);
  add(head, new THREE.ConeGeometry(0.22, 0.62, 12), '#2a2a8a', 0, 0.44, -0.05).rotation.x = -0.2;
  add(head, new THREE.OctahedronGeometry(0.06), '#ffe36b', 0.04, 0.4, 0.15);
  const arm = joint(body, 0.3, 0.85, 0.05);
  add(arm, cap(0.07, 0.25), '#3a3ab8', 0, -0.12, 0.1).rotation.x = -0.9;
  const wand = joint(arm, 0, -0.2, 0.28);
  add(wand, cyl(0.02, 0.02, 0.5, 6), '#5a3a22', 0, 0.2, 0);
  const tip = add(wand, sph(0.07, 10, 8), '#fff6a0', 0, 0.48, 0, 1, 1, 1, { emissive: '#ffb020' });
  return { root, body, extra: { arm, tip } };
};

// La tornade : un entonnoir de vent qui tourne, des débris qui volent autour, et deux gros yeux furieux.
MODELS.tornado = function () {
  const root = new THREE.Group(), body = joint(root);
  const rings = [];
  for (let k = 0; k < 7; k++) {
    const j = joint(body, 0, 0.15 + k * 0.32, 0);
    const ring = add(j, new THREE.TorusGeometry(0.18 + k * 0.13, 0.07 + k * 0.012, 6, 14), k % 2 ? '#a9b2e0' : '#e8ebff', 0.03 * k);
    ring.rotation.x = Math.PI / 2;
    rings.push(j);
  }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.14, 2.2, 14, 1, true), WIND_MAT);
  core.position.y = 1.15;
  body.add(core);
  const face = joint(body, 0, 1.25, 0);
  for (const s of [-1, 1]) {
    add(face, sph(0.14, 12, 8), '#ffffff', s * 0.17, 0, 0.6);
    add(face, sph(0.07, 8, 6), '#1a1033', s * 0.15, -0.01, 0.72);
    add(face, new THREE.BoxGeometry(0.22, 0.05, 0.05), '#3a3a6a', s * 0.17, 0.15, 0.66).rotation.z = s * 0.4;
  }
  const debris = [];
  ['#7a4a26', '#5fcf5a', '#ff4a5c', '#ffd23f', '#3fae4a', '#9aa3c0'].forEach((c, k) => {
    const j = joint(body, 0, 0.35 + k * 0.32, 0);
    add(j, new THREE.BoxGeometry(0.12, 0.12, 0.12), c, 0.45 + k * 0.1, 0, 0).rotation.set(k, k * 2, 0);
    debris.push(j);
  });
  return { root, body, extra: { rings, core, face, debris } };
};

// L'essaim : cinq à sept abeilles qui tournoient autour d'un point.
MODELS.bees = function () {
  const root = new THREE.Group(), body = joint(root, 0, 0.95, 0), bees = [];
  const n = 5 + Math.floor(Math.random() * 3);
  for (let k = 0; k < n; k++) {
    const b = joint(body);
    add(b, sph(0.11, 10, 8), '#ffd23f', 0, 0, 0, 1, 0.9, 1.3);
    add(b, cyl(0.105, 0.105, 0.04, 10), '#1a1033', 0, 0, -0.03).rotation.x = Math.PI / 2;
    add(b, cyl(0.085, 0.085, 0.04, 10), '#1a1033', 0, 0, -0.1).rotation.x = Math.PI / 2;
    add(b, new THREE.ConeGeometry(0.025, 0.07, 4), '#1a1033', 0, 0, -0.17).rotation.x = -Math.PI / 2;
    for (const s of [-1, 1]) { add(b, sph(0.04, 8, 6), '#ffffff', s * 0.05, 0.04, 0.11); add(b, sph(0.02, 6, 4), '#1a1033', s * 0.055, 0.045, 0.145); }
    const wings = [-1, 1].map((s) => { const w = joint(b, s * 0.05, 0.09, 0); add(w, sph(0.08, 8, 6), WING_MAT, s * 0.07, 0, 0, 1, 0.15, 0.6); return w; });
    b.userData = { r: 0.28 + Math.random() * 0.3, sp: 3 + Math.random() * 3, ph: Math.random() * 6.28, h: Math.random() * 0.3 - 0.1, wings };
    bees.push(b);
  }
  return { root, body, extra: { bees } };
};

// Le camion de glaces : il suit la route, fait demi-tour au bout, et ne freine pour personne.
MODELS.truck = function () {
  const root = new THREE.Group(), body = joint(root);
  add(body, new THREE.BoxGeometry(1.0, 0.85, 1.25), '#fff3f8', 0, 0.78, -0.28);
  add(body, new THREE.BoxGeometry(1.02, 0.14, 1.27), '#ff8ad8', 0, 0.56, -0.28);
  add(body, new THREE.BoxGeometry(1.02, 0.08, 1.27), '#6fd6ff', 0, 1.0, -0.28);
  add(body, new THREE.BoxGeometry(0.03, 0.3, 0.6), '#5a3a6a', 0.51, 0.84, -0.28);
  add(body, new THREE.BoxGeometry(0.03, 0.3, 0.6), '#5a3a6a', -0.51, 0.84, -0.28);
  add(body, new THREE.BoxGeometry(0.96, 0.62, 0.62), '#fff3f8', 0, 0.62, 0.62);
  add(body, new THREE.BoxGeometry(0.98, 0.1, 0.64), '#ff8ad8', 0, 0.42, 0.62);
  // le pare-brise fait la figure : deux gros yeux, une calandre qui sourit
  add(body, new THREE.BoxGeometry(0.82, 0.26, 0.04), '#9ad8ff', 0, 0.8, 0.93);
  for (const s of [-1, 1]) { add(body, sph(0.11, 10, 8), '#ffffff', s * 0.2, 0.8, 0.95, 1, 1, 0.5); add(body, sph(0.055, 8, 6), '#1a1033', s * 0.2, 0.79, 1.0); }
  add(body, new THREE.BoxGeometry(1.0, 0.1, 0.08), '#c8d0e0', 0, 0.3, 0.94);
  add(body, new THREE.BoxGeometry(0.42, 0.05, 0.03), '#1a1033', 0, 0.5, 0.94);
  for (const s of [-1, 1]) add(body, sph(0.06, 8, 6), '#ffe36b', s * 0.38, 0.5, 0.93);
  const cone = joint(body, 0, 1.25, -0.32);
  add(cone, new THREE.ConeGeometry(0.2, 0.5, 10), '#e0a050', 0, 0, 0).rotation.x = Math.PI;
  add(cone, sph(0.22, 12, 8), '#ffb0d8', 0, 0.3, 0);
  add(cone, sph(0.19, 12, 8), '#fff3e0', 0, 0.55, 0);
  add(cone, sph(0.07, 8, 6), '#ff2a3a', 0, 0.76, 0);
  const wheels = [];
  for (const [x, z] of [[-0.5, 0.58], [0.5, 0.58], [-0.5, -0.6], [0.5, -0.6]]) {
    const w = add(body, cyl(0.2, 0.2, 0.14, 12), '#1a1033', x, 0.2, z);
    w.rotation.z = Math.PI / 2;
    wheels.push(w);
  }
  return { root, body, extra: { cone, wheels } };
};

// La boîte aux lettres piégée : la même que celle où l'on commande, avec des dents, et elle mord.
MODELS.mailbox = function () {
  const root = new THREE.Group(), body = joint(root);
  add(body, new THREE.BoxGeometry(0.1, 0.75, 0.1), '#6b4a2e', 0, 0.37, 0);
  const box = joint(body, 0, 0.88, 0);
  add(box, new THREE.BoxGeometry(0.42, 0.16, 0.6), '#3a6fe8', 0, -0.07, 0);
  add(box, new THREE.BoxGeometry(0.36, 0.02, 0.52), '#8a1a2a', 0, 0.015, 0.02);
  for (let k = 0; k < 5; k++) add(box, new THREE.ConeGeometry(0.03, 0.08, 4), '#ffffff', -0.14 + k * 0.07, 0.05, 0.26);
  // le couvercle s'ouvre comme une mâchoire (charnière à l'arrière)
  const lid = joint(box, 0, 0.0, -0.3);
  add(lid, new THREE.BoxGeometry(0.42, 0.14, 0.6), '#3a6fe8', 0, 0.07, 0.3);
  add(lid, new THREE.CylinderGeometry(0.21, 0.21, 0.6, 14, 1, false, 0, Math.PI), '#3a6fe8', 0, 0.14, 0.3).rotation.set(Math.PI / 2, Math.PI / 2, 0);
  for (let k = 0; k < 5; k++) add(lid, new THREE.ConeGeometry(0.03, 0.08, 4), '#ffffff', -0.16 + k * 0.08, -0.02, 0.57).rotation.x = Math.PI;
  for (const s of [-1, 1]) { add(lid, sph(0.08, 10, 8), '#ffffff', s * 0.11, 0.33, 0.45); add(lid, sph(0.04, 8, 6), '#1a1033', s * 0.11, 0.34, 0.52); }
  const flag = joint(box, 0.23, 0.02, -0.1);
  add(flag, new THREE.BoxGeometry(0.03, 0.36, 0.05), '#ff4a5c', 0, 0.15, 0);
  add(flag, new THREE.BoxGeometry(0.03, 0.12, 0.16), '#ff4a5c', 0, 0.28, 0.08);
  return { root, body, extra: { lid, flag } };
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
  // modèle Blender : la géométrie est partagée entre tous les terriens du même type, on ne libère que l'anneau
  if (e.m.glb) {
    e.m.ring?.geometry.dispose();
    if (e.m.extra.ring) { e.m.extra.ring.geometry.dispose(); e.m.extra.ring.material.dispose(); }
    disposeTerrien(e.m);
    return;
  }
  e.m.root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); if (e.type === 'boogey' && ![VC, WARN_MAT, AIM_MAT].includes(o.material)) o.material.dispose(); } });
}

// effets propres à un terrien modélisé dans Blender, en plus de ses animations (voler, s'enfoncer sous terre…)
const GLB_FX = {
  // le hamster tourne dans sa boule, la boule roule
  hamster(m, e, t, dt) {
    const h = m.glb, ball = h.parts.Boule;
    // la boule transparente ne doit pas assombrir le hamster de son ombre
    if (ball && !h.ballInit) { h.ballInit = true; ball.traverse((o) => { o.castShadow = false; }); }
    h.scene.rotation.y = Math.atan2(e.dir.x, e.dir.z);
    if (ball && e.moving) { e.roll = (e.roll || 0) + dt * (e.state === 'chase' ? 5 : 2.5); ball.rotation.x = e.roll; }
  },
  // Cupidon vole
  cupid(m, e, t) { m.body.position.y = 1.5 + Math.sin(t * 3 + e.idx) * 0.15; },
  // la taupe file sous terre, ne sort que pour chaparder ; la butte reste au sol
  mole(m, e, t) {
    // sous terre, seul le casque à lampe dépasse de la butte ; elle surgit pour chaparder
    const h = m.glb, up = e.upT > 0 ? Math.min(1, (0.9 - e.upT) * 8) : 0, mound = h.parts.Butte, loot = h.parts.Butin, rig = h.parts.Rig;
    if (rig) { rig.userData.y ??= rig.position.y; rig.position.y = rig.userData.y - 0.47 * (1 - up); }
    if (mound) {
      mound.userData.sy ??= mound.scale.y;
      mound.scale.y = mound.userData.sy * (1 + (e.moving ? Math.abs(Math.sin(t * 16)) * 0.25 : 0));
      mound.rotation.y = t * (e.moving ? 4 : 0.5);
    }
    if (loot) loot.visible = up > 0.5 && !!e.loot?.length;
  },
  // le croque-mitaine : presque invisible de loin (les yeux luisent), il se révèle en approchant
  boogey(m, e) {
    const a = Math.min(1, Math.max(0, (3.4 - (e.dist ?? 99)) / 1.6));
    for (const x of m.glb.own) {
      x.transparent = true;
      if (/^Lueur/.test(x.name)) x.opacity = 0.35 + a * 0.65;
      else { x.opacity = 0.03 + a * 0.97; x.depthWrite = a > 0.6; }
    }
  },
  // la cantatrice : des ondes de voix quand elle chante
  opera(m, e, t) {
    if (!m.extra.ring) {
      m.extra.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: '#ff8ad8', transparent: true, opacity: 0.7, depthWrite: false }));
      m.extra.ring.rotation.x = Math.PI / 2; m.extra.ring.position.y = 1.4;
      m.root.add(m.extra.ring);
    }
    const ring = m.extra.ring, s = 1 + ((t * 2) % 1) * 3.5;
    ring.visible = e.singT > 0;
    ring.scale.setScalar(s); ring.material.opacity = 0.7 * (1 - (s - 1) / 3.5);
  },
  // les poulets : le temps du recul après un tir
  chickens(m, e, t, dt) { if (e.fireT > 0) e.fireT -= dt; },
  // le Père Noël s'envole
  santa(m, e, t) { if (e.lift !== undefined) { m.root.position.y += e.lift; m.root.rotation.y += t * 0.1; } },
};

// Endormi : affaissé, il respire lentement (les « Z » au-dessus de lui sont dessinés par l'interface).
function sleepPose(m, e, t) {
  if (e.state === 'sleep') { m.body.rotation.x = 0.16; m.body.scale.y = 1 + Math.sin(t * 2.2 + e.ph * 6) * 0.04; e.slumped = true; }
  else if (e.slumped) { e.slumped = false; m.body.rotation.x = 0; m.body.scale.y = 1; }
}

const MODEL_OF = { dentist: 'dentist', nerds: 'nerd', hamster: 'hamster', cupid: 'cupid', devil: 'devil', opera: 'opera', wiseman: 'wiseman', hula: 'hula',
  boogey: 'boogey', mower: 'mower', cart: 'cart', mole: 'mole', chickens: 'chicken', santa: 'santa',
  shark: 'shark', wizard: 'wizard', tornado: 'tornado', bees: 'bees', truck: 'truck', mailbox: 'mailbox' };
// terriens qui vont en bande (combien au départ)
const GROUP = { nerds: 4, chickens: 2 };
// ceux qui se déplacent à leur façon : dans l'eau, au gré du vent, sur la route
const OWN = new Set(['shark', 'tornado', 'truck']);
// Le sommeil : à cette distance, un joueur qui ne marche pas sur la pointe des pieds réveille un terrien ; sur la
// pointe des pieds, il faut presque le toucher. Réveillé, il se rendort après un long moment sans voir personne.
const WAKE = 3, WAKE_SNEAK = 0.8, DROWSE = 25;
// la danse hawaïenne (main.js bloque les commandes ; ouvrir un cadeau l'arrête)
const HULA_T = 4;
// les danseuses de Funkotron et du niveau secret : amicales
const FRIENDLY_HULA = { ...EARTHLINGS.hula, speed: 0.4, chase: 0, sight: 0, friendly: true };
// dans le jacuzzi : enfoncée jusqu'aux épaules
const LOUNGE_Y = -0.42;
const RED_INK = { fill: '#ff4a5c', line: '#1a1033' };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// à quelle vitesse ils corrigent leur direction (les engins tournent mal)
const TURN = { hamster: 1.5, mower: 1.6, cart: 1.1 };
const EGG = { type: 'egg', def: { knock: 3, sound: 'oeuf', dmg: 6 } };
// le rythme de l'original : une vue un peu courte, des poursuites brèves, puis un long moment sans s'intéresser à personne
const SIGHT_K = 0.85, CHASE_MAX = 4.5, BORED = 5;
// un leurre attire les terriens hostiles jusqu'à cette distance
const DECOY_RANGE = 12;

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
    for (const item of world.levels[k].data.earthlings) this.spawnItem(world, k, item);
  }

  // Fait apparaître un terrien de l'étage (ou toute sa bande) ; renvoie ceux qui sont apparus.
  spawnItem(world, k, item) {
    if (item.gone) return [];
    const L = world.levels[k], out = [];
    const n = GROUP[item.type] ? item.left ?? GROUP[item.type] : 1;
    item.left = n;
    for (let i = 0; i < n; i++) {
      // le modèle Blender s'il est chargé, sinon celui en volumes
      const m = addRing(makeTerrien(MODEL_OF[item.type]) || mergeStatic(MODELS[MODEL_OF[item.type]]()));
      if (item.type === 'nerds') m.root.scale.setScalar(0.9);
      // l'anneau du requin flotte à la surface
      if (item.type === 'shark') m.ring.position.y = 0.38;
      // le requin et le camion partent pile de leur case (l'eau, la route)
      const off = OWN.has(item.type) ? 0 : 0.4;
      const pos = new THREE.Vector3(item.x + (i % 2) * 0.8 - off, L.y, item.z + Math.floor(i / 2) * 0.8 - off);
      m.root.position.copy(pos);
      this.scene.add(m.root);
      const e = { item, level: k, type: item.type, def: item.friendly ? FRIENDLY_HULA : EARTHLINGS[item.type], m, pos, home: pos.clone(), dir: { x: 0, z: 1 }, target: null,
        state: item.sleep ? 'sleep' : 'wander', t: Math.random() * 5, cool: 0, idx: i, roll: 0, singT: 0, noise: 0, ph: Math.random() };
      this.list.push(e);
      out.push(e);
    }
    return out;
  }

  // Le terrien amical tout proche (le sage, le sorcier), s'il y en a un.
  friendNear(pos) {
    return this.list.find((e) => (e.type === 'wiseman' || e.type === 'wizard') && !e.used && Math.abs(e.pos.y - pos.y) < 2 && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < 1.6) || null;
  }

  // Une boîte aux lettres piégée (une sur trois) : au moment de commander, elle montre les dents et poursuit p.
  // Renvoie true si c'en était une.
  wakeMailbox(g, p, mb) {
    if (!mb?.trap) return false;
    const k = p.level, L = g.world.levels[k], d = L.data;
    d.mailbox = null;
    d.solids = d.solids.filter((s) => s.x !== mb.x || s.z !== mb.z);
    for (const pk of L.pickups) if (pk.kind === 'mailbox') { L.group.remove(pk.model); pk.model.traverse((o) => o.geometry?.dispose()); }
    L.pickups = L.pickups.filter((pk) => pk.kind !== 'mailbox');
    const item = { type: 'mailbox', x: mb.x + 0.4, z: mb.z + 0.4, gone: false };
    d.earthlings.push(item);
    if (this.levels.has(k)) {
      for (const e of this.spawnItem(g.world, k, item)) {
        const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, l = Math.hypot(dx, dz) || 1;
        Object.assign(e, { state: 'chase', chaseT: 0, warnT: WARN + 0.3, noise: 4, dir: { x: dx / l, z: dz / l } });
      }
    }
    g.fx.dust(new THREE.Vector3(mb.x, p.pos.y, mb.z), 16, ['#3a6fe8', '#ffffff', '#ff4a5c']);
    sound.play('boite', { rate: 0.7 });
    sound.play('surprise');
    p.emote('peur', 1.6);
    p.say('piege', true);
    g.hud.toast("CETTE BOÎTE AUX LETTRES N'ATTENDAIT PAS DE COURRIER.", 3);
    return true;
  }

  // Retire un terrien (tomate, ou sage qui s'en va) avec un nuage de fumée.
  poof(e, fx) {
    this.scene.remove(e.m.root);
    disposeModel(e);
    this.list = this.list.filter((x) => x !== e);
    fx.dust(e.pos, 18, ['#ffffff', '#d9d9e6', '#b9b0de']);
    sound.play('poof');
    sound.cry(e.type, 'fuite');
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
    e.fireT = 0.5;
    // l'œuf part de la bouche du mortier : sur le dos du poulet (modèle Blender), sur le côté (ancien modèle)
    const l = Math.hypot(e.dir.x, e.dir.z) || 1;
    const from = e.m.glb ? new THREE.Vector3(e.pos.x - (e.dir.x / l) * 0.12, e.pos.y + 0.7, e.pos.z - (e.dir.z / l) * 0.12) : new THREE.Vector3(e.pos.x + 0.4, e.pos.y + 0.6, e.pos.z);
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
        if (d < 0.95) { touched = true; g.hurt(EGG, dx / (d || 1), dz / (d || 1), q); setTimeout(() => sound.cry('chickens', 'rire'), 300); }
      }
      if (!touched) sound.play('oeuf', { vol: 0.8 });
      return false;
    });
  }

  update(dt, g) {
    this.g = g;
    const world = g.world;
    const visible = !g.seq && g.state !== 'title';
    // un joueur emporté par la tornade ou aplati par le camion n'a plus la main : le monde continue, sans lui
    const passive = (q) => !!q.carried || q.flatT > 0;
    const allTargets = g.players.filter((q) => q.visible && q.active && (q.control || passive(q)));
    const running = visible && g.state === 'play' && !g.menu && allTargets.length > 0;
    for (const o of this.eggs) o.mesh.visible = o.ring.visible = o.shown = visible;
    if (running) this.updateEggs(dt, g, allTargets.filter((q) => q.control));
    // ceux que la tornade emporte, ceux que le camion a aplatis (ils n'ont plus la main, mais le temps passe)
    if (visible && g.state === 'play' && !g.menu) {
      for (const q of g.players) {
        if (q.carried) this.updateCarried(q, g, dt);
        if (q.flatT > 0) this.updateFlat(q, dt);
      }
    }
    const leaving = [], decoys = (g.decoys || []).filter((o) => o.alive);
    for (const e of this.list) {
      // sous le brouillard, on ne voit personne
      e.m.root.visible = e.shown = visible && world.seenAt(e.level, e.pos.x, e.pos.z);
      const L = world.levels[e.level];
      const targets = allTargets.filter((q) => q.level === e.level);
      if (!running || !targets.length) continue;
      // chacun s'intéresse au joueur le plus proche ; un rosier n'intéresse personne, un leurre intéresse tous les hostiles
      const d = e.def, far = (q) => Math.hypot(q.pos.x - e.pos.x, q.pos.z - e.pos.z);
      const nearest = (list) => list.reduce((a, q) => (!a || far(q) < far(a) ? q : a), null);
      const real = nearest(targets), unseen = targets.filter((q) => !(q.effects.rosebush > 0) && !passive(q));
      const lure = d.friendly ? null : nearest(decoys.filter((o) => o.level === e.level && far(o) < DECOY_RANGE));
      const p = lure || (d.friendly || !unseen.length ? real : nearest(unseen));
      const hidden = !d.friendly && (p.effects?.rosebush > 0 || passive(p));
      const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, dist = Math.hypot(dx, dz);
      e.t += dt; e.cool = Math.max(0, e.cool - dt);
      // la poursuite se compte en temps réel, coups et ricanements compris (pas le « ! » du début)
      if (e.state === 'chase' && !(e.warnT > 0)) e.chaseT = (e.chaseT || 0) + dt;
      // le croque-mitaine se dévoile quand un vrai joueur approche (pas un leurre)
      e.dist = far(real);
      // endormi : il ne bouge pas ; un joueur qui passe près sans se faire discret le réveille (pas un rosier)
      if (e.state === 'sleep') {
        e.moving = false; e.danceT = 0; e.warnT = 0;
        const loud = targets.find((q) => !(q.effects.rosebush > 0) && !passive(q) && (far(q) < WAKE_SNEAK || (far(q) < WAKE && !q.sneaking)));
        if (!loud) {
          if (e.dist < 7) g.tip?.('dodo', 'CHUT, IL DORT. MAJ : SUR LA POINTE DES PIEDS, ON PASSE SANS LE RÉVEILLER.');
          continue;
        }
        e.state = 'wander'; e.bored = 0; e.drowse = 0;
        g.fx.sparkle(e.pos.clone().setY(e.pos.y + (d.flies ? 2 : 1.4)), '#ffffff', 6, 0.4);
      }
      // au niveau secret : celle qu'on drague s'arrête pour écouter (et répondre) ; celles du jacuzzi n'en sortent pas,
      // elles regardent juste qui approche
      if (e.listenT > 0 || e.item.lounge) {
        e.listenT = Math.max(0, (e.listenT || 0) - dt);
        e.moving = false; e.dancing = false;
        if (e.listenT > 0 || dist < 4) {
          const k = Math.min(1, dt * 6);
          e.dir.x += (dx / (dist || 1) - e.dir.x) * k; e.dir.z += (dz / (dist || 1) - e.dir.z) * k;
        }
        if (e.item.lounge) e.pos.y = L.y + LOUNGE_Y + Math.sin(g.t * 2 + e.idx) * 0.02;
        continue;
      }
      // ceux qui vivent à leur façon (requin, tornade, camion)
      if (OWN.has(e.type)) { this[e.type](e, g, targets.filter((q) => !passive(q)), dt, L, decoys); continue; }
      let speed = d.speed, tx, tz;
      // après un coup, il s'arrête (le dentiste ricane) : de quoi s'échapper
      if (e.pauseT > 0) { e.pauseT -= dt; e.moving = false; e.dir = { x: dx / (dist || 1), z: dz / (dist || 1) }; continue; }
      // sur la piste de disco, plus personne ne charge : on tourne sur soi en rythme
      if (e.danceT > 0) {
        e.danceT -= dt; e.dancing = true; e.moving = true; e.state = 'wander'; e.warnT = 0;
        e.dir = { x: Math.sin(g.t * 5 + e.idx), z: Math.cos(g.t * 5 + e.idx) };
        continue;
      }
      e.dancing = false;
      // le « ! » : il s'arrête, regarde sa cible, puis charge
      if (e.warnT > 0) { e.warnT -= dt; e.moving = false; e.dir = { x: dx / (dist || 1), z: dz / (dist || 1) }; continue; }
      const rage = g.challenge?.id === 'rage';
      // les abeilles ne suivent personne sous l'eau
      const dive = e.type === 'bees' && p.inWater;
      const sight = p.decoy ? DECOY_RANGE : hidden || dive ? 0 : d.sight * SIGHT_K * (p.sneaking ? 0.5 : 1) * (g.has?.('stealth') ? 0.8 : 1) * (rage ? 1.3 : 1);
      if (!d.friendly && e.state === 'wander' && dist < sight && !(e.bored > 0)) {
        e.state = 'chase'; e.chaseT = 0;
        if (e.type !== 'opera') e.warnT = WARN;
        if (!p.decoy) g.onCharge?.(e, p);
        if (e.noise <= 0) { if (!sound.cry(e.type, 'repere')) sound.play(d.sound, { vol: 0.7, rate: e.type === 'bees' ? 2.2 : 1 }); e.noise = 4; }
      } else if (e.state === 'chase' && (dist > sight * 1.4 || e.chaseT > (e.type === 'bees' ? 2.6 : CHASE_MAX))) {
        // trop loin, ou lassé de courir (l'essaim se lasse vite) : il retourne flâner un bon moment
        e.state = 'wander'; e.bored = dive ? 3 : BORED;
      }
      // réveillé pour rien : il se rendort au bout d'un long moment sans voir personne
      if (e.item.sleep && e.state === 'wander') {
        e.drowse = dist > 9 ? (e.drowse || 0) + dt : 0;
        if (e.drowse > DROWSE) { e.state = 'sleep'; e.bored = 0; e.drowse = 0; continue; }
      }
      if (e.state !== 'chase') e.chaseT = 0;
      e.bored = Math.max(0, (e.bored || 0) - dt);
      if (e.bored > 0 && e.state === 'chase') e.state = 'wander';
      e.noise -= dt;
      // les engins font du bruit tant qu'ils chargent
      if ((e.type === 'mower' || e.type === 'cart') && e.state === 'chase' && e.noise <= 0) { sound.play(d.sound, { vol: 0.6 }); e.noise = 2.4; }

      // le Père Noël : on l'approche en douce et il donne deux cadeaux ; sinon il s'envole
      if (e.type === 'santa') {
        if (e.lift !== undefined) { e.lift += dt * (2 + e.lift * 3); if (e.lift > 14) leaving.push(e); this.animate1(e, g.t); continue; }
        if (dist < 1.7 && p.sneaking && !passive(p)) {
          for (let k = 0; k < 2; k++) (p.bag || g.bag).add(rollPresent(Math.random));
          g.hud.showCard('HO HO HO !', 'LE PÈRE NOËL A GLISSÉ DEUX CADEAUX DANS LE SAC.');
          g.fx.sparkle(e.pos.clone().add(new THREE.Vector3(0, 1, 0)), '#ffe680', 30, 1);
          if (!sound.cry('santa', 'cadeau')) sound.play('perenoel');
          p.emote('joie', 2);
          e.lift = 0; e.item.gone = true;
          continue;
        }
        if (dist < 3.3 && !p.sneaking && !passive(p)) {
          g.hud.toast('TROP BRUYANT ! LE PÈRE NOËL FILE. (MAJ)');
          if (!sound.cry('santa', 'envol')) sound.play('perenoel', { rate: 1.15 });
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
        if (!e.fleeT && !e.upT && dist < 0.8 && e.cool <= 0 && !hidden) {
          e.upT = 0.9; e.cool = 6;
          sound.play('taupe');
          g.fx.dust(e.pos, 16, ['#7a4a26', '#5a3418', '#a07040']);
          const bag = p.bag || g.bag, items = p.decoy ? [] : bag.list();
          if (p.decoy) { p.hit(); g.hud.toast('LA TAUPE NE TROUVE QUE DU CARTON.'); }
          else if (items.length) {
            const it = items[Math.floor(Math.random() * items.length)];
            bag.take(it.type);
            e.lootOwner = p;
            (e.loot ||= []).push(it.type);
            g.hud.toast(g.bag.known.has(it.type) ? `LA TAUPE A PIQUÉ : ${g.bag.label(it.type)} !` : 'LA TAUPE A PIQUÉ UN CADEAU !');
            p.emote('colere', 1.4);
            setTimeout(() => sound.cry('mole', 'rire'), 400);
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
          if (dist < 4.5 && !hidden) {
            if (e.singT <= 0 || e.singT > 3) { e.singT = 0.001; if (!sound.cry('opera', 'chant', { vol: 0.7 })) sound.play('cantatrice', { vol: 0.6 }); }
            e.singT += dt;
            // un leurre en carton n'a pas d'oreilles
            if (!p.decoy) {
              g.damage(6 * dt, p);
              const push = 2.2 / Math.max(dist, 0.5);
              p.kick(dx / Math.max(dist, 0.01) * push * dt * 8, dz / Math.max(dist, 0.01) * push * dt * 8);
            }
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
        if (rage) speed *= 1.2;
        const nx = e.pos.x + e.dir.x * speed * dt, nz = e.pos.z + e.dir.z * speed * dt;
        if (d.flies || this.ok(world, e.level, nx, nz)) { e.pos.x = nx; e.pos.z = nz; e.moving = true; }
        else { e.target = null; e.moving = false; if (e.type === 'hamster' || e.type === 'cart') { e.dir.x *= -1; e.dir.z *= -1; e.roll = 0.6; } }
        // la tondeuse laisse de l'herbe coupée derrière elle
        if (e.type === 'mower' && e.moving && e.state === 'chase' && Math.random() < dt * 14) g.fx.dust(e.pos, 2, ['#5fcf5a', '#3fae4a', '#8be06a']);
      } else e.moving = false;
      const ty = world.type(e.level, e.pos.x, e.pos.z);
      e.pos.y = L.y + (ty ? topOf(ty) : 0);

      // contact
      const reach = { hamster: 0.85, cupid: 0.9, mower: 1.0, cart: 1.0, bees: 0.75, hula: 0.8 }[e.type] ?? 0.7;
      if (!d.friendly && !['opera', 'mole', 'chickens'].includes(e.type) && dist < reach && e.cool <= 0 && !hidden) {
        // l'essaim pique souvent, mais pas sous l'eau ; la danseuse fait danser, puis s'en va onduler ailleurs
        if (e.type === 'bees') { if (!p.inWater && e.state === 'chase') { e.cool = 0.5; this.sting(e, p, g, dx, dz, dist); } continue; }
        if (e.type === 'hula') { e.cool = 5; e.pauseT = 1.5; e.state = 'wander'; e.bored = 6; this.hulaDance(p, g); continue; }
        e.cool = 1.6;
        e.pauseT = e.type === 'dentist' ? 1.8 : e.type === 'cart' || e.type === 'hamster' ? 0 : 0.9;
        if (p.decoy) p.hit(); else g.hurt(e, dx / (dist || 1), dz / (dist || 1), p);
        if (e.type === 'hamster' || e.type === 'cart') { e.dir.x *= -1; e.dir.z *= -1; e.roll = 0.8; }
      }
    }
    // le Père Noël a disparu dans le ciel
    for (const e of leaving) { this.scene.remove(e.m.root); disposeModel(e); this.list = this.list.filter((x) => x !== e); }
    if (visible) this.animate(g.t, dt);
  }

  // L'essaim : de petites piqûres, souvent.
  sting(e, p, g, dx, dz, dist) {
    if (p.decoy) { p.hit(); return; }
    if (p.invuln > 0 || p.effects.wings > 0) return;
    g.damage(e.def.dmg, p);
    p.kick((dx / (dist || 1)) * 1.2, (dz / (dist || 1)) * 1.2);
    p.emote('aie', 0.6);
    if (Math.random() < 0.3 && !p.say('aie')) sound.play('aie', { vol: 0.5 });
    g.hud.float('PIC !', p.pos.clone().setY(p.pos.y + 1.6), p.level, RED_INK, 0.5);
  }

  // La danseuse hawaïenne : au contact, on danse sur place quelques secondes (main.js bloque les commandes).
  hulaDance(p, g) {
    if (p.decoy) { p.hit(); return; }
    if (p.invuln > 0 || p.effects.wings > 0 || p.hulaT > 0) return;
    p.hulaT = HULA_T;
    p.emote('joie', HULA_T);
    sound.play('coeur', { rate: 1.2 });
    g.fx.sparkle(p.mid(), '#ff8ad8', 14, 0.7);
    g.hud.toast('ALOHA ! LES PIEDS DANSENT TOUT SEULS. UN CADEAU COUPERAIT LA MUSIQUE.', 3);
  }

  // Le requin : il tourne en rond dans son eau ; il fonce sur qui nage (jamais sur la terre ferme), mord, puis
  // s'éloigne un moment. La bouée fait nager plus vite, pas plus vite que lui.
  shark(e, g, targets, dt, L) {
    const world = g.world, d = e.def, wet = (x, z) => world.type(e.level, x, z) === T.WATER;
    e.biteT = Math.max(0, (e.biteT || 0) - dt);
    e.fleeT = Math.max(0, (e.fleeT || 0) - dt);
    let prey = null, pd = d.sight;
    for (const q of targets) {
      const r = Math.hypot(q.pos.x - e.pos.x, q.pos.z - e.pos.z);
      if (q.inWater && r < pd) { pd = r; prey = q; }
    }
    if (e.cool > 0) prey = null;
    let tx, tz, speed;
    if (e.fleeT > 0) { tx = e.pos.x + e.away.x * 4; tz = e.pos.z + e.away.z * 4; speed = 3.2; }
    else if (prey) {
      if (e.state !== 'chase') { e.state = 'chase'; sound.play('eclaboussure', { vol: 0.6, rate: 0.8 }); g.onCharge?.(e, prey); }
      tx = prey.pos.x; tz = prey.pos.z; speed = d.chase;
    } else {
      // il tourne en rond autour de chez lui
      e.state = 'wander';
      e.circ = (e.circ ?? e.ph * 6.28) + dt * 0.5;
      const R = 2.6 + Math.sin(e.circ * 0.3 + e.ph * 6) * 1.1;
      tx = e.home.x + Math.cos(e.circ) * R; tz = e.home.z + Math.sin(e.circ) * R; speed = d.speed;
    }
    const vx = tx - e.pos.x, vz = tz - e.pos.z, l = Math.hypot(vx, vz) || 1;
    e.dir.x += (vx / l - e.dir.x) * Math.min(1, dt * 4); e.dir.z += (vz / l - e.dir.z) * Math.min(1, dt * 4);
    const dl = Math.hypot(e.dir.x, e.dir.z) || 1, nx = e.pos.x + (e.dir.x / dl) * speed * dt, nz = e.pos.z + (e.dir.z / dl) * speed * dt;
    // il longe la rive plutôt que d'y monter
    e.moving = true;
    if (wet(nx, nz)) { e.pos.x = nx; e.pos.z = nz; }
    else if (wet(nx, e.pos.z)) e.pos.x = nx;
    else if (wet(e.pos.x, nz)) e.pos.z = nz;
    else { e.moving = false; e.circ = (e.circ || 0) + 1.5; }
    // poussé hors de l'eau (un ToeJam qui se relève l'a bousculé) : il y retourne
    if (wet(e.pos.x, e.pos.z)) e.wet = { x: e.pos.x, z: e.pos.z };
    else { const b = e.wet || e.home; e.pos.x = b.x; e.pos.z = b.z; }
    e.pos.y = L.y + topOf(T.WATER);
    if (e.moving && Math.random() < dt * (e.state === 'chase' ? 10 : 2)) g.fx.ripple(new THREE.Vector3(e.pos.x, L.y + WATER_Y + 0.01, e.pos.z));
    // la morsure
    if (prey && !e.fleeT) {
      const dx = prey.pos.x - e.pos.x, dz = prey.pos.z - e.pos.z, dist = Math.hypot(dx, dz);
      if (dist < 0.8 && !(prey.invuln > 0)) {
        e.cool = 5; e.fleeT = 2.5; e.biteT = 0.6; e.state = 'wander';
        e.away = { x: -dx / (dist || 1), z: -dz / (dist || 1) };
        g.hurt(e, dx / (dist || 1), dz / (dist || 1), prey);
        g.fx.splash(new THREE.Vector3(e.pos.x, L.y + WATER_Y, e.pos.z));
        g.hud.float('CROC !', prey.pos.clone().setY(prey.pos.y + 1.7), prey.level, RED_INK);
        g.tip?.('requin', "LES REQUINS NE MORDENT QUE DANS L'EAU. LA TERRE FERME, C'EST BIEN AUSSI.");
      }
    }
  }

  // La tornade : elle file au hasard, change souvent de cap (parfois vers quelqu'un), et emporte qui elle attrape.
  tornado(e, g, targets, dt, L) {
    const world = g.world, d = e.def;
    let q0 = null, r0 = Infinity;
    for (const q of targets) { const r = Math.hypot(q.pos.x - e.pos.x, q.pos.z - e.pos.z); if (r < r0) { r0 = r; q0 = q; } }
    e.turnT = (e.turnT || 0) - dt;
    if (e.turnT <= 0 || !e.goal) {
      e.turnT = 0.7 + Math.random() * 1.3;
      let a = Math.random() * Math.PI * 2;
      if (q0 && r0 < d.sight && Math.random() < 0.45) a = Math.atan2(q0.pos.z - e.pos.z, q0.pos.x - e.pos.x) + (Math.random() - 0.5) * 0.9;
      else if (Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z) > 16) a = Math.atan2(e.home.z - e.pos.z, e.home.x - e.pos.x) + (Math.random() - 0.5) * 0.6;
      e.goal = { x: Math.cos(a), z: Math.sin(a) };
    }
    e.dir.x += (e.goal.x - e.dir.x) * Math.min(1, dt * 3); e.dir.z += (e.goal.z - e.dir.z) * Math.min(1, dt * 3);
    const l = Math.hypot(e.dir.x, e.dir.z) || 1, nx = e.pos.x + (e.dir.x / l) * d.speed * dt, nz = e.pos.z + (e.dir.z / l) * d.speed * dt;
    // ni le vide ni le bord de la carte : elle repart d'où elle vient
    if (world.type(e.level, nx, nz)) { e.pos.x = nx; e.pos.z = nz; e.moving = true; }
    else { e.goal = { x: -e.goal.x, z: -e.goal.z }; e.turnT = 0.8; e.moving = false; }
    const ty = world.type(e.level, e.pos.x, e.pos.z);
    e.pos.y = L.y + (ty === T.WATER ? WATER_Y : topOf(ty));
    if (Math.random() < dt * 8) g.fx.dust(e.pos, 2, ty === T.WATER ? ['#ffffff', '#bfe8ff'] : ['#d9d9e6', '#b9b0de', '#a07040']);
    // le vent, quand quelqu'un est dans les parages
    e.noise -= dt;
    if (r0 < 9 && e.noise <= 0) { sound.play('ailes', { vol: 0.25 + 0.4 * (1 - r0 / 9), rate: 0.55 }); e.noise = 1.6; }
    if (e.cool > 0) return;
    for (const q of targets) {
      if (Math.hypot(q.pos.x - e.pos.x, q.pos.z - e.pos.z) > 0.85 || q.invuln > 0) continue;
      this.carry(e, q, g);
      e.cool = 4;
      break;
    }
  }

  // La tornade emporte p : il monte en tournant dans l'entonnoir, puis elle le lâche n'importe où sur l'étage ;
  // une fois sur quatre (pas au premier étage) au-dessus du vide, et l'on tombe à l'étage du dessous.
  carry(e, p, g) {
    const k = p.level, w = g.world;
    let to = w.randomLand(k), drop = false;
    if (k >= 1 && Math.random() < 0.25) { const v = this.voidSpot(w, k); if (v) { to = v; drop = true; } }
    p.carried = { e, t: 0, x: e.pos.x, z: e.pos.z, to, drop };
    Object.assign(p, { control: false, hulaT: 0, vx: 0, vz: 0, kx: 0, kz: 0, anim: 'jump', bang: false });
    p.emote('peur', 3);
    if (!p.say('chute', true)) sound.play('surprise');
    sound.play('ailes', { rate: 0.6 });
    g.shake = 2;
    g.hud.toast('EMPORTÉ PAR LA TORNADE. DESTINATION : AILLEURS.', 2.6);
  }

  // Un point au-dessus du vide, au bord de la terre ferme de l'étage k.
  voidSpot(w, k) {
    for (let n = 0; n < 12; n++) {
      const s = w.randomLand(k), a = Math.random() * Math.PI * 2;
      for (let r = 1; r <= 6; r += 0.5) {
        const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
        if (!w.type(k, x, z) && !w.isHole(k, x, z)) return { x, z };
      }
    }
    return null;
  }

  updateCarried(p, g, dt) {
    const c = p.carried, L = g.world.levels[p.level], UP = 1.1, H = 3.4;
    // le vol dure selon la distance : de quoi voir défiler l'étage
    const FLY = c.lx === undefined ? 1.2 : Math.min(2.6, Math.max(1.2, Math.hypot(c.to.x - c.lx, c.to.z - c.lz) / 16));
    c.t += dt;
    p.anim = 'jump';
    p.headingT = p.heading + 0.9; // il tournoie
    if (c.t < UP) {
      // aspiré : il monte en spirale autour de l'entonnoir, qui poursuit sa route
      const tw = this.list.includes(c.e) ? c.e.pos : c, k = c.t / UP, a = c.t * 13, r = 0.5 * (1 - k * 0.4);
      p.pos.set(tw.x + Math.cos(a) * r, L.y + k * H, tw.z + Math.sin(a) * r);
      c.lx = p.pos.x; c.lz = p.pos.z;
    } else {
      // projeté en cloche jusqu'à sa destination
      const k = Math.min(1, (c.t - UP) / FLY);
      p.pos.set(c.lx + (c.to.x - c.lx) * k, L.y + H * (1 - k) + Math.sin(k * Math.PI) * 3, c.lz + (c.to.z - c.lz) * k);
      if (k >= 1) { this.dropCarried(p, g, c); return; }
    }
    const gt = g.world.type(p.level, p.pos.x, p.pos.z);
    p.shadowOverride = gt ? { x: p.pos.x, y: L.y + topOf(gt), z: p.pos.z, s: 0.5 } : null;
  }

  dropCarried(p, g, c) {
    p.carried = null; p.shadowOverride = null;
    const L = g.world.levels[p.level], ty = g.world.type(p.level, c.to.x, c.to.z), l = Math.hypot(c.to.x - c.lx, c.to.z - c.lz) || 1;
    p.pos.set(c.to.x, L.y + (ty ? topOf(ty) : 0), c.to.z);
    p.vel = { x: (c.to.x - c.lx) / l, z: (c.to.z - c.lz) / l };
    if (c.drop) { g.seq = p.effects.unfall > 0 ? new UnfallSeq(g, p) : new FallSeq(g, p); return; }
    p.land();
    separate(g, p);
    Object.assign(p, { control: true, anim: 'idle', squash: 0.8, invuln: Math.max(p.invuln, 1.5) });
    p.emote('sonne', 1.2);
    g.fx.dust(p.pos, 16);
    sound.play('splat', { vol: 0.7 });
    g.shake = 2;
  }

  // Le camion de glaces : il suit la route d'un bout à l'autre, fait demi-tour, et ne freine pour personne.
  truck(e, g, targets, dt, L, decoys) {
    const road = L.data.road, n = road?.length || 0;
    if (n < 2) { e.moving = false; return; }
    if (e.ri === undefined) {
      // il part de la case de route la plus proche
      let bd = Infinity;
      road.forEach((c, i) => { const dd = (cellX(c.i) - e.pos.x) ** 2 + (cellX(c.j) - e.pos.z) ** 2; if (dd < bd) { bd = dd; e.ri = i; } });
      e.rdir = e.ri > n / 2 ? -1 : 1; e.waitT = 0;
    }
    // la route lissée : la moyenne des cases autour, pas les marches d'escalier
    const P = (s) => { s = Math.max(0, Math.min(n - 1, s)); const a = Math.floor(s), b = Math.min(n - 1, a + 1), f = s - a; return [cellX(road[a].i) + (cellX(road[b].i) - cellX(road[a].i)) * f, cellX(road[a].j) + (cellX(road[b].j) - cellX(road[a].j)) * f]; };
    const S = (s) => { let x = 0, z = 0; for (let k = -2; k <= 2; k++) { const [a, b] = P(s + k * 0.7); x += a; z += b; } return { x: x / 5, z: z / 5 }; };
    e.waitT = Math.max(0, e.waitT - dt);
    if (e.waitT <= 0) {
      e.ri += e.rdir * e.def.speed * dt;
      // au bout de la route : il s'arrête, puis fait demi-tour
      if (e.ri >= n - 1 || e.ri <= 0) { e.ri = Math.max(0, Math.min(n - 1, e.ri)); e.rdir *= -1; e.waitT = 1; }
    }
    const here = S(e.ri), ahead = S(e.ri + e.rdir * 1.5), ta = Math.atan2(ahead.x - here.x, ahead.z - here.z);
    e.ang ??= ta;
    if (Math.hypot(ahead.x - here.x, ahead.z - here.z) > 0.05) e.ang += wrapA(ta - e.ang) * Math.min(1, dt * (e.waitT > 0 ? 2.5 : 6));
    e.pos.x = here.x; e.pos.z = here.z;
    e.dir = { x: Math.sin(e.ang), z: Math.cos(e.ang) };
    e.moving = e.waitT <= 0;
    const ty = g.world.type(e.level, e.pos.x, e.pos.z);
    e.pos.y = L.y + (ty ? topOf(ty) : 0);
    // le moteur, quand quelqu'un est dans les parages
    const near = Math.min(...targets.map((q) => Math.hypot(q.pos.x - e.pos.x, q.pos.z - e.pos.z)));
    e.noise -= dt;
    if (near < 12 && e.moving && e.noise <= 0) { sound.play('tondeuse', { vol: 0.2 + 0.5 * (1 - near / 12), rate: 0.7 }); e.noise = 2.2; }
    if (near < 10) g.tip?.('camion', 'LE CAMION DE GLACES NE FREINE PAS. SORS DE LA ROUTE.');
    if (!e.moving || e.cool > 0) return;
    // il écrase ce qui se trouve devant lui
    const fx0 = e.pos.x + e.dir.x * 0.5, fz0 = e.pos.z + e.dir.z * 0.5;
    for (const q of [...targets, ...decoys.filter((o) => o.level === e.level)]) {
      if (Math.hypot(q.pos.x - fx0, q.pos.z - fz0) > 0.85) continue;
      this.runOver(e, q, g);
      e.cool = 0.8;
      break;
    }
  }

  // Le camion passe : on est aplati un instant (et ça fait mal), sur le bas-côté.
  runOver(e, p, g) {
    if (p.decoy) { p.hit(); return; }
    if (p.invuln > 0 || p.effects.wings > 0) return;
    const sx = -e.dir.z, sz = e.dir.x, side = Math.sign((p.pos.x - e.pos.x) * sx + (p.pos.z - e.pos.z) * sz) || 1;
    g.hurt(e, sx * side, sz * side, p);
    p.kx = p.kz = 0;
    const nx = p.pos.x + sx * side * 0.6, nz = p.pos.z + sz * side * 0.6;
    if (g.world.type(p.level, nx, nz)) { p.pos.x = nx; p.pos.z = nz; }
    g.hud.float('SPLOTCH !', p.pos.clone().setY(p.pos.y + 1.2), p.level, RED_INK, 1);
    g.hud.toast('ÉCRASÉ PAR LE CAMION DE GLACES. ÇA SENT LA VANILLE.', 2.6);
    if (!g.seq && !(p.ko > 0) && p.control) Object.assign(p, { control: false, anim: 'splat', squash: 1, vx: 0, vz: 0, flatT: 1.4 });
  }

  // Aplati par le camion : on se relève tout seul.
  updateFlat(p, dt) {
    p.flatT -= dt;
    if (p.ko > 0) { p.flatT = 0; return; }
    p.anim = p.flatT < 0.4 ? 'getup' : 'splat';
    if (p.flatT <= 0) { p.flatT = 0; p.control = true; p.anim = 'idle'; }
  }

  animate(t, dt = 1 / 60) {
    WARN_MAT.opacity = 0.55 + 0.35 * Math.sin(t * 22);
    for (const e of this.list) this.animate1(e, t, dt);
  }

  animate1(e, t, dt = 1 / 60) {
    {
      const m = e.m, ph = t * 9 + e.idx;
      m.root.position.copy(e.pos);
      if (m.ring) {
        const w = e.warnT > 0 && !e.dancing && !(e.pauseT > 0), a = !w && e.aimed;
        m.ring.visible = w || a;
        if (w) { m.ring.material = WARN_MAT; m.ring.scale.setScalar(1.5 - e.warnT); }
        else if (a) { m.ring.material = AIM_MAT; m.ring.scale.setScalar(1 + Math.sin(t * 8) * 0.08); }
      }
      if (e.dancing && !m.glb) m.root.position.y += Math.abs(Math.sin(t * 7 + e.idx)) * 0.18;
      if (e.type !== 'hamster') m.root.rotation.y = Math.atan2(e.dir.x, e.dir.z);
      // modèle Blender : ses propres animations (et quelques effets propres à son type, plus bas quand il y en a)
      if (m.glb) { animateTerrien(m, e, e.state === 'sleep' ? dt * 0.3 : dt); GLB_FX[e.type]?.(m, e, t, dt); sleepPose(m, e, t); return; }
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
        case 'shark': {
          // l'aileron qui tourne ; la tête ne sort de l'eau que pour mordre
          const up = e.biteT > 0 ? Math.sin((1 - e.biteT / 0.6) * Math.PI) : 0, x = m.extra;
          m.body.position.y = up * 0.5;
          x.fish.rotation.x = -up * 0.5;
          x.jaw.rotation.x = up * 0.7;
          x.fin.rotation.z = Math.sin(t * 3 + e.ph * 6) * 0.08;
          x.tail.rotation.y = Math.sin(t * (e.state === 'chase' ? 16 : 6)) * 0.45;
          x.foam.visible = e.moving || up > 0;
          x.foam.scale.setScalar(1 + Math.sin(t * 5) * 0.12 + (e.state === 'chase' ? 0.35 : 0) + up * 0.8);
          break;
        }
        case 'wizard':
          m.body.rotation.z = Math.sin(t * 1.3 + e.ph * 6) * 0.05;
          m.extra.arm.rotation.x = Math.sin(t * 2.2) * 0.4;
          m.extra.tip.scale.setScalar(1 + Math.sin(t * 8) * 0.25);
          break;
        case 'tornado':
          m.extra.rings.forEach((j, k) => { j.rotation.y = t * (7 + k * 1.5); j.position.x = Math.sin(t * 2.5 + k * 0.7) * 0.05 * k; });
          m.extra.debris.forEach((j, k) => { j.rotation.y = t * (4 + k * 0.7) + k; });
          m.extra.core.rotation.y = -t * 5;
          m.extra.face.position.y = 1.25 + Math.sin(t * 3) * 0.05;
          m.body.rotation.z = Math.sin(t * 1.7 + e.ph * 6) * 0.08;
          break;
        case 'bees': {
          // chacune tourne autour du point de l'essaim, plus vite quand il poursuit quelqu'un
          const fast = e.state === 'chase' ? 1.8 : 1;
          for (const b of m.extra.bees) {
            const u = b.userData, a = t * u.sp * fast + u.ph;
            b.position.set(Math.cos(a) * u.r, Math.sin(t * u.sp * 1.3 + u.ph) * 0.15 + u.h, Math.sin(a) * u.r);
            b.rotation.y = -a;
            u.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 70 + u.ph) * 0.7; });
          }
          break;
        }
        case 'truck':
          m.extra.wheels.forEach((w) => { w.rotation.x = e.moving ? t * 14 : 0; });
          m.body.position.y = e.moving ? Math.abs(Math.sin(t * 18)) * 0.025 : 0;
          m.extra.cone.rotation.z = Math.sin(t * 6) * (e.moving ? 0.08 : 0.02);
          break;
        case 'mailbox': {
          // elle sautille sur son poteau et claque du couvercle
          const angry = e.state === 'chase' || e.pauseT > 0;
          m.body.position.y = e.moving ? Math.abs(Math.sin(t * 9 + e.ph * 6)) * 0.18 : 0;
          m.extra.lid.rotation.x = -(angry ? 0.12 + Math.abs(Math.sin(t * 11)) * 0.45 : 0.04);
          m.extra.flag.rotation.z = Math.sin(t * 7) * 0.3;
          break;
        }
      }
      sleepPose(m, e, t);
    }
  }
}
