// Décor en volumes à facettes (palmiers, buissons, rochers, fleurs, touffes d'herbe).
// Chaque étage fusionne tout son décor en un seul maillage coloré par sommet.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry, hash2 } from './rng.js';
import { topOf } from './terrain3d.js';
import { T, toCell } from './gen.js';

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

function tuft(r, sandy) {
  const parts = [], cols = sandy ? ['#9bb35a', '#b9c46e'] : ['#3f9a3d', '#5cbf4a', '#2f8a37'];
  for (let k = 0; k < 6; k++) {
    const h = 0.18 + r() * 0.2, w = 0.035, a = r() * Math.PI * 2, lean = (r() - 0.5) * 0.7;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, lean * h, h, 0], 3));
    parts.push(at(paint(g, cols[k % cols.length], 0.1, r), Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12, a));
  }
  return parts;
}

export function buildDecor(d) {
  const all = [];
  for (const it of d.items) {
    const r = mulberry(Math.floor(it.x * 977 + it.z * 131 + d.seed));
    let parts;
    switch (it.kind) {
      case 'palm': case 'palm2': parts = palm(r); break;
      case 'bush': parts = bush(r); break;
      case 'rock': parts = rock(r); break;
      case 'flowers': parts = flowers(r); break;
      default: parts = tuft(r, d.type[toCell(it.x)][toCell(it.z)] === T.SAND);
    }
    const y = topOf(d.type[toCell(it.x)][toCell(it.z)]);
    for (const p of parts) all.push(at(p, it.x, y, it.z, r() * 0.3));
  }
  // un tapis de petites touffes en plus sur l'herbe, sans collision
  for (let i = 0; i < d.type.length; i++) for (let j = 0; j < d.type.length; j++) {
    if (d.type[i][j] !== T.GRASS || hash2(i, j, d.seed + 71) > 0.22) continue;
    const r = mulberry(i * 1000 + j + d.seed);
    const x = i - d.type.length / 2 + 0.5 + (r() - 0.5) * 0.8, z = j - d.type.length / 2 + 0.5 + (r() - 0.5) * 0.8;
    for (const p of tuft(r, false)) all.push(at(p, x, 0, z, 0, 0.8));
  }
  return all.length ? mergeGeometries(all) : null;
}
