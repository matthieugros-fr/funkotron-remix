// Décor en volumes à facettes (palmiers, buissons, rochers, fleurs, touffes d'herbe).
// Chaque étage fusionne tout son décor en un seul maillage coloré par sommet.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry, hash2 } from './rng.js';
import { topOf } from './terrain3d.js';
import { T, toCell } from './gen.js';
import { BIOMES } from './biomes.js';

const UP = new THREE.Vector3(0, 1, 0);

// Géométrie non indexée, sans UV ni normales (le matériau calcule des facettes), colorée.
function paint(geo, color, vary = 0, r = Math.random) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const n = g.attributes.position.count, out = new Float32Array(n * 3), base = new THREE.Color(color), c = new THREE.Color();
  for (let f = 0; f < n; f += 3) {
    c.copy(base).multiplyScalar(1 - vary / 2 + r() * vary);
    for (let v = 0; v < 3; v++) out.set([c.r, c.g, c.b], (f + v) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

// Bosselle un polyèdre sans l'ouvrir : un même sommet reçoit toujours le même décalage.
function jitter(geo, amt, seed) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = hash2(Math.round(x * 1000), Math.round(y * 1000) * 7 + Math.round(z * 1000), seed);
    const s = 1 + (k - 0.5) * amt;
    p.setXYZ(i, x * s, y * s, z * s);
  }
  return geo;
}

const at = (geo, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) =>
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));

// Une palme : bande arquée qui retombe, avec une nervure centrale en relief.
function leaf(len, wid, droop, light, dark) {
  const N = 7, pos = [], colArr = [], cl = new THREE.Color(light), cd = new THREE.Color(dark);
  const row = (s) => {
    const z = s * len, y = s * len * 0.35 - s * s * len * droop, w = wid * Math.sin(Math.PI * Math.min(1, 0.15 + s * 0.95)) * (1 - s * 0.35);
    return [[-w, y - 0.04, z], [0, y + 0.03, z], [w, y - 0.04, z]];
  };
  for (let k = 0; k < N; k++) {
    const a = row(k / N), b = row((k + 1) / N);
    const tri = (p, q, r, c) => { pos.push(...p, ...q, ...r); for (let v = 0; v < 3; v++) colArr.push(c.r, c.g, c.b); };
    tri(a[0], a[1], b[1], cd); tri(a[0], b[1], b[0], cd);
    tri(a[1], a[2], b[2], cl); tri(a[1], b[2], b[1], cl);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
  return g;
}

function palm(r) {
  const parts = [], H = 2.3 + r() * 0.6, dir = r() * Math.PI * 2, bend = 0.4 + r() * 0.5;
  const pt = (t) => new THREE.Vector3(Math.cos(dir) * bend * t * t, t * H, Math.sin(dir) * bend * t * t);
  const segs = 7;
  for (let k = 0; k < segs; k++) {
    const a = pt(k / segs), b = pt((k + 1) / segs), v = b.clone().sub(a), len = v.length();
    const g = paint(new THREE.CylinderGeometry(0.1 - k * 0.006, 0.125 - k * 0.006, len * 1.05, 6), k % 2 ? '#8a5a32' : '#a76f40', 0.1, r);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, v.normalize());
    const m = a.clone().add(b).multiplyScalar(0.5);
    g.applyMatrix4(new THREE.Matrix4().compose(m, q, new THREE.Vector3(1, 1, 1)));
    parts.push(g);
  }
  const top = pt(1);
  const n = 7;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + r() * 0.4;
    const g = leaf(1.15 + r() * 0.35, 0.2, 0.75 + r() * 0.3, '#4fc04a', '#2f8a37');
    at(g, top.x, top.y - 0.05, top.z, a, 1, 1, 1, -0.15);
    parts.push(g);
  }
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    parts.push(at(paint(new THREE.IcosahedronGeometry(0.09, 0), '#5a3a1e', 0.2, r), top.x + Math.cos(a) * 0.12, top.y - 0.14, top.z + Math.sin(a) * 0.12));
  }
  return parts;
}

