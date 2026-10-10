// Terrain d'un étage en blocs : dessus colorés case par case (herbe, sable, route, fond des lacs),
// falaises en strates de terre qui s'assombrissent en profondeur, dessous rocheux en gradins.
import * as THREE from 'three';
import { SIZE, WATER_Y, BASIN } from './config.js';
import { T, cellX } from './gen.js';
import { hash2, valueNoise, fbm } from './rng.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const col = (hex) => new THREE.Color(hex);
const C = {
  grass: [col('#4fae45'), col('#62c252'), col('#3f9a3d')],
  sand: [col('#efd296'), col('#e2c07c')],
  road: [col('#5b6074'), col('#676c82')],
  floor: col('#b3935c'),
  lip: { [T.GRASS]: col('#3c8a37'), [T.SAND]: col('#d4b16c'), [T.ROAD]: col('#a3a9bd'), [T.WATER]: col('#a88552') },
  basin: col('#a88552'),
  dirt: [col('#9a6440'), col('#87552f'), col('#a5704a'), col('#7a4a2c')],
  bottom: col('#3a2419'),
  dash: col('#ffd23f'),
};
const TOP = { [T.GRASS]: 0, [T.SAND]: -0.1, [T.ROAD]: -0.04, [T.WATER]: -BASIN };

class Builder {
  constructor() { this.P = []; this.N = []; this.C = []; this.I = []; }
  quad(a, b, c, d, n, k) {
    const i = this.P.length / 3;
    this.P.push(...a, ...b, ...c, ...d);
    for (let q = 0; q < 4; q++) { this.N.push(...n); this.C.push(k[q].r, k[q].g, k[q].b); }
    this.I.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setIndex(this.I);
    g.computeBoundingSphere();
    return g;
  }
}

export function buildTerrain(d) {
  const b = new Builder(), Tt = d.type, n = valueNoise(d.seed + 501);
  const at = (i, j) => (i < 0 || j < 0 || i >= SIZE || j >= SIZE ? 0 : Tt[i][j]);
  const tmp = new THREE.Color();

  // couleur du dessus en un point du monde : nuances douces + léger damier de blocs
  const topColor = (t, x, z, cellK) => {
    const f = fbm(n, x * 0.18, z * 0.18), g = fbm(n, x * 0.7 + 30, z * 0.7);
    let c;
    if (t === T.GRASS) c = tmp.copy(C.grass[0]).lerp(C.grass[1], Math.min(1, f * 1.4)).lerp(C.grass[2], Math.max(0, g - 0.55) * 1.6);
    else if (t === T.SAND) c = tmp.copy(C.sand[0]).lerp(C.sand[1], f);
    else if (t === T.ROAD) c = tmp.copy(C.road[0]).lerp(C.road[1], g);
    else c = tmp.copy(C.floor);
    return c.clone().multiplyScalar(cellK);
  };
  const dirtAt = (y, depth) => {
    const band = Math.floor(-y * 2) & 3;
    return C.dirt[band].clone().multiplyScalar(1 - 0.45 * Math.min(1, -y / Math.max(depth, 1)));
  };

  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
    const t = at(i, j);
    if (!t) continue;
    const x = cellX(i), z = cellX(j), h = d.depth[i][j], top = TOP[t];
    const k = 0.94 + hash2(i, j, d.seed + 3) * 0.1;
    const corners = [[x - 0.5, z - 0.5], [x - 0.5, z + 0.5], [x + 0.5, z + 0.5], [x + 0.5, z - 0.5]];
    b.quad(...corners.map(([cx, cz]) => [cx, top, cz]), [0, 1, 0], corners.map(([cx, cz]) => topColor(t, cx, cz, k)));

    for (const [dx, dz] of DIRS) {
      const nt = at(i + dx, j + dz);
      const cx = x + dx * 0.5, cz = z + dz * 0.5, rx = dz, rz = -dx;
      const side = (yt, yb, ct, cb) => b.quad(
        [cx - rx * 0.5, yt, cz - rz * 0.5], [cx - rx * 0.5, yb, cz - rz * 0.5],
        [cx + rx * 0.5, yb, cz + rz * 0.5], [cx + rx * 0.5, yt, cz + rz * 0.5], [dx, 0, dz], [ct, cb, cb, ct]);
      // paroi de top jusqu'à bottom : liseré de la matière du dessus, puis strates de terre
      const wall = (yt, yb, lipColor) => {
        let y = yt;
        if (lipColor) {
          const y2 = Math.max(yb, yt - 0.22);
          side(y, y2, lipColor, lipColor.clone().multiplyScalar(0.8));
          y = y2;
        }
        while (y > yb + 1e-4) {
          const y2 = Math.max(yb, Math.floor((y - 1e-4) * 2) / 2);
          side(y, y2, dirtAt(y + 1e-3, h), dirtAt(y2 + 1e-3, h));
          y = y2;
        }
      };
      if (!nt) { wall(top, -h, C.lip[t]); continue; }
      const ntop = TOP[nt];
      if (ntop < top) {
        if (nt === T.WATER) side(top, ntop, C.basin, C.basin.clone().multiplyScalar(0.7));
        else side(top, ntop, C.lip[t], C.lip[t].clone().multiplyScalar(0.85));
      }
      const hn = d.depth[i + dx][j + dz];
      if (hn < h) wall(-hn, -h, null);
    }
    const bc = C.bottom;
    b.quad([x - 0.5, -h, z - 0.5], [x + 0.5, -h, z - 0.5], [x + 0.5, -h, z + 0.5], [x - 0.5, -h, z + 0.5], [0, -1, 0], [bc, bc, bc, bc]);
  }

  // pointillés jaunes sur les portions de route droites
  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
    if (at(i, j) !== T.ROAD) continue;
    const ns = at(i, j - 1) === T.ROAD && at(i, j + 1) === T.ROAD, ew = at(i - 1, j) === T.ROAD && at(i + 1, j) === T.ROAD;
    if (ns === ew) continue;
    const x = cellX(i), z = cellX(j), y = TOP[T.ROAD] + 0.005, a = ns ? 0.07 : 0.22, c = ns ? 0.22 : 0.07;
    const k = [C.dash, C.dash, C.dash, C.dash];
    b.quad([x - a, y, z - c], [x - a, y, z + c], [x + a, y, z + c], [x + a, y, z - c], [0, 1, 0], k);
  }
  return b.geometry();
}

