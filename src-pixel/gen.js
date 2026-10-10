// Génération d'un étage : une grande île découpée (baies, gouffres), lacs, route, ascenseur, décor.
import { SIZE } from './config.js';
import { mulberry, valueNoise, fbm, hash2 } from './rng.js';

export const T = { VOID: 0, GRASS: 1, SAND: 2, WATER: 3, ROAD: 4 };
export const cellX = (i) => i - SIZE / 2 + 0.5;
export const toCell = (x) => Math.floor(x + SIZE / 2);

const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const grid = (v = 0) => Array.from({ length: SIZE }, () => new Array(SIZE).fill(v));
const inside = (i, j) => i >= 0 && j >= 0 && i < SIZE && j < SIZE;

function bfs(pass, start) {
  const d = grid(-1), par = grid(null), q = [[start.i, start.j]];
  d[start.i][start.j] = 0;
  for (let h = 0; h < q.length; h++) {
    const [i, j] = q[h];
    for (const [di, dj] of N4) {
      const a = i + di, b = j + dj;
      if (!inside(a, b) || d[a][b] >= 0 || !pass(a, b)) continue;
      d[a][b] = d[i][j] + 1; par[a][b] = [i, j]; q.push([a, b]);
    }
  }
  return { d, par };
}

export function generateLevel(index, seed, forced) {
  const S = SIZE, r = mulberry(seed);
  const n1 = valueNoise(seed + 11), n2 = valueNoise(seed + 23), n3 = valueNoise(seed + 37);

  // 1. Forme : des disques qui se chevauchent en chaîne, déformés par du bruit.
  const c0 = forced ? { x: forced.i, z: forced.j } : { x: S / 2 - 0.5 + (r() - 0.5) * 4, z: S / 2 - 0.5 + (r() - 0.5) * 4 };
  const centers = [{ ...c0, rad: 9 + r() * 3 }];
  const want = 4 + Math.floor(r() * 3);
  for (let tries = 0; centers.length < want && tries < 400; tries++) {
    const b = centers[Math.floor(r() * centers.length)], a = r() * Math.PI * 2;
    const d = b.rad * (0.7 + r() * 0.4), rad = 6.5 + r() * 3.5;
    const x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d;
    if (x - rad < 2 || z - rad < 2 || x + rad > S - 3 || z + rad > S - 3) continue;
    centers.push({ x, z, rad });
  }
  const land = grid(0), field = grid(-9);
  for (let i = 2; i < S - 2; i++) for (let j = 2; j < S - 2; j++) {
    let f = -9;
    for (const c of centers) f = Math.max(f, 1 - Math.hypot(i - c.x, j - c.z) / c.rad);
    f += (fbm(n1, i * 0.16, j * 0.16) - 0.5) * 0.95;
    field[i][j] = f;
    if (f > 0.05) land[i][j] = 1;
  }
  // 2. Gouffres, seulement au cœur des terres : on peut y tomber sans que l'île parte en lambeaux.
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++)
    if (land[i][j] && field[i][j] > 0.38 && fbm(n2, i * 0.17, j * 0.17) > 0.66) land[i][j] = 0;
  if (forced) for (let di = -3; di <= 3; di++) for (let dj = -3; dj <= 3; dj++) {
    const a = forced.i + di, b = forced.j + dj;
    if (di * di + dj * dj <= 10 && a > 1 && b > 1 && a < S - 2 && b < S - 2) land[a][b] = 1;
  }
  // 3. Une seule masse de terre : on garde la composante principale.
  let seedCell = forced;
  if (!seedCell) {
    let best = 0;
    const seen = grid(0);
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
      if (!land[i][j] || seen[i][j]) continue;
      const { d } = bfs((a, b) => land[a][b], { i, j });
      let n = 0;
      for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) if (d[a][b] >= 0) { n++; seen[a][b] = 1; }
      if (n > best) { best = n; seedCell = { i, j }; }
    }
  }
  const comp = bfs((a, b) => land[a][b], seedCell).d;
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) if (comp[i][j] < 0) land[i][j] = 0;

  // 4. Distance au bord (sert aux plages, aux lacs et à l'épaisseur du dessous).
  const dist = grid(0), q = [];
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
    if (!land[i][j]) q.push([i, j]); else dist[i][j] = Infinity;
  }
  for (let h = 0; h < q.length; h++) {
    const [i, j] = q[h];
    for (const [di, dj] of N4) {
      const a = i + di, b = j + dj;
      if (inside(a, b) && dist[a][b] > dist[i][j] + 1) { dist[a][b] = dist[i][j] + 1; q.push([a, b]); }
    }
  }
  // 5. Types de sol.
  const type = grid(T.VOID), depth = grid(0);
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
    if (!land[i][j]) continue;
    const d = dist[i][j];
    type[i][j] = d === 1 || (d === 2 && fbm(n3, i * 0.25, j * 0.25) > 0.68) ? T.SAND : T.GRASS;
    if (d >= 3 && fbm(n3, i * 0.12 + 50, j * 0.12 + 50) > 0.64) type[i][j] = T.WATER;
    depth[i][j] = 0.9 + Math.pow(Math.min(d, 10), 1.3) * 0.5 + hash2(i, j, seed) * 0.7;
  }
  // Point de départ du premier étage : le plus loin possible des bords.
  let center = forced;
  if (!center) {
    let best = -1;
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
      if (type[i][j] !== T.GRASS) continue;
      const score = dist[i][j] * 10 - Math.hypot(i - S / 2, j - S / 2);
      if (score > best) { best = score; center = { i, j }; }
    }
  }
  return { index, seed, type, dist, depth, center };
}