function bush(r) {
  const parts = [], cols = ['#2f8a37', '#3c9e40', '#4cb34a'];
  for (let k = 0; k < 4; k++) {
    const rad = 0.24 + r() * 0.16, a = r() * Math.PI * 2, d = k ? 0.18 : 0;
    const g = jitter(paint(new THREE.IcosahedronGeometry(rad, 1), cols[k % 3], 0.18, r), 0.25, k * 13 + 1);
    parts.push(at(g, Math.cos(a) * d, rad * 0.75 + (k ? 0 : 0.05), Math.sin(a) * d, r() * 3, 1, 0.85));
  }
  if (r() < 0.6) for (let k = 0; k < 4; k++) {
    const a = r() * Math.PI * 2;
    parts.push(at(paint(new THREE.IcosahedronGeometry(0.045, 0), '#ff4a5c', 0, r), Math.cos(a) * 0.3, 0.3 + r() * 0.3, Math.sin(a) * 0.3));
  }
  return parts;
}

function rock(r) {
  const g = jitter(paint(new THREE.IcosahedronGeometry(0.3, 0), r() < 0.5 ? '#8c90a3' : '#9a9cad', 0.22, r), 0.4, Math.floor(r() * 1000));
  return [at(g, 0, 0.12, 0, r() * 6, 1, 0.65 + r() * 0.2, 0.9)];
}

function flowers(r) {
  const parts = [], cols = ['#ff8ad8', '#ffe36b', '#ffffff', '#8ad8ff', '#ff7a4a'];
  for (let k = 0; k < 3; k++) {
    const x = (r() - 0.5) * 0.4, z = (r() - 0.5) * 0.4, h = 0.22 + r() * 0.18;
    parts.push(at(paint(new THREE.BoxGeometry(0.025, h, 0.025), '#2f8a37', 0, r), x, h / 2, z));
    parts.push(at(paint(new THREE.OctahedronGeometry(0.075, 0), cols[Math.floor(r() * cols.length)], 0.1, r), x, h, z, r() * 3, 1, 0.6));
    parts.push(at(paint(new THREE.OctahedronGeometry(0.03, 0), '#ffb000', 0, r), x, h + 0.04, z));
  }
  return parts;
}

function tuft(r, sandy, biomeCols) {
  const parts = [], cols = biomeCols || (sandy ? ['#9bb35a', '#b9c46e'] : ['#3f9a3d', '#5cbf4a', '#2f8a37']);
  for (let k = 0; k < 6; k++) {
    const h = 0.18 + r() * 0.2, w = 0.035, a = r() * Math.PI * 2, lean = (r() - 0.5) * 0.7;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, lean * h, h, 0], 3));
    parts.push(at(paint(g, cols[k % cols.length], 0.1, r), Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12, a));
  }
  return parts;
}

// --- décor des biomes -----------------------------------------------------------------------------------------
const pick = (r, list) => list[Math.floor(r() * list.length)];
const ico = (rad, color, r, det = 0, vary = 0.15) => paint(new THREE.IcosahedronGeometry(rad, det), color, vary, r);
const cyl = (a, b, h, color, r, seg = 6) => paint(new THREE.CylinderGeometry(a, b, h, seg), color, 0.1, r);
const cone = (rad, h, color, r, seg = 7) => paint(new THREE.ConeGeometry(rad, h, seg), color, 0.12, r);
const box = (w, h, dd, color, r) => paint(new THREE.BoxGeometry(w, h, dd), color, 0.08, r);

// tronc incliné d'un point à un autre
function limb(a, b, rad, color, r) {
  const v = b.clone().sub(a), len = v.length();
  const g = cyl(rad * 0.7, rad, len, color, r);
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, v.normalize()), new THREE.Vector3(1, 1, 1)));
  return g;
}

