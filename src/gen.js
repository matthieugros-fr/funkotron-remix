// Génération d'un étage : une grande île découpée (baies, gouffres), lacs, route, ascenseur, décor.
import { SIZE } from './config.js';
import { mulberry, valueNoise, fbm, hash2 } from './rng.js';
import { rollPresent, rollFood, EARTHLINGS } from './catalog.js';
import { BIOMES, LIQUIDS } from './biomes.js';

export const T = { VOID: 0, GRASS: 1, SAND: 2, WATER: 3, ROAD: 4, ICE: 5 };

// Région du biome secondaire : un grand bruit doux ; au-dessus du seuil, c'est le secondaire.
export const REGION_T = 0.56;
export function regionValue(d, x, z) {
  d._rn ||= valueNoise(d.seed + 31);
  return fbm(d._rn, (x + SIZE / 2) * 0.06, (z + SIZE / 2) * 0.06);
}
export function biomeAt(d, x, z) { return regionValue(d, x, z) > REGION_T ? d.biome2 : d.biome; }
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

export function generateLevel(index, seed, forced, biomes = ['prairie', 'banlieue']) {
  const S = SIZE, r = mulberry(seed);
  const biome = BIOMES[biomes[0]], biome2 = BIOMES[biomes[1]], liquid = LIQUIDS[biome.liquid];
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
    if (land[i][j] && field[i][j] > 0.38 && fbm(n2, i * 0.17, j * 0.17) > 0.68 - Math.min(index, 24) * 0.004) land[i][j] = 0;
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
    if (d >= 3 && !liquid.none && fbm(n3, i * 0.12 + 50, j * 0.12 + 50) > biome.lakes) type[i][j] = liquid.ice ? T.ICE : T.WATER;
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
  return { index, seed, type, dist, depth, center, biome, biome2, biomeIds: biomes };
}