// Place l'ascenseur, la route et le décor. `start` est le point d'arrivée sur l'étage.
export function placeFeatures(d, start, isTop) {
  const S = SIZE, r = mulberry(d.seed * 3 + 7), Tt = d.type;
  const reserved = grid(0);
  const reserve = (ci, cj, rad) => {
    for (let i = Math.floor(ci - rad); i <= ci + rad; i++) for (let j = Math.floor(cj - rad); j <= cj + rad; j++)
      if (inside(i, j) && (i - ci) ** 2 + (j - cj) ** 2 <= rad * rad) reserved[i][j] = 1;
  };
  const dry = (ci, cj, rad) => {
    for (let i = ci - rad; i <= ci + rad; i++) for (let j = cj - rad; j <= cj + rad; j++)
      if (inside(i, j) && Tt[i][j] === T.WATER) Tt[i][j] = T.GRASS;
  };
  dry(start.i, start.j, 3);
  reserve(start.i, start.j, 2.6);
  for (let j = start.j; j <= start.j + 2; j++) if (inside(start.i, j)) reserved[start.i][j] = 1;
  const walk = bfs((a, b) => Tt[a][b] !== T.VOID, start).d;

  // Ascenseur : loin du point d'arrivée, avec de la place devant.
  d.elevator = null;
  if (!isTop) {
    const cands = [];
    for (let i = 2; i < S - 2; i++) for (let j = 2; j < S - 3; j++) {
      if (Tt[i][j] !== T.GRASS || d.dist[i][j] < 3 || walk[i][j] < 8) continue;
      let ok = true;
      for (let di = -1; di <= 1 && ok; di++) for (let dj = -1; dj <= 2 && ok; dj++) {
        const t = Tt[i + di][j + dj];
        if (t === T.VOID || t === T.WATER) ok = false;
      }
      if (ok) cands.push({ i, j, w: walk[i][j] });
    }
    cands.sort((a, b) => b.w - a.w);
    const pick = cands[Math.floor(r() * Math.max(1, Math.ceil(cands.length * 0.15)))];
    if (pick) {
      d.elevator = { i: pick.i, j: pick.j };
      dry(pick.i, pick.j, 2);
      reserve(pick.i, pick.j, 1.8);
      for (let j = pick.j; j <= pick.j + 3; j++) for (let i = pick.i - 1; i <= pick.i + 1; i++) if (inside(i, j)) reserved[i][j] = 1;
    }
  }

  // Route : du point d'arrivée vers un coin lointain de l'île (pas vers l'ascenseur : il faut explorer).
  const pass = (a, b) => Tt[a][b] === T.GRASS || Tt[a][b] === T.ROAD;
  const rb = bfs(pass, start);
  let maxW = 0;
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) maxW = Math.max(maxW, rb.d[i][j]);
  const ends = [];
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
    const w = rb.d[i][j];
    if (w < maxW * 0.55 || w > maxW * 0.85 || Tt[i][j] !== T.GRASS) continue;
    if (d.elevator && Math.hypot(i - d.elevator.i, j - d.elevator.j) < 7) continue;
    ends.push({ i, j });
  }
  if (ends.length) {
    let cur = ends[Math.floor(r() * ends.length)];
    while (cur) {
      if (Tt[cur.i][cur.j] === T.GRASS) Tt[cur.i][cur.j] = T.ROAD;
      const p = rb.par[cur.i][cur.j];
      cur = p ? { i: p[0], j: p[1] } : null;
    }
  }

  // Décor.
  d.items = []; d.solids = [];
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
    const t = Tt[i][j];
    if (!t || t === T.WATER || t === T.ROAD || reserved[i][j]) continue;
    const h = hash2(i, j, d.seed + 99);
    const x = cellX(i) + (hash2(i, j, d.seed + 5) - 0.5) * 0.5, z = cellX(j) + (hash2(i, j, d.seed + 6) - 0.5) * 0.5;
    const flip = hash2(j, i, d.seed + 8) < 0.5;
    let kind = null, solid = 0;
    if (t === T.GRASS) {
      if (h < 0.032 && d.dist[i][j] >= 2) { kind = hash2(i, j, 3) < 0.5 ? 'palm' : 'palm2'; solid = 0.3; }
      else if (h < 0.055) { kind = 'bush'; solid = 0.42; }
      else if (h < 0.1) kind = 'flowers';
      else if (h < 0.2) kind = 'tuft';
      else if (h < 0.212) { kind = 'rock'; solid = 0.38; }
    } else if (t === T.SAND) {
      if (h < 0.03) { kind = 'rock'; solid = 0.38; }
      else if (h < 0.08) kind = 'tuft';
    }
    if (!kind) continue;
    d.items.push({ kind, x, z, flip });
    if (solid) d.solids.push({ x, z, r: solid });
  }
  d.start = start;
}
