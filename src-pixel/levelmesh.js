// Géométrie d'un étage : dessus des tuiles, falaises, dessous rocheux, lacs, sprites de décor.
import * as THREE from 'three';
import { SIZE, SLAB, WATER_Y, BASIN, PX, SY } from './config.js';
import { TILE, ATLAS, DECOR, DECOR_W, DECOR_H } from './assets.js';
import { T, cellX } from './gen.js';
import { hash2 } from './rng.js';

const DIRS = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];

function tileUV(t, f0 = 0, f1 = 1) {
  const c = t % 16, r = Math.floor(t / 16), e = 0.02;
  return {
    u0: (c * 16 + e) / ATLAS, u1: ((c + 1) * 16 - e) / ATLAS,
    vt: 1 - (r * 16 + f0 * 16 + e) / ATLAS, vb: 1 - (r * 16 + f1 * 16 - e) / ATLAS,
  };
}

class Builder {
  constructor() { this.P = []; this.N = []; this.UV = []; this.I = []; }
  quad(a, b, c, d, n, uv) {
    const k = this.P.length / 3;
    this.P.push(...a, ...b, ...c, ...d);
    for (let q = 0; q < 4; q++) this.N.push(...n);
    this.UV.push(uv.u0, uv.vt, uv.u0, uv.vb, uv.u1, uv.vb, uv.u1, uv.vt);
    this.I.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.UV, 2));
    g.setIndex(this.I);
    g.computeBoundingSphere();
    return g;
  }
}

export function buildTerrain(d) {
  const b = new Builder(), Tt = d.type;
  const at = (i, j) => (i < 0 || j < 0 || i >= SIZE || j >= SIZE ? 0 : Tt[i][j]);
  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
    const t = at(i, j);
    if (!t) continue;
    const x = cellX(i), z = cellX(j), h = d.depth[i][j], top = t === T.WATER ? -BASIN : 0;
    let tile;
    if (t === T.GRASS) {
      const hh = hash2(i, j, d.seed);
      tile = hh < 0.09 ? TILE.FLOWER + (hh < 0.045 ? 0 : 1) : TILE.GRASS + ((hash2(j, i, d.seed + 1) * 4) | 0);
    } else if (t === T.SAND) {
      let m = 0;
      for (const [dx, dz, bit] of DIRS) { const n = at(i + dx, j + dz); if (n === T.GRASS || n === T.ROAD) m |= bit; }
      tile = TILE.SAND + m;
    } else if (t === T.ROAD) {
      let m = 0;
      for (const [dx, dz, bit] of DIRS) if (at(i + dx, j + dz) === T.ROAD) m |= bit;
      tile = TILE.ROAD + m;
    } else tile = TILE.FLOOR;
    b.quad([x - 0.5, top, z - 0.5], [x - 0.5, top, z + 0.5], [x + 0.5, top, z + 0.5], [x + 0.5, top, z - 0.5], [0, 1, 0], tileUV(tile));

    for (const [dx, dz] of DIRS) {
      const n = at(i + dx, j + dz);
      const cx = x + dx * 0.5, cz = z + dz * 0.5, rx = dz, rz = -dx;
      const side = (yt, yb, uv) => b.quad(
        [cx - rx * 0.5, yt, cz - rz * 0.5], [cx - rx * 0.5, yb, cz - rz * 0.5],
        [cx + rx * 0.5, yb, cz + rz * 0.5], [cx + rx * 0.5, yt, cz + rz * 0.5], [dx, 0, dz], uv);
      const rock = (yt, yb) => {
        for (let y = yt, k = 0; y > yb + 1e-4; y -= 1, k++) {
          const y2 = Math.max(yb, y - 1);
          side(y, y2, tileUV(TILE.ROCK + ((hash2(i * 3 + dx + 7, j * 3 + dz + 7, k) * 2) | 0), 0, y - y2));
        }
      };
      if (n === T.VOID) {
        side(top, top - SLAB, tileUV(t === T.SAND ? TILE.LIP_SAND : TILE.LIP_GRASS, 0, SLAB));
        rock(top - SLAB, -h);
      } else {
        if (t !== T.WATER && n === T.WATER) side(0, -BASIN, tileUV(TILE.BASIN, 0, BASIN));
        const hn = d.depth[i + dx][j + dz];
        if (hn < h) rock(-hn, -h);
      }
    }
    b.quad([x - 0.5, -h, z - 0.5], [x + 0.5, -h, z - 0.5], [x + 0.5, -h, z + 0.5], [x - 0.5, -h, z + 0.5], [0, -1, 0], tileUV(TILE.ROCK_DARK));
  }
  return b.geometry();
}

export function buildWater(d) {
  const b = new Builder();
  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
    if (d.type[i][j] !== T.WATER) continue;
    const x = cellX(i), z = cellX(j);
    const u0 = (x - 0.5) / 2, u1 = (x + 0.5) / 2, vt = -(z - 0.5) / 2, vb = -(z + 0.5) / 2;
    b.quad([x - 0.5, WATER_Y, z - 0.5], [x - 0.5, WATER_Y, z + 0.5], [x + 0.5, WATER_Y, z + 0.5], [x + 0.5, WATER_Y, z - 0.5], [0, 1, 0], { u0, u1, vt, vb });
  }
  return b.P.length ? b.geometry() : null;
}

// Alignement sur la grille de pixels de l'écran (voir render.js).
export const snapX = (x) => Math.round(x * PX) / PX;
export const snapZ0 = (z) => Math.round(z * 12) / 12;

function decorUV(name, flip) {
  const [ax, ay, w, h] = DECOR[name];
  const u0 = ax / DECOR_W, u1 = (ax + w) / DECOR_W;
  return { u0: flip ? u1 : u0, u1: flip ? u0 : u1, vt: 1 - ay / DECOR_H, vb: 1 - (ay + h) / DECOR_H };
}

export function uprightQuad(b, name, x, z, flip = false, y = 0) {
  const [, , w, h] = DECOR[name];
  const left = Math.round((x - w / 32) * PX) / PX, W = w / PX, H = (h / PX) * SY;
  b.quad([left, y + H, z], [left, y, z], [left + W, y, z], [left + W, y + H, z], [0, 0, 1], decorUV(name, flip));
}

export function flatQuad(b, name, x, z, y = 0.015) {
  const [, , w, h] = DECOR[name];
  const W = w / PX / 2, D = h / PX / 0.75 / 2;
  b.quad([x - W, y, z - D], [x - W, y, z + D], [x + W, y, z + D], [x + W, y, z - D], [0, 1, 0], decorUV(name, false));
}

export function buildDecor(d) {
  const b = new Builder();
  for (const it of d.items) {
    const z = snapZ0(it.z);
    if (it.kind === 'palm' || it.kind === 'palm2') flatQuad(b, 'blobL', it.x + 0.2, z - 0.1);
    else if (it.kind === 'bush') flatQuad(b, 'blobS', it.x, z - 0.05);
    uprightQuad(b, it.kind, it.x, z, it.flip);
  }
  return b.P.length ? b.geometry() : null;
}

export { Builder };