function roundtree(r, cols) {
  const H = 1.1 + r() * 0.5, parts = [at(cyl(0.08, 0.12, H, '#7a4a2a', r), 0, H / 2, 0)];
  for (let k = 0; k < 4; k++) {
    const a = r() * Math.PI * 2, d = k ? 0.3 : 0, rad = 0.42 + r() * 0.2;
    parts.push(at(jitter(ico(rad, pick(r, cols), r, 1), 0.25, k * 7 + 3), Math.cos(a) * d, H + (k ? 0.05 : 0.25), Math.sin(a) * d, r() * 3, 1, 0.85));
  }
  return parts;
}

function pine(r, snowy) {
  const parts = [at(cyl(0.07, 0.1, 0.5, '#5a3a22', r), 0, 0.25, 0)], H = 1.6 + r() * 0.6;
  for (let k = 0; k < 4; k++) {
    const y = 0.4 + k * H * 0.22, rad = 0.62 - k * 0.13, h = 0.7 - k * 0.08;
    parts.push(at(cone(rad, h, k % 2 ? '#1f6a3a' : '#2a7a44', r), 0, y + h / 2, 0, r() * 3));
    if (snowy) parts.push(at(cone(rad * 0.82, h * 0.45, '#f4f8ff', r), 0, y + h * 0.78, 0, r() * 3));
  }
  return parts;
}

function cactus(r) {
  const H = 1.0 + r() * 0.6, parts = [at(cyl(0.13, 0.15, H, '#3f9a4a', r, 8), 0, H / 2, 0)];
  parts.push(at(ico(0.13, '#4fae55', r), 0, H, 0, 0, 1, 0.7));
  for (const s of r() < 0.5 ? [-1] : [-1, 1]) {
    const y = H * (0.35 + r() * 0.25), h = 0.35 + r() * 0.25;
    parts.push(at(cyl(0.08, 0.08, 0.3, '#3f9a4a', r), s * 0.2, y, 0, 0, 1, 1, 1, 0, Math.PI / 2));
    parts.push(at(cyl(0.08, 0.08, h, '#3f9a4a', r), s * 0.34, y + h / 2, 0));
  }
  if (r() < 0.5) parts.push(at(ico(0.06, '#ff6ab0', r), 0, H + 0.1, 0));
  return parts;
}

function deadbush(r, color = '#8a6a44') {
  const parts = [];
  for (let k = 0; k < 6; k++) {
    const a = r() * Math.PI * 2, l = 0.25 + r() * 0.25;
    parts.push(limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * l * 0.7, l, Math.sin(a) * l * 0.7), 0.02, color, r));
  }
  return parts;
}

function skull(r) {
  const parts = [at(ico(0.13, '#f4ecd8', r, 1, 0.05), 0, 0.1, 0, r() * 6, 1, 0.85, 1.1)];
  for (const s of [-1, 1]) parts.push(at(ico(0.035, '#2a1a12', r), s * 0.05, 0.13, 0.11));
  parts.push(at(box(0.3, 0.04, 0.05, '#efe4cc', r), 0.18, 0.03, 0.05, r() * 3));
  return parts;
}

function tumbleweed(r) {
  const parts = [];
  for (let k = 0; k < 5; k++) parts.push(at(jitter(ico(0.16, k % 2 ? '#a88a5a' : '#8a6a3a', r, 0, 0.2), 0.5, k + 1), (r() - 0.5) * 0.15, 0.2 + (r() - 0.5) * 0.1, (r() - 0.5) * 0.15, r() * 6));
  return parts;
}

function rockOf(r, cols, scale = 1) {
  const g = jitter(paint(new THREE.IcosahedronGeometry(0.3 * scale, 0), pick(r, cols), 0.22, r), 0.4, Math.floor(r() * 1000));
  return [at(g, 0, 0.12 * scale, 0, r() * 6, 1, 0.65 + r() * 0.2, 0.9)];
}

