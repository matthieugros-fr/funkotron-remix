// Terrain d'un étage en blocs : dessus colorés case par case selon le biome (sol, rivage, route, glace, fond des lacs),
// falaises en strates de terre qui s'assombrissent en profondeur, dessous rocheux en gradins.
import * as THREE from 'three';
import { SIZE, WATER_Y, BASIN } from './config.js';
import { T, cellX, regionValue, REGION_T } from './gen.js';
import { hash2, valueNoise, fbm } from './rng.js';
import { BIOMES, ROADS } from './biomes.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const col = (hex) => new THREE.Color(hex);
const TOP = { [T.GRASS]: 0, [T.SAND]: -0.1, [T.ROAD]: -0.04, [T.WATER]: -BASIN, [T.ICE]: -0.02 };
const ICE = [col('#8ccdf2'), col('#6ab4e6'), col('#d4f0ff')];
const OCEAN_DEEP = col('#0b2a6e');
// fond des lacs selon le liquide
const FLOOR = { water: '#b3935c', oasis: '#d8b878', pool: '#dff2ff', goo: '#3a3018', soda: '#ffd0e0', glow: '#2a2a6a', lava: '#2a0a04' };

// couleurs d'un biome, converties une fois
const PAL = new Map();
function pal(B) {
  if (!PAL.has(B)) PAL.set(B, {
    ground: B.ground.map(col), patch: col(B.patch), lip: col(B.lip), shore: B.shore.map(col), shoreLip: col(B.shoreLip),
    dirt: B.strata.map(col), bottom: col(B.bottom), road: ROADS[B.road],
    roadCols: ROADS[B.road].cols.map(col), roadLip: col(ROADS[B.road].lip),
  });
  return PAL.get(B);
}

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
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  const P1 = pal(d.biome || BIOMES.prairie), P2 = pal(d.biome2 || d.biome || BIOMES.prairie);
  const B1 = d.biome || BIOMES.prairie, B2 = d.biome2 || B1;
  const floor = col(FLOOR[B1.liquid] || FLOOR.water), floor2 = col(FLOOR[B2.liquid] || FLOOR[B1.liquid] || FLOOR.water), road = P1.road;

  // couleur d'un biome en un point : nuances douces, taches franches (prés fleuris, tapis de feuilles…), bandes de tonte
  const groundOf = (P, B, t, x, z, f, g) => {
    if (t === T.GRASS) {
      const c = tmp2.copy(P.ground[0]).lerp(P.ground[1], Math.min(1, f * 1.4)).lerp(P.ground[2], Math.max(0, g - 0.55) * 1.6);
      const pv = fbm(n, x * 0.11 + 70, z * 0.11 - 40);
      c.lerp(P.patch, THREE.MathUtils.smoothstep(pv, 0.6, 0.66) * 0.85);
      if (B.stripes && Math.floor((x + z) * 0.5) % 2 === 0) c.multiplyScalar(1.08);
      return c;
    }
    if (t === T.SAND) return tmp2.copy(P.shore[0]).lerp(P.shore[1], f);
    return null;
  };
  // couleur du dessus en un point du monde, fondue entre les deux biomes à la frontière des régions
  const topColor = (t, x, z, cellK, i, j) => {
    const f = fbm(n, x * 0.18, z * 0.18), g = fbm(n, x * 0.7 + 30, z * 0.7);
    let c;
    if (t === T.GRASS || t === T.SAND) {
      const m = THREE.MathUtils.smoothstep(regionValue(d, x, z), REGION_T - 0.025, REGION_T + 0.025);
      c = tmp.copy(groundOf(P1, B1, t, x, z, f, g));
      if (m > 0) c.lerp(groundOf(P2, B2, t, x, z, f, g), m);
    } else if (t === T.ROAD) c = road.checker ? tmp.copy(P1.roadCols[(i + j) & 1]) : tmp.copy(P1.roadCols[0]).lerp(P1.roadCols[1], g);
    else if (t === T.ICE) c = tmp.copy(ICE[0]).lerp(ICE[1], f).lerp(ICE[2], Math.max(0, g - 0.6) * 2.2);
    else {
      c = tmp.copy(regionValue(d, x, z) > REGION_T ? floor2 : floor);
      // l'océan du premier étage : le fond plonge vers le bleu profond en s'éloignant des côtes
      if (d.ocean?.[i]?.[j]) c.lerp(OCEAN_DEEP, Math.min(1, (d.oceanDist[i][j] - 1) / 4));
    }
    return c.clone().multiplyScalar(cellK);
  };
  const dirtAt = (y, depth) => {
    const band = Math.floor(-y * 2) & 3;
    return P1.dirt[band].clone().multiplyScalar(1 - 0.45 * Math.min(1, -y / Math.max(depth, 1)));
  };
  const lipOf = (t, i, j) => {
    const P = regionValue(d, cellX(i), cellX(j)) > REGION_T ? P2 : P1;
    return t === T.GRASS ? P.lip : t === T.SAND ? P.shoreLip : t === T.ROAD ? P1.roadLip : t === T.ICE ? ICE[1] : floor;
  };

  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
    const t = at(i, j);
    if (!t) continue;
    const x = cellX(i), z = cellX(j), h = d.depth[i][j], top = TOP[t];
    const k = 0.94 + hash2(i, j, d.seed + 3) * 0.1;
    const corners = [[x - 0.5, z - 0.5], [x - 0.5, z + 0.5], [x + 0.5, z + 0.5], [x + 0.5, z - 0.5]];
    b.quad(...corners.map(([cx, cz]) => [cx, top, cz]), [0, 1, 0], corners.map(([cx, cz]) => topColor(t, cx, cz, k, i, j)));

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
      const lip = lipOf(t, i, j);
      if (!nt) { wall(top, -h, lip); continue; }
      const ntop = TOP[nt];
      if (ntop < top) {
        if (nt === T.WATER) side(top, ntop, floor, floor.clone().multiplyScalar(0.7));
        else side(top, ntop, lip, lip.clone().multiplyScalar(0.85));
      }
      const hn = d.depth[i + dx][j + dz];
      if (hn < h) wall(-hn, -h, null);
    }
    const bc = P1.bottom;
    b.quad([x - 0.5, -h, z - 0.5], [x + 0.5, -h, z - 0.5], [x + 0.5, -h, z + 0.5], [x - 0.5, -h, z + 0.5], [0, -1, 0], [bc, bc, bc, bc]);
  }

  // marquage des routes : pointillés sur les portions droites, ou joints de planches et de dalles
  const dash = road.dash ? col(road.dash) : null, seam = road.planks ? col(road.planks) : null;
  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
    if (at(i, j) !== T.ROAD) continue;
    const ns = at(i, j - 1) === T.ROAD || at(i, j + 1) === T.ROAD, ew = at(i - 1, j) === T.ROAD || at(i + 1, j) === T.ROAD;
    const x = cellX(i), z = cellX(j), y = TOP[T.ROAD] + 0.005;
    if (seam) {
      // trois planches (ou dalles) par case, en travers de la route
      const k = [seam, seam, seam, seam], across = ns && !ew;
      for (const o of [-0.5, -1 / 6, 1 / 6]) {
        if (across) b.quad([x - 0.5, y, z + o - 0.015], [x - 0.5, y, z + o + 0.015], [x + 0.5, y, z + o + 0.015], [x + 0.5, y, z + o - 0.015], [0, 1, 0], k);
        else b.quad([x + o - 0.015, y, z - 0.5], [x + o - 0.015, y, z + 0.5], [x + o + 0.015, y, z + 0.5], [x + o + 0.015, y, z - 0.5], [0, 1, 0], k);
      }
      continue;
    }
    const straightNS = at(i, j - 1) === T.ROAD && at(i, j + 1) === T.ROAD, straightEW = at(i - 1, j) === T.ROAD && at(i + 1, j) === T.ROAD;
    if (!dash || straightNS === straightEW) continue;
    const a = straightNS ? 0.07 : 0.22, c = straightNS ? 0.22 : 0.07;
    const k = [dash, dash, dash, dash];
    b.quad([x - a, y, z - c], [x - a, y, z + c], [x + a, y, z + c], [x + a, y, z - c], [0, 1, 0], k);
  }
  return b.geometry();
}