// Place l'ascenseur, la route et le décor. `start` est le point d'arrivée sur l'étage.
export function placeFeatures(d, start, { isTop = false, piece = null, record = false } = {}) {
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

  // Surprises de l'étage (piste de disco, geyser et îlot au trésor, portails, croix à creuser, étoiles filantes),
  // et parfois un disque d'or caché.
  d.surprises = [];
  if (d.index >= 0 && d.index < 25) placeSurprises(d, r, reserved, reserve, walk, start, record);

  // Objets à ramasser : posés avant le décor, qui s'écarte d'eux.
  const free = [];
  for (let i = 2; i < S - 2; i++) for (let j = 2; j < S - 2; j++) {
    const t = Tt[i][j];
    if ((t === T.GRASS || t === T.SAND || t === T.ROAD) && !reserved[i][j] && walk[i][j] >= 3) free.push({ i, j, w: walk[i][j], d: d.dist[i][j] });
  }
  const takeCell = (list) => {
    while (list.length) {
      const c = list.splice(Math.floor(r() * list.length), 1)[0];
      if (!reserved[c.i][c.j]) { reserve(c.i, c.j, 1.2); return c; }
    }
    return null;
  };
  const jit = () => (r() - 0.5) * 0.3;
  d.piece = null;
  if (piece !== null) {
    // le morceau du vaisseau : loin de l'arrivée, de préférence au bord du vide
    const maxW = Math.max(...free.map((c) => c.w));
    let cand = free.filter((c) => c.w >= maxW * 0.55 && c.d <= 2);
    if (!cand.length) cand = free.filter((c) => c.w >= maxW * 0.5);
    const c = takeCell(cand);
    if (c) d.piece = { x: cellX(c.i), z: cellX(c.j), index: piece, taken: false };
  }
  d.mailbox = null;
  if (d.index % 3 === 1 && !isTop) {
    const c = takeCell(free.filter((c) => c.d >= 2 && c.w >= 5 && c.w <= 16 && Tt[c.i][c.j + 1] && Tt[c.i][c.j + 1] !== T.WATER));
    if (c) { d.mailbox = { x: cellX(c.i), z: cellX(c.j) }; }
  }
  d.presents = [];
  const nPresents = 5 + Math.min(5, Math.floor(d.index / 4));
  for (let k = 0; k < nPresents; k++) {
    // un sur trois au bord : il faut aller le chercher
    const edgy = r() < 0.33 ? free.filter((c) => c.d <= 2) : free;
    const c = takeCell(edgy.length ? edgy : free);
    if (c) d.presents.push({ x: cellX(c.i) + jit(), z: cellX(c.j) + jit(), type: rollPresent(r), taken: false });
  }
  d.bucks = [];
  for (let k = 0; k < 5; k++) {
    const c = takeCell(free);
    if (c) d.bucks.push({ x: cellX(c.i) + jit(), z: cellX(c.j) + jit(), taken: false });
  }
  // le butin de l'îlot au trésor
  if (d.isleLoot) {
    for (const c of d.isleLoot) d.presents.push({ x: c.x, z: c.z, type: rollPresent(r), taken: false });
    const m = d.isleLoot[0];
    for (let k = 0; k < 3; k++) d.bucks.push({ x: (d.isleLoot[0].x + d.isleLoot[1].x) / 2 + (k - 1) * 0.35, z: (m.z + d.isleLoot[1].z) / 2 + (k - 1) * 0.2, taken: false });
  }
  d.foods = [];
  for (let k = 0; k < 3 + (r() < 0.5 ? 1 : 0); k++) {
    const c = takeCell(free);
    if (c) d.foods.push({ x: cellX(c.i) + jit(), z: cellX(c.j) + jit(), type: rollFood(r), taken: false });
  }
  // Terriens : de plus en plus nombreux et variés en montant ; jamais trop près de l'arrivée.
  d.earthlings = [];
  const pool = Object.entries(EARTHLINGS).filter(([, e]) => !e.friendly && e.from <= d.index);
  const nEnemies = Math.min(9, 2 + Math.floor(d.index * 0.35));
  const far = free.filter((c) => c.w >= 7);
  for (let k = 0; k < nEnemies && pool.length; k++) {
    const total = pool.reduce((s, [, e]) => s + e.weight, 0);
    let x = r() * total, type = pool[0][0];
    for (const [id, e] of pool) { x -= e.weight; if (x <= 0) { type = id; break; } }
    const c = far[Math.floor(r() * far.length)];
    if (c) d.earthlings.push({ type, x: cellX(c.i), z: cellX(c.j), gone: false });
  }
  if (d.index >= 1 && r() < 0.4) {
    const c = takeCell(free.filter((c) => c.w >= 4 && c.w <= 20));
    if (c) d.earthlings.push({ type: 'wiseman', x: cellX(c.i), z: cellX(c.j), gone: false });
  }
  // le Père Noël : rare, et il ne se laisse approcher que sur la pointe des pieds
  if (d.index >= 2 && r() < 0.3) {
    const c = takeCell(free.filter((c) => c.w >= 5));
    if (c) d.earthlings.push({ type: 'santa', x: cellX(c.i), z: cellX(c.j), gone: false });
  }
  d.seen = new Uint8Array(S * S);

  // Décor : selon le biome de la région, et en bosquets serrés, clairières et zones ordinaires.
  d.items = []; d.solids = [];
  const nz = valueNoise(d.seed + 77);
  const ZONE = { dense: { big: 3, mid: 1.8, small: 0.7 }, clear: { big: 0.12, mid: 0.4, small: 1.8 }, normal: { big: 1, mid: 1, small: 1 } };
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
    const t = Tt[i][j];
    if (!t || t === T.WATER || t === T.ROAD || t === T.ICE || reserved[i][j]) continue;
    const B = biomeAt(d, cellX(i), cellX(j)), bid = B === d.biome ? d.biomeIds[0] : d.biomeIds[1];
    const zv = fbm(nz, i * 0.1, j * 0.1), zf = zv > 0.6 ? ZONE.dense : zv < 0.4 ? ZONE.clear : ZONE.normal;
    const h = hash2(i, j, d.seed + 99);
    let acc = 0, pick = null;
    for (const it of t === T.SAND ? B.shoreItems : B.items) {
      if (it[1] === 'big' && d.dist[i][j] < 2) continue;
      acc += it[2] * zf[it[1]];
      if (h < acc) { pick = it; break; }
    }
    if (!pick) continue;
    const [kind, , , solid] = pick;
    let x = cellX(i) + (hash2(i, j, d.seed + 5) - 0.5) * 0.5, z = cellX(j) + (hash2(i, j, d.seed + 6) - 0.5) * 0.5;
    if (kind === 'house') {
      // une maison a besoin de place : 3 × 3 cases d'herbe libres
      let ok = d.dist[i][j] >= 3;
      for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1 && ok; b++) if (Tt[i + a][j + b] !== T.GRASS || reserved[i + a][j + b]) ok = false;
      if (!ok) continue;
      reserve(i, j, 1.6);
      x = cellX(i); z = cellX(j);
    }
    d.items.push({ kind, x, z, flip: hash2(j, i, d.seed + 8) < 0.5, b: bid });
    if (solid) d.solids.push({ x, z, r: solid });
  }
  if (d.mailbox) d.solids.push({ x: d.mailbox.x, z: d.mailbox.z, r: 0.4 });
  d.start = start;
}