function mushroom(r, big, cols) {
  const H = big ? 1.1 + r() * 0.7 : 0.18 + r() * 0.12, cap = big ? 0.55 + r() * 0.25 : 0.12;
  const c = pick(r, cols || ['#e8281f', '#ff8a3a', '#c88a5a']);
  const parts = [at(cyl(cap * 0.18, cap * 0.24, H, '#f4ecd8', r), 0, H / 2, 0)];
  parts.push(at(paint(new THREE.SphereGeometry(cap, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), c, 0.08, r), 0, H - cap * 0.15, 0, 0, 1, 0.6));
  const dots = big ? 7 : 3;
  for (let k = 0; k < dots; k++) {
    const a = (k / dots) * Math.PI * 2 + r(), d = cap * (0.4 + r() * 0.35);
    parts.push(at(ico(cap * 0.09, '#ffffff', r), Math.cos(a) * d, H - cap * 0.15 + Math.sqrt(Math.max(0, cap * cap - d * d)) * 0.6, Math.sin(a) * d));
  }
  return parts;
}

function pumpkin(r) {
  return [at(jitter(ico(0.2, '#ff8a1a', r, 1, 0.1), 0.15, 7), 0, 0.15, 0, r() * 3, 1.15, 0.8, 1.15), at(cyl(0.025, 0.03, 0.12, '#3f7a2a', r), 0, 0.33, 0)];
}

function leaves(r) {
  const parts = [], cols = ['#e8742a', '#d8402a', '#f0b030', '#a8582a'];
  for (let k = 0; k < 6; k++) parts.push(at(ico(0.07, pick(r, cols), r), (r() - 0.5) * 0.6, 0.02, (r() - 0.5) * 0.6, r() * 6, 1, 0.25, 1));
  return parts;
}

function stump(r) {
  return [at(cyl(0.2, 0.25, 0.3, '#6a4428', r, 9), 0, 0.15, 0), at(cyl(0.19, 0.19, 0.02, '#c8a070', r, 9), 0, 0.31, 0)];
}

function snowman(r) {
  const parts = [at(ico(0.3, '#ffffff', r, 1, 0.04), 0, 0.28, 0), at(ico(0.22, '#ffffff', r, 1, 0.04), 0, 0.72, 0), at(ico(0.16, '#ffffff', r, 1, 0.04), 0, 1.05, 0)];
  parts.push(at(cone(0.04, 0.18, '#ff8a1a', r), 0, 1.05, 0.2, 0, 1, 1, 1, Math.PI / 2));
  for (const s of [-1, 1]) parts.push(at(ico(0.025, '#1a1033', r), s * 0.06, 1.1, 0.14));
  parts.push(at(paint(new THREE.TorusGeometry(0.15, 0.04, 5, 10), '#e8334a', 0.05, r), 0, 0.9, 0, 0, 1, 1, 1, Math.PI / 2));
  parts.push(at(cyl(0.13, 0.13, 0.18, '#1a1033', r, 8), 0, 1.24, 0), at(cyl(0.2, 0.2, 0.02, '#1a1033', r, 8), 0, 1.16, 0));
  for (const s of [-1, 1]) parts.push(limb(new THREE.Vector3(s * 0.2, 0.75, 0), new THREE.Vector3(s * 0.55, 0.95, 0), 0.02, '#5a3a22', r));
  return parts;
}

function crystal(r, cols) {
  const parts = [], c = pick(r, cols || ['#9ad8ff', '#c8a0ff', '#7affe0']);
  for (let k = 0; k < 4; k++) {
    const h = 0.3 + r() * 0.5, a = r() * Math.PI * 2;
    parts.push(at(paint(new THREE.OctahedronGeometry(0.1, 0), c, 0.25, r), Math.cos(a) * 0.12 * (k ? 1 : 0), h / 2, Math.sin(a) * 0.12 * (k ? 1 : 0), r() * 3, 1, h * 5, 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5));
  }
  return parts;
}