// Surface des lacs, découpée en 4 × 4 par case ; chaque sommet porte « aShore », proximité de la
// berge (1 au bord, 0 à 0,7 unité et au-delà) : écume, eau claire près des rives.
export function buildWater(d) {
  const b = new Builder(), w = col('#3a8fe8'), k = [w, w, w, w], shore = [], S = 4;
  const dry = (i, j) => i < 0 || j < 0 || i >= SIZE || j >= SIZE || d.type[i][j] !== T.WATER;
  const shoreAt = (x, z, i, j) => {
    let best = 9;
    for (let a = i - 1; a <= i + 1; a++) for (let c = j - 1; c <= j + 1; c++) {
      if (!dry(a, c)) continue;
      const dx = Math.max(0, Math.abs(x - cellX(a)) - 0.5), dz = Math.max(0, Math.abs(z - cellX(c)) - 0.5);
      best = Math.min(best, Math.hypot(dx, dz));
    }
    return Math.max(0, 1 - best / 0.7);
  };
  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
    if (d.type[i][j] !== T.WATER) continue;
    const x0 = cellX(i) - 0.5, z0 = cellX(j) - 0.5;
    for (let u = 0; u < S; u++) for (let v = 0; v < S; v++) {
      const xa = x0 + u / S, xb = x0 + (u + 1) / S, za = z0 + v / S, zb = z0 + (v + 1) / S;
      b.quad([xa, WATER_Y, za], [xa, WATER_Y, zb], [xb, WATER_Y, zb], [xb, WATER_Y, za], [0, 1, 0], k);
      shore.push(shoreAt(xa, za, i, j), shoreAt(xa, zb, i, j), shoreAt(xb, zb, i, j), shoreAt(xb, za, i, j));
    }
  }
  if (!b.P.length) return null;
  const g = b.geometry();
  g.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1));
  return g;
}

export const topOf = (t) => TOP[t] ?? 0;