// --- Le secret du premier étage : un îlot isolé, percé d'un trou qui mène au niveau 0.
// Il est trop loin pour y aller à pied : il faut voler ou rebondir.
export function carveIslet(d, r) {
  const S = SIZE, Tt = d.type;
  let best = null;
  for (let ci = 4; ci < S - 4; ci++) for (let cj = 4; cj < S - 4; cj++) {
    let empty = true;
    for (let a = -2; a <= 2 && empty; a++) for (let b = -2; b <= 2 && empty; b++) if (Tt[ci + a][cj + b]) empty = false;
    if (!empty) continue;
    // distance au rivage le plus proche
    let near = 99;
    for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) {
      const i = ci + a, j = cj + b;
      if (inside(i, j) && Tt[i][j]) near = Math.min(near, Math.max(Math.abs(a), Math.abs(b)) - 1);
    }
    if (near >= 3 && near <= 4) { const score = near + r() * 0.5; if (!best || score < best.score) best = { ci, cj, score }; }
  }
  if (!best) return null;
  const { ci, cj } = best;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    if (!a && !b) continue;                      // le centre reste vide : c'est le trou
    Tt[ci + a][cj + b] = a && b ? T.SAND : T.GRASS;
    d.dist[ci + a][cj + b] = 1;
    d.depth[ci + a][cj + b] = 1.4 + r() * 0.8;
  }
  d.secretHole = { i: ci, j: cj };
  d.presents.push({ x: cellX(ci + 1), z: cellX(cj - 1), type: 'jackpot', taken: false });
  d.items.push({ kind: 'palm', x: cellX(ci - 1) + 0.1, z: cellX(cj - 1) + 0.1, flip: false });
  d.solids.push({ x: cellX(ci - 1) + 0.1, z: cellX(cj - 1) + 0.1, r: 0.3 });
  return d.secretHole;
}

// Le pas de tir de la fusée, sur le dernier étage.
export function placeRocket(d, start, r) {
  const S = SIZE, Tt = d.type, walk = bfs((a, b) => Tt[a][b] !== T.VOID, start).d;
  const cands = [];
  for (let i = 3; i < S - 3; i++) for (let j = 3; j < S - 3; j++) {
    if (walk[i][j] < 6 || walk[i][j] > 16 || d.dist[i][j] < 3) continue;
    let ok = true;
    for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 2 && ok; b++) { const t = Tt[i + a][j + b]; if (!t || t === T.WATER) ok = false; }
    if (ok) cands.push({ i, j });
  }
  const c = cands[Math.floor(r() * cands.length)] || start;
  d.rocket = { i: c.i, j: c.j, x: cellX(c.i), z: cellX(c.j) };
  // le décor et les objets s'écartent du pas de tir
  const near = (x, z) => Math.hypot(x - d.rocket.x, z - d.rocket.z) < 2.6;
  d.items = d.items.filter((it) => !near(it.x, it.z));
  d.solids = d.solids.filter((s) => !near(s.x, s.z));
  for (const key of ['presents', 'bucks', 'foods']) d[key] = (d[key] || []).filter((it) => !near(it.x, it.z));
  d.earthlings = (d.earthlings || []).filter((e) => !near(e.x, e.z));
  d.solids.push({ x: d.rocket.x, z: d.rocket.z, r: 1.0 });
  return d.rocket;
}