function deadtree(r, color = '#4a3a2a') {
  const H = 1.4 + r() * 0.6, parts = [limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, H, 0), 0.11, color, r)];
  for (let k = 0; k < 4; k++) {
    const y = H * (0.45 + k * 0.14), a = r() * Math.PI * 2, l = 0.4 + r() * 0.3;
    parts.push(limb(new THREE.Vector3(0.05, y, 0), new THREE.Vector3(Math.cos(a) * l, y + l * 0.6, Math.sin(a) * l), 0.04, color, r));
  }
  return parts;
}

function reeds(r) {
  const parts = [];
  for (let k = 0; k < 5; k++) {
    const x = (r() - 0.5) * 0.35, z = (r() - 0.5) * 0.35, h = 0.5 + r() * 0.4;
    parts.push(at(box(0.02, h, 0.02, '#6a8a3a', r), x, h / 2, z, 0, 1, 1, 1, (r() - 0.5) * 0.2));
    if (k % 2 === 0) parts.push(at(paint(new THREE.CapsuleGeometry(0.035, 0.12, 2, 6), '#6a3a1e', 0.1, r), x, h + 0.04, z));
  }
  return parts;
}

function lollipop(r) {
  const c = pick(r, ['#ff4a7a', '#4ad8ff', '#ffd23f', '#8a5aff']), H = 0.9 + r() * 0.5;
  return [at(cyl(0.025, 0.025, H, '#ffffff', r), 0, H / 2, 0), at(cyl(0.32, 0.32, 0.08, c, r, 12), 0, H + 0.2, 0, r() * 3, 1, 1, 1, Math.PI / 2),
    at(cyl(0.2, 0.2, 0.09, '#ffffff', r, 12), 0, H + 0.2, 0, 0, 1, 1, 1, Math.PI / 2), at(cyl(0.1, 0.1, 0.1, c, r, 10), 0, H + 0.2, 0, 0, 1, 1, 1, Math.PI / 2)];
}

function candytree(r) {
  const H = 1.2 + r() * 0.5, parts = [at(cyl(0.06, 0.08, H, '#ffffff', r), 0, H / 2, 0)];
  for (let k = 0; k < 4; k++) parts.push(at(cyl(0.065, 0.085, 0.05, '#ff4a7a', r), 0, 0.15 + k * H * 0.22, 0));
  const c = pick(r, ['#ff9ad8', '#c8b0ff', '#9af0ff', '#fff09a']);
  for (let k = 0; k < 5; k++) { const a = r() * Math.PI * 2, d = k ? 0.32 : 0; parts.push(at(jitter(ico(0.38, c, r, 1, 0.12), 0.3, k + 5), Math.cos(a) * d, H + 0.15 + (k ? 0 : 0.2), Math.sin(a) * d)); }
  return parts;
}

function giantflower(r) {
  const c = pick(r, ['#ff4a7a', '#ffd23f', '#8a5aff', '#4ad8ff']), H = 0.9 + r() * 0.4, parts = [at(cyl(0.035, 0.04, H, '#3fae4a', r), 0, H / 2, 0)];
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; parts.push(at(ico(0.13, c, r), Math.cos(a) * 0.18, H, Math.sin(a) * 0.18, 0, 1, 0.35, 1)); }
  parts.push(at(ico(0.1, '#ffb000', r), 0, H + 0.03, 0, 0, 1, 0.6, 1));
  parts.push(at(ico(0.12, '#4fc04a', r), 0.12, H * 0.4, 0, 0, 1, 0.25, 0.6));
  return parts;
}

function gumdrop(r) {
  const c = pick(r, ['#ff4a7a', '#4ad8ff', '#ffd23f', '#7aff6a', '#c86aff']);
  return [at(paint(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), c, 0.06, r), 0, 0, 0, 0, 1, 1.1)];
}

function crater(r) {
  const R = 0.55 + r() * 0.35;
  return [at(paint(new THREE.TorusGeometry(R, 0.12, 4, 14), '#9a9aa8', 0.15, r), 0, 0.02, 0, 0, 1, 1, 1, Math.PI / 2, 0).scale(1, 0.4, 1),
    at(paint(new THREE.CircleGeometry(R, 14), '#76768a', 0.1, r), 0, 0.012, 0, 0, 1, 1, 1, -Math.PI / 2)];
}