// Surface des lacs, découpée en 4 × 4 par case ; chaque sommet porte « aShore », proximité de la
// berge (1 au bord, 0 à 0,7 unité et au-delà) : écume, eau claire près des rives.
export function buildWater(d) {
  const b = new Builder(), w = col('#3a8fe8'), k = [w, w, w, w], shore = [], liq = [], S = 4;
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
    // le détail de l'écume ne sert qu'au bord : loin des rives, un seul carré par case
    let nearDry = false;
    for (let a = i - 1; a <= i + 1 && !nearDry; a++) for (let c = j - 1; c <= j + 1; c++) if (dry(a, c) && a >= 0 && c >= 0 && a < SIZE && c < SIZE) { nearDry = true; break; }
    const n = nearDry ? S : 1;
    for (let u = 0; u < n; u++) for (let v = 0; v < n; v++) {
      const xa = x0 + u / n, xb = x0 + (u + 1) / n, za = z0 + v / n, zb = z0 + (v + 1) / n;
      b.quad([xa, WATER_Y, za], [xa, WATER_Y, zb], [xb, WATER_Y, zb], [xb, WATER_Y, za], [0, 1, 0], k);
      shore.push(shoreAt(xa, za, i, j), shoreAt(xa, zb, i, j), shoreAt(xb, zb, i, j), shoreAt(xb, za, i, j));
      const sec = regionValue(d, cellX(i), cellX(j)) > REGION_T ? 1 : 0;
      liq.push(sec, sec, sec, sec);
    }
  }
  if (!b.P.length) return null;
  const g = b.geometry();
  g.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1));
  g.setAttribute('aLiq', new THREE.Float32BufferAttribute(liq, 1));
  return g;
}

// L'océan du premier étage continue au-delà de la carte : un grand cadre d'eau et de fond marin autour d'elle.
export function buildOceanFrame(far = 160) {
  const h = SIZE / 2, w = new Builder(), f = new Builder(), wc = col('#3a8fe8'), deep = OCEAN_DEEP.clone().multiplyScalar(0.94);
  const k = [wc, wc, wc, wc], kd = [deep, deep, deep, deep];
  const rects = [[-far, -far, far, -h], [-far, h, far, far], [-far, -h, -h, h], [h, -h, far, h]];
  for (const [x0, z0, x1, z1] of rects) {
    w.quad([x0, WATER_Y, z0], [x0, WATER_Y, z1], [x1, WATER_Y, z1], [x1, WATER_Y, z0], [0, 1, 0], k);
    f.quad([x0, -BASIN, z0], [x0, -BASIN, z1], [x1, -BASIN, z1], [x1, -BASIN, z0], [0, 1, 0], kd);
  }
  const water = w.geometry(), n = water.attributes.position.count;
  water.setAttribute('aShore', new THREE.Float32BufferAttribute(new Array(n).fill(0), 1));
  water.setAttribute('aLiq', new THREE.Float32BufferAttribute(new Array(n).fill(0), 1));
  return { water, floor: f.geometry() };
}

export const topOf = (t) => TOP[t] ?? 0;