// Transforme un étage généré en étage spécial (niveau 0 secret ou Funkotron) :
// pas de terriens hostiles, des danseuses, quelques cadeaux choisis.
export function makeSpecial(d, { elevatorAt = null, gifts = [], dancers = 3, hottub = false }, r) {
  d.earthlings = []; d.presents = []; d.foods = []; d.piece = null; d.mailbox = null;
  d.solids = d.solids.filter((s) => !d.items.some((it) => it.x === s.x && it.z === s.z && false));
  const free = [];
  for (let i = 3; i < SIZE - 3; i++) for (let j = 3; j < SIZE - 3; j++) if (d.type[i][j] === T.GRASS && d.dist[i][j] >= 2) free.push({ i, j });
  const away = (c, p, rad) => !p || Math.hypot(c.i - p.i, c.j - p.j) > rad;
  const pick = (rad = 3) => {
    for (let k = 0; k < 200; k++) {
      const c = free[Math.floor(r() * free.length)];
      if (c && away(c, elevatorAt, rad) && away(c, d.hottub, rad)) return c;
    }
    return free[0];
  };
  if (elevatorAt) {
    d.elevator = { i: elevatorAt.i, j: elevatorAt.j };
    for (let i = elevatorAt.i - 2; i <= elevatorAt.i + 2; i++) for (let j = elevatorAt.j - 2; j <= elevatorAt.j + 3; j++) if (inside(i, j) && d.type[i][j] === T.WATER) d.type[i][j] = T.GRASS;
  }
  if (hottub) { const c = pick(4); d.hottub = { i: c.i, j: c.j, x: cellX(c.i), z: cellX(c.j) }; }
  const clear = (x, z, rad) => { d.items = d.items.filter((it) => Math.hypot(it.x - x, it.z - z) > rad); d.solids = d.solids.filter((s) => Math.hypot(s.x - x, s.z - z) > rad); };
  if (d.elevator) clear(cellX(d.elevator.i), cellX(d.elevator.j) + 0.8, 2.6);
  if (d.hottub) clear(d.hottub.x, d.hottub.z, 1.8);
  for (const type of gifts) { const c = pick(); d.presents.push({ x: cellX(c.i), z: cellX(c.j), type, taken: false }); }
  for (let k = 0; k < dancers; k++) { const c = pick(); d.earthlings.push({ type: 'hula', x: cellX(c.i), z: cellX(c.j), gone: false }); }
  d.bucks = [];
  for (let k = 0; k < 8; k++) { const c = pick(); d.bucks.push({ x: cellX(c.i), z: cellX(c.j), taken: false }); }
}