function antenna(r) {
  return [at(cyl(0.03, 0.04, 1.2, '#c8ccd8', r), 0, 0.6, 0), at(paint(new THREE.SphereGeometry(0.3, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2.5), '#e8ecf8', 0.05, r), 0, 1.25, 0.05, 0, 1, 0.5, 1, -1.1),
    at(ico(0.05, '#ff4a5c', r), 0, 1.32, 0.12)];
}

function pebbles(r, cols = ['#8a8a98', '#a8a8b4']) {
  const parts = [];
  for (let k = 0; k < 4; k++) parts.push(at(ico(0.05 + r() * 0.04, pick(r, cols), r), (r() - 0.5) * 0.5, 0.03, (r() - 0.5) * 0.5, r() * 6, 1, 0.6, 1));
  return parts;
}

function house(r) {
  const wall = pick(r, ['#f4e4c8', '#c8e4f4', '#f4c8d8', '#d8f4c8', '#f4f0a8']), roof = pick(r, ['#c8402a', '#4a5a8a', '#6a4a3a', '#2a6a4a']);
  const W = 1.5, D = 1.3, H = 0.9;
  const parts = [at(box(W, H, D, wall, r), 0, H / 2, 0)];
  parts.push(at(paint(new THREE.ConeGeometry(1.15, 0.7, 4), roof, 0.05, r), 0, H + 0.35, 0, Math.PI / 4, 1, 1, D / W));
  parts.push(at(box(0.3, 0.5, 0.04, '#6a3a1e', r), 0, 0.25, D / 2 + 0.01));
  for (const s of [-1, 1]) parts.push(at(box(0.26, 0.24, 0.04, '#8ad8ff', r), s * 0.45, 0.55, D / 2 + 0.01));
  for (const s of [-1, 1]) parts.push(at(box(0.04, 0.24, 0.26, '#8ad8ff', r), s * (W / 2 + 0.01), 0.55, 0));
  parts.push(at(box(0.18, 0.4, 0.18, '#8a5a4a', r), 0.4, H + 0.45, -0.2));
  return parts;
}

function hedge(r) {
  return [at(jitter(box(0.75, 0.55, 0.45, '#2f8a37', r), 0.12, 3), 0, 0.28, 0, r() * 3)];
}

function gnome(r) {
  return [at(cyl(0.08, 0.1, 0.18, '#3a5fbf', r), 0, 0.09, 0), at(ico(0.07, '#f6c9a8', r), 0, 0.23, 0), at(ico(0.07, '#ffffff', r), 0, 0.19, 0.04, 0, 1, 1.1, 0.7),
    at(cone(0.08, 0.2, '#e8334a', r), 0, 0.35, 0)];
}

function lamp(r) {
  return [at(cyl(0.03, 0.05, 1.5, '#2a2a3a', r), 0, 0.75, 0), at(ico(0.1, '#fff0a8', r), 0, 1.55, 0), at(cone(0.13, 0.08, '#2a2a3a', r, 6), 0, 1.65, 0)];
}

function lavarock(r) {
  const parts = rockOf(r, ['#2a2220', '#3a2e2a'], 1.2);
  for (let k = 0; k < 3; k++) parts.push(at(paint(new THREE.OctahedronGeometry(0.05, 0), '#ff6a1a', 0, r), (r() - 0.5) * 0.4, 0.15 + r() * 0.12, (r() - 0.5) * 0.4));
  return parts;
}

function obsidian(r) { return crystal(r, ['#1a1420', '#2a1e34']); }

function charredtree(r) {
  const parts = deadtree(r, '#1e1614');
  for (let k = 0; k < 3; k++) parts.push(at(ico(0.04, '#ff6a1a', r), (r() - 0.5) * 0.4, 0.6 + r() * 0.8, (r() - 0.5) * 0.4));
  return parts;
}

export function buildDecor(d) {
  const all = [];
  for (const it of d.items) {
    const r = mulberry(Math.floor(it.x * 977 + it.z * 131 + d.seed));
    const B = BIOMES[it.b] || d.biome || BIOMES.prairie;
    let parts;
    switch (it.kind) {
      case 'palm': case 'palm2': parts = palm(r); break;
      case 'bush': parts = bush(r); break;
      case 'rock': parts = rock(r); break;
      case 'flowers': parts = flowers(r); break;
      case 'roundtree': case 'autumntree': parts = roundtree(r, B.treeCols || ['#3f9a3d', '#4cb34a']); break;
      case 'pine': parts = pine(r, false); break;
      case 'snowpine': parts = pine(r, true); break;
      case 'cactus': parts = cactus(r); break;
      case 'deadbush': parts = deadbush(r); break;
      case 'redrock': parts = rockOf(r, ['#c0704a', '#a85a3a', '#d08a5a']); break;
      case 'snowrock': parts = [...rockOf(r, ['#9aa0b4', '#8a90a8']), at(ico(0.2, '#ffffff', r, 0, 0.05), 0, 0.22, 0, r() * 3, 1, 0.35, 0.9)]; break;
      case 'moonrock': parts = rockOf(r, ['#9a9aa8', '#b8b8c4', '#7a7a88'], 1.1); break;
      case 'skull': parts = skull(r); break;
      case 'tumbleweed': parts = tumbleweed(r); break;
      case 'mushroom': parts = mushroom(r, false, B.treeCols); break;
      case 'bigshroom': parts = mushroom(r, true, B.treeCols); break;
      case 'pumpkin': parts = pumpkin(r); break;
      case 'leaves': parts = leaves(r); break;
      case 'stump': parts = stump(r); break;
      case 'snowman': parts = snowman(r); break;
      case 'icecrystal': parts = crystal(r, ['#c8ecff', '#a8dcff', '#e8f8ff']); break;
      case 'crystal': parts = crystal(r, B.treeCols); break;
      case 'obsidian': parts = obsidian(r); break;
      case 'deadtree': parts = deadtree(r); break;
      case 'charredtree': parts = charredtree(r); break;
      case 'reeds': parts = reeds(r); break;
      case 'lollipop': parts = lollipop(r); break;
      case 'candytree': parts = candytree(r); break;
      case 'giantflower': parts = giantflower(r); break;
      case 'gumdrop': parts = gumdrop(r); break;
      case 'crater': parts = crater(r); break;
      case 'antenna': parts = antenna(r); break;
      case 'pebbles': parts = pebbles(r); break;
      case 'house': parts = house(r); break;
      case 'hedge': parts = hedge(r); break;
      case 'gnome': parts = gnome(r); break;
      case 'lamp': parts = lamp(r); break;
      case 'lavarock': parts = lavarock(r); break;
      default: parts = tuft(r, d.type[toCell(it.x)][toCell(it.z)] === T.SAND, B.tuft);
    }
    const y = topOf(d.type[toCell(it.x)][toCell(it.z)]);
    for (const p of parts) all.push(at(p, it.x, y, it.z, r() * 0.3));
  }
  // un tapis de petites touffes en plus sur le sol, sans collision, à la densité et aux couleurs du biome
  const B1 = d.biome || BIOMES.prairie;
  for (let i = 0; i < d.type.length; i++) for (let j = 0; j < d.type.length; j++) {
    if (d.type[i][j] !== T.GRASS || hash2(i, j, d.seed + 71) > (B1.carpet ?? 0.22)) continue;
    const r = mulberry(i * 1000 + j + d.seed);
    const x = i - d.type.length / 2 + 0.5 + (r() - 0.5) * 0.8, z = j - d.type.length / 2 + 0.5 + (r() - 0.5) * 0.8;
    for (const p of tuft(r, false, B1.tuft)) all.push(at(p, x, 0, z, 0, 0.8));
  }
  return all.length ? mergeGeometries(all) : null;
}