// --- Surprises -------------------------------------------------------------------------------------------------
function placeSurprises(d, r, reserved, reserve, walk, start, record) {
  const S = SIZE, Tt = d.type;
  let maxW = 0;
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) maxW = Math.max(maxW, walk[i][j]);
  const cells = (ok) => {
    const out = [];
    for (let i = 3; i < S - 3; i++) for (let j = 3; j < S - 3; j++) if (!reserved[i][j] && walk[i][j] >= 0 && ok(i, j, Tt[i][j])) out.push({ i, j });
    return out;
  };
  const one = (list) => list[Math.floor(r() * list.length)];
  const kinds = d.index === 0 ? ['treasure'] : (() => {
    const pool = ['disco', 'geyser', 'portals', 'treasure', 'meteors', 'disco', 'geyser', 'treasure'], out = [];
    const n = r() < 0.35 ? 1 : 2;
    while (out.length < n) { const k = pool[Math.floor(r() * pool.length)]; if (!out.includes(k)) out.push(k); }
    return out;
  })();

  for (const kind of kinds) {
    if (kind === 'disco') {
      // 4 × 4 cases d'herbe libres, à l'écart de l'arrivée
      const c = one(cells((i, j) => {
        if (walk[i][j] < 6 || i > S - 7 || j > S - 7) return false;
        for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (Tt[i + a][j + b] !== T.GRASS || reserved[i + a][j + b] || d.dist[i + a][j + b] < 2) return false;
        return true;
      }));
      if (!c) continue;
      for (let a = -1; a <= 4; a++) for (let b = -1; b <= 4; b++) if (inside(c.i + a, c.j + b)) reserved[c.i + a][c.j + b] = 1;
      d.surprises.push({ kind: 'disco', x: cellX(c.i) + 1.5, z: cellX(c.j) + 1.5, i: c.i, j: c.j, done: false });
    } else if (kind === 'geyser') {
      // un îlot de 3 × 3 cases flottant au large, et un geyser sur la rive pour y aller (et un autre pour revenir)
      let best = null;
      for (let ci = 4; ci < S - 4; ci++) for (let cj = 4; cj < S - 4; cj++) {
        let empty = true;
        for (let a = -2; a <= 2 && empty; a++) for (let b = -2; b <= 2 && empty; b++) if (Tt[ci + a][cj + b]) empty = false;
        if (!empty) continue;
        let near = null;
        for (let rad = 3; rad <= 5 && !near; rad++) for (let a = -rad; a <= rad && !near; a++) for (let b = -rad; b <= rad && !near; b++) {
          const i = ci + a, j = cj + b;
          if (Math.max(Math.abs(a), Math.abs(b)) !== rad || !inside(i, j)) continue;
          if ((Tt[i][j] === T.GRASS || Tt[i][j] === T.SAND) && !reserved[i][j] && walk[i][j] >= 4) near = { i, j, rad };
        }
        if (near && near.rad >= 4 && (!best || r() < 0.3)) best = { ci, cj, near };
      }
      if (!best) continue;
      const { ci, cj, near } = best;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        Tt[ci + a][cj + b] = a && b ? T.SAND : T.GRASS;
        d.dist[ci + a][cj + b] = 1;
        d.depth[ci + a][cj + b] = 1.6 + r() * 0.8;
        reserved[ci + a][cj + b] = 1;
      }
      reserve(near.i, near.j, 1.2);
      const land = { x: cellX(near.i), z: cellX(near.j) }, isle = { x: cellX(ci), z: cellX(cj) };
      // le geyser du retour, sur le bord de l'îlot qui regarde la rive
      const dx = Math.sign(near.i - ci), dz = Math.sign(near.j - cj);
      const back = { x: cellX(ci + (Math.abs(near.i - ci) >= Math.abs(near.j - cj) ? dx : 0)), z: cellX(cj + (Math.abs(near.i - ci) >= Math.abs(near.j - cj) ? 0 : dz)) };
      d.surprises.push({ kind: 'geyser', x: land.x, z: land.z, to: { x: isle.x - (back.x - isle.x) * 0.6, z: isle.z - (back.z - isle.z) * 0.6 } });
      d.surprises.push({ kind: 'geyser', x: back.x, z: back.z, to: { x: land.x + (land.x - isle.x) * 0.25, z: land.z + (land.z - isle.z) * 0.25 } });
      d.isleLoot = [{ x: isle.x - (back.x - isle.x), z: isle.z - (back.z - isle.z) }, { x: isle.x + (back.z - isle.z), z: isle.z + (back.x - isle.x) }];
    } else if (kind === 'portals') {
      const a = one(cells((i, j, t) => (t === T.GRASS || t === T.SAND) && walk[i][j] >= 6 && walk[i][j] <= 14 && d.dist[i][j] >= 2));
      const b = one(cells((i, j, t) => (t === T.GRASS || t === T.SAND) && walk[i][j] >= maxW * 0.7 && d.dist[i][j] >= 2));
      if (!a || !b) continue;
      reserve(a.i, a.j, 1.5); reserve(b.i, b.j, 1.5);
      d.surprises.push({ kind: 'portals', a: { x: cellX(a.i), z: cellX(a.j) }, b: { x: cellX(b.i), z: cellX(b.j) } });
    } else if (kind === 'treasure') {
      const sandy = cells((i, j, t) => t === T.SAND && walk[i][j] >= 10);
      const c = one(sandy.length ? sandy : cells((i, j, t) => t === T.GRASS && walk[i][j] >= 10));
      if (!c) continue;
      reserve(c.i, c.j, 1.2);
      d.surprises.push({ kind: 'treasure', x: cellX(c.i), z: cellX(c.j), done: false });
    } else if (kind === 'meteors') d.surprises.push({ kind: 'meteors', done: false });
  }
  if (record) {
    // le disque d'or : au bord du vide, loin de l'arrivée
    const c = one(cells((i, j, t) => (t === T.GRASS || t === T.SAND) && d.dist[i][j] === 1 && walk[i][j] >= maxW * 0.5));
    if (c) { reserve(c.i, c.j, 1.2); d.surprises.push({ kind: 'record', x: cellX(c.i), z: cellX(c.j), done: false }); }
  }
}
