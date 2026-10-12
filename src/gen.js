// Génération d'un étage : clairières reliées par des chemins étroits et sinueux, gouffres, îlots, lacs, route, ascenseur, décor.
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
// les quantités (clairières, îlots, cadeaux, terriens…) suivent la surface de l'étage ; 44 était l'ancienne taille
const AREA = (SIZE / 44) ** 2;
// rayon (en cases) où se tiennent les clairières du premier étage (0) et du niveau secret (-1)
const ISLE_R = { 0: 30, [-1]: 16 };
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

// Distance d'un point (x, z) à un tronçon de chemin.
function segDist(sg, x, z) {
  const vx = sg.bx - sg.ax, vz = sg.bz - sg.az, l2 = vx * vx + vz * vz;
  const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - sg.ax) * vx + (z - sg.az) * vz) / l2)) : 0;
  return Math.hypot(sg.ax + vx * t - x, sg.az + vz * t - z);
}

// forced : point d'arrivée imposé (l'ascenseur de l'étage du dessous).
export function generateLevel(index, seed, forced, biomes = ['prairie', 'banlieue']) {
  const S = SIZE, r = mulberry(seed);
  const biome = BIOMES[biomes[0]], biome2 = BIOMES[biomes[1]];
  const n4 = valueNoise(seed + 31); // le même bruit que regionValue
  const n1 = valueNoise(seed + 11), n2 = valueNoise(seed + 23), n3 = valueNoise(seed + 37);

  // 1. Forme : des clairières reliées par des chemins étroits et sinueux, comme dans ToeJam & Earl. On longe le vide
  // sans arrêt et l'on tombe facilement à l'étage du dessous. Le premier nœud est le point d'arrivée.
  const c0 = forced ? { x: forced.i, z: forced.j } : { x: S / 2 - 0.5 + (r() - 0.5) * 8, z: S / 2 - 0.5 + (r() - 0.5) * 8 };
  // l'étage est grand (une dizaine d'écrans) : beaucoup de clairières, certaines vastes. Le premier étage (une île
  // au milieu de l'océan, l'îlot secret au large) et le niveau secret sont ramassés au centre.
  const isle = ISLE_R[index] || 0, areaK = isle ? Math.min(1, (Math.PI * (isle + 4) ** 2) / (S * S)) : 1;
  const nodes = [{ ...c0, rad: 3.2 + r() * 0.8 }];
  const want = Math.round((8 + r() * 4) * AREA * areaK);
  for (let tries = 0; nodes.length < want && tries < 4000; tries++) {
    const x = 5 + r() * (S - 11), z = 5 + r() * (S - 11);
    if (isle && (x - S / 2) ** 2 + (z - S / 2) ** 2 > isle * isle) continue;
    if (nodes.every((n) => (n.x - x) ** 2 + (n.z - z) ** 2 >= 81)) nodes.push({ x, z, rad: 2.2 + r() * (r() < 0.35 ? 5.5 : 3) });
  }
  // les chemins : l'arbre le plus court qui relie toutes les clairières (Prim), plus quelques boucles
  const edges = [], tree = [0], inTree = new Set(tree);
  const d2 = (a, b) => (nodes[a].x - nodes[b].x) ** 2 + (nodes[a].z - nodes[b].z) ** 2;
  while (tree.length < nodes.length) {
    let best = Infinity, ba = 0, bb = 0;
    for (const a of tree) for (let b = 0; b < nodes.length; b++) {
      if (inTree.has(b)) continue;
      const dd = d2(a, b);
      if (dd < best) { best = dd; ba = a; bb = b; }
    }
    inTree.add(bb); tree.push(bb); edges.push([ba, bb]);
  }
  for (let a = 0; a < nodes.length; a++) {
    if (r() >= 0.3) continue;
    // une boucle vers la deuxième clairière la plus proche
    const order = nodes.map((_, b) => ({ b, d: d2(a, b) })).filter((o) => o.b !== a).sort((u, v) => u.d - v.d);
    if (order[1] && order[1].d < 22 * 22) edges.push([a, order[1].b]);
  }
  // chaque chemin serpente : des tronçons droits entre des points décalés de côté
  const segs = [];
  for (const [ia, ib] of edges) {
    const A = nodes[ia], B = nodes[ib], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz);
    const px = -dz / L, pz = dx / L;
    const amp = Math.min(3.5, L * 0.2) * (0.5 + r() * 0.5);
    const waves = 1 + Math.floor(r() * 3), phase = r() * Math.PI * 2;
    const hw = 1.1 + r() * 0.9, n = Math.max(2, Math.ceil(L / 2.5));
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n, off = Math.sin(Math.PI * t) * amp * Math.sin(t * Math.PI * waves + phase);
      const pt = { x: A.x + dx * t + px * off, z: A.z + dz * t + pz * off };
      if (prev) segs.push({ ax: prev.x, az: prev.z, bx: pt.x, bz: pt.z, hw });
      prev = pt;
    }
  }
  // champ de distance (positif dans les terres), des bords déchiquetés par le bruit ; chaque forme ne touche que
  // les cases autour d'elle (les étages sont grands)
  const land = grid(0), field = grid(-9);
  const stamp = (x0, x1, z0, z1, f) => {
    for (let i = Math.max(2, Math.floor(x0)); i <= Math.min(S - 3, Math.ceil(x1)); i++)
      for (let j = Math.max(2, Math.floor(z0)); j <= Math.min(S - 3, Math.ceil(z1)); j++) field[i][j] = Math.max(field[i][j], f(i, j));
  };
  for (const nd of nodes) stamp(nd.x - nd.rad - 2, nd.x + nd.rad + 2, nd.z - nd.rad - 2, nd.z + nd.rad + 2, (i, j) => nd.rad - Math.hypot(i - nd.x, j - nd.z));
  for (const sg of segs) {
    const m = sg.hw + 2;
    stamp(Math.min(sg.ax, sg.bx) - m, Math.max(sg.ax, sg.bx) + m, Math.min(sg.az, sg.bz) - m, Math.max(sg.az, sg.bz) + m, (i, j) => sg.hw - segDist(sg, i, j));
  }
  for (let i = 2; i < S - 2; i++) for (let j = 2; j < S - 2; j++)
    if (field[i][j] + (fbm(n1, i * 0.25, j * 0.25) - 0.5) * 1.4 > 0) land[i][j] = 1;
  // 2. Gouffres, au milieu des grandes clairières seulement : de plus en plus nombreux en montant.
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++)
    if (land[i][j] && field[i][j] > 2.0 && fbm(n2, i * 0.2, j * 0.2) > 0.66 - Math.min(index, 24) * 0.004) land[i][j] = 0;
  if (forced) for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
    const a = forced.i + di, b = forced.j + dj;
    if (di * di + dj * dj <= 5 && a > 1 && b > 1 && a < S - 2 && b < S - 2) land[a][b] = 1;
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
    if (!seedCell) { seedCell = { i: S >> 1, j: S >> 1 }; land[seedCell.i][seedCell.j] = 1; }
  }
  const comp = bfs((a, b) => land[a][b], seedCell).d;
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) if (comp[i][j] < 0) land[i][j] = 0;
  // Quelques îlots isolés, à quelques cases du bord : on n'y va qu'avec des ressorts ou des ailes (un cadeau y attend).
  // Pas sur le premier étage ni sur le niveau secret : on ne peut pas en tomber, on y resterait coincé.
  const islets = [], wantIslets = Math.round((1 + r() * 2) * AREA * 0.6);
  for (let k = 0; k < 1500 && index > 0 && islets.length < wantIslets; k++) {
    const ci = 4 + Math.floor(r() * (S - 8)), cj = 4 + Math.floor(r() * (S - 8));
    let empty = true, near = false;
    for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) {
      if (!inside(ci + a, cj + b) || !land[ci + a][cj + b]) continue;
      if (a * a + b * b <= 9) empty = false; else if (a * a + b * b <= 25) near = true;
    }
    if (!empty || !near) continue;
    const rad = 1.2 + r() * 0.6;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (a * a + b * b <= rad * rad + 0.5) land[ci + a][cj + b] = 1;
    islets.push({ i: ci, j: cj });
  }

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
    // des plages par endroits seulement : le plus souvent, l'herbe va jusqu'au bord de la falaise
    const beach = fbm(n3, i * 0.22, j * 0.22);
    type[i][j] = (d === 1 && beach > 0.56) || (d === 2 && beach > 0.7) ? T.SAND : T.GRASS;
    // les lacs suivent le biome de la région : lave du volcan, glace de la banquise, rien sur la lune…
    const RB = fbm(n4, (i) * 0.06, (j) * 0.06) > REGION_T ? biome2 : biome, RL = LIQUIDS[RB.liquid];
    if (d >= 3 && !RL.none && fbm(n3, i * 0.12 + 50, j * 0.12 + 50) > RB.lakes) type[i][j] = RL.ice ? T.ICE : T.WATER;
    depth[i][j] = 0.9 + Math.pow(Math.min(d, 10), 1.3) * 0.5 + hash2(i, j, seed) * 0.7;
  }
  // Point de départ du premier étage : le plus loin possible des bords.
  let center = forced;
  if (!center) {
    let best = -Infinity;
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
      if (type[i][j] !== T.GRASS) continue;
      const score = dist[i][j] * 10 - Math.hypot(i - S / 2, j - S / 2);
      if (score > best) { best = score; center = { i, j }; }
    }
    center ||= seedCell;
  }
  return { index, seed, type, dist, depth, center, biome, biome2, biomeIds: biomes, islets, areaK };
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
      if (inside(i, j) && (Tt[i][j] === T.WATER || Tt[i][j] === T.ICE)) Tt[i][j] = T.GRASS;
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
        if (t === T.VOID || t === T.WATER || t === T.ICE) ok = false;
      }
      if (ok) cands.push({ i, j, w: walk[i][j] });
    }
    // au pire, n'importe quelle case de terre assez lointaine
    if (!cands.length) {
      for (let i = 2; i < S - 2; i++) for (let j = 2; j < S - 3; j++) if (Tt[i][j] !== T.VOID && walk[i][j] >= 4) cands.push({ i, j, w: walk[i][j] });
    }
    cands.sort((a, b) => b.w - a.w);
    // parmi les 40 % de cases les plus éloignées à pied : il faut explorer, mais pas tout l'étage
    const pick = cands[Math.floor(r() * Math.max(1, Math.ceil(cands.length * 0.4)))];
    if (pick) {
      d.elevator = { i: pick.i, j: pick.j };
      dry(pick.i, pick.j, 2);
      reserve(pick.i, pick.j, 1.8);
      // devant la cabine, de la terre ferme quoi qu'il arrive (on en sort par là)
      for (let j = pick.j; j <= pick.j + 3; j++) for (let i = pick.i - 1; i <= pick.i + 1; i++) {
        if (!inside(i, j)) continue;
        reserved[i][j] = 1;
        if (!Tt[i][j] && j <= pick.j + 2) { Tt[i][j] = T.GRASS; d.dist[i][j] = 1; d.depth[i][j] = 1.4; }
      }
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
  // d.road : les cases de la route dans l'ordre, du bout jusqu'à l'arrivée (le camion de glaces la parcourt)
  d.road = [];
  if (ends.length) {
    let cur = ends[Math.floor(r() * ends.length)];
    while (cur) {
      if (Tt[cur.i][cur.j] === T.GRASS) Tt[cur.i][cur.j] = T.ROAD;
      if (Tt[cur.i][cur.j] === T.ROAD) d.road.push({ i: cur.i, j: cur.j });
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
  const nPresents = Math.round((6 + Math.min(6, Math.floor(d.index / 3))) * AREA * (d.areaK ?? 1) * 0.55);
  for (let k = 0; k < nPresents; k++) {
    // un sur trois au bord : il faut aller le chercher
    const edgy = r() < 0.33 ? free.filter((c) => c.d <= 2) : free;
    const c = takeCell(edgy.length ? edgy : free);
    if (c) d.presents.push({ x: cellX(c.i) + jit(), z: cellX(c.j) + jit(), type: rollPresent(r), taken: false });
  }
  // un cadeau sur chaque îlot isolé : la récompense de ceux qui sautent ou volent
  for (const isl of d.islets || []) {
    reserve(isl.i, isl.j, 1.2);
    d.presents.push({ x: cellX(isl.i), z: cellX(isl.j), type: rollPresent(r), taken: false });
  }
  d.bucks = [];
  for (let k = 0; k < Math.round(5 * AREA * (d.areaK ?? 1) * 0.5); k++) {
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
  for (let k = 0; k < Math.round((3 + (r() < 0.5 ? 1 : 0)) * AREA * (d.areaK ?? 1) * 0.5); k++) {
    const c = takeCell(free);
    if (c) d.foods.push({ x: cellX(c.i) + jit(), z: cellX(c.j) + jit(), type: rollFood(r), taken: false });
  }
  // Terriens : de plus en plus nombreux et variés en montant ; jamais trop près de l'arrivée.
  d.earthlings = [];
  const pool = Object.entries(EARTHLINGS).filter(([, e]) => !e.friendly && e.weight > 0 && e.from <= d.index);
  // l'étage est cinq fois plus grand, et la plupart dorment (placeCreatures) : on en croise souvent, sans être harcelé
  const nEnemies = Math.round(Math.min(8, 1.5 + d.index * 0.3) * AREA * (d.areaK ?? 1) * 0.6);
  const far = free.filter((c) => c.w >= 7), count = {};
  for (let k = 0; k < nEnemies && pool.length; k++) {
    const total = pool.reduce((s, [, e]) => s + e.weight, 0);
    let x = r() * total, type = pool[0][0];
    for (const [id, e] of pool) { x -= e.weight; if (x <= 0) { type = id; break; } }
    // pas plus de deux danseuses ni de trois essaims par étage
    count[type] = (count[type] || 0) + 1;
    if (count[type] > (CAP[type] ?? 99)) type = pool[0][0];
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
  // le sommeil des terriens, et ceux qui ne se placent pas comme les autres : avec leur propre hasard
  if (d.index >= 0 && d.index < 25) placeCreatures(d, free, reserved, reserve);
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
  // ajoutées après tout le reste, avec leur propre hasard : les mondes déjà sauvegardés ne bougent pas
  if (d.index >= 1 && d.index < 25) placePlates(d, reserved, walk);
}

// Les terriens qui dorment (on passe à côté sur la pointe des pieds), et combien de danseuses ou d'essaims au plus.
const SLEEPY = new Set(['dentist', 'nerds', 'hamster', 'cupid', 'devil', 'opera', 'mower', 'mole', 'boogey', 'cart', 'chickens']);
const CAP = { hula: 2, bees: 3 };

// Le sommeil, puis les terriens à part : sorcier, tornade, camion de glaces, requins des lacs, boîte aux lettres piégée.
function placeCreatures(d, free, reserved, reserve) {
  const r = mulberry(d.seed * 11 + 29);
  const at = (c, type) => d.earthlings.push({ type, x: cellX(c.i), z: cellX(c.j), gone: false });
  const pick = (ok) => { const l = free.filter((c) => !reserved[c.i][c.j] && ok(c)); return l.length ? l[Math.floor(r() * l.length)] : null; };
  // la plupart dorment (pas les danseuses ni les abeilles)
  for (const it of d.earthlings) if (SLEEPY.has(it.type) && r() < 0.7) it.sleep = true;
  // le sorcier : un étage sur trois, à partir du niveau 2
  if (d.index >= 1 && r() < 0.34) { const c = pick((c) => c.w >= 5 && c.w <= 30); if (c) { reserve(c.i, c.j, 1.2); at(c, 'wizard'); } }
  // la tornade : rare, à partir du niveau 6
  if (d.index >= 5 && r() < 0.3) { const c = pick((c) => c.w >= 12); if (c) at(c, 'tornado'); }
  // le camion de glaces : à partir du niveau 10, il part du bout de la route, loin de l'arrivée
  if (d.index >= 9 && r() < 0.3 && d.road?.length >= 14) at(d.road[0], 'truck');
  // un requin dans certains grands lacs (deux au plus) ; l'océan du premier étage a les siens (fillOcean)
  let sharks = 0;
  for (const lake of lakes(d)) {
    if (lake.length < 12 || sharks >= 2 || r() > 0.6) continue;
    const deep = lake.filter((c) => N4.every(([a, b]) => d.type[c.i + a]?.[c.j + b] === T.WATER));
    const l = deep.length ? deep : lake;
    at(l[Math.floor(r() * l.length)], 'shark'); sharks++;
  }
  // une boîte aux lettres sur trois est un piège
  if (d.mailbox && r() < 0.34) d.mailbox.trap = true;
}

// Les lacs d'eau (ni lave ni océan) : chacun est la liste de ses cases.
function lakes(d) {
  const S = SIZE, Tt = d.type, seen = grid(0), out = [];
  const wet = (i, j) => inside(i, j) && Tt[i][j] === T.WATER && !d.ocean?.[i][j];
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
    if (!wet(i, j) || seen[i][j]) continue;
    const cells = [], q = [[i, j]];
    seen[i][j] = 1;
    for (let h = 0; h < q.length; h++) {
      const [a, b] = q[h];
      cells.push({ i: a, j: b });
      for (const [di, dj] of N4) if (wet(a + di, b + dj) && !seen[a + di][b + dj]) { seen[a + di][b + dj] = 1; q.push([a + di, b + dj]); }
    }
    if (!LIQUIDS[biomeAt(d, cellX(i), cellX(j)).liquid]?.burn) out.push(cells);
  }
  return out;
}

// Deux dalles et un coffre entre elles : à deux, un pied sur chaque ; seul, il faut tenir une dalle longtemps.
function placePlates(d, reserved, walk) {
  const S = SIZE, Tt = d.type, r = mulberry(d.seed * 5 + 13);
  if (r() > 0.4) return;
  const clear = (i, j) => inside(i, j) && !reserved[i][j] && (Tt[i][j] === T.GRASS || Tt[i][j] === T.SAND) && walk[i][j] >= 6 && d.dist[i][j] >= 2
    && !d.items.some((it) => Math.hypot(it.x - cellX(i), it.z - cellX(j)) < 0.9);
  const cand = [];
  for (let i = 3; i < S - 3; i++) for (let j = 3; j < S - 3; j++) if (clear(i, j)) cand.push({ i, j });
  for (let tries = 0; tries < 40 && cand.length; tries++) {
    const a = cand[Math.floor(r() * cand.length)];
    const bs = cand.filter((c) => { const l = Math.hypot(c.i - a.i, c.j - a.j); return l >= 4 && l <= 6; });
    if (!bs.length) continue;
    const b = bs[Math.floor(r() * bs.length)], vi = Math.round((a.i + b.i) / 2), vj = Math.round((a.j + b.j) / 2);
    if (!clear(vi, vj)) continue;
    d.surprises.push({ kind: 'plates', a: { x: cellX(a.i), z: cellX(a.j) }, b: { x: cellX(b.i), z: cellX(b.j) }, x: cellX(vi), z: cellX(vj), done: false });
    d.solids.push({ x: cellX(vi), z: cellX(vj), r: 0.45 });
    return;
  }
}

// --- Le premier étage est sur Terre : une île dans l'océan, comme dans l'original. Deux îlots au large : en bas à
// gauche, celui du trou qui mène au niveau 0 ; en haut à droite, un îlot couvert de cadeaux. Il faut une bouée, des
// ailes ou des patins pour y aller (à la nage, l'océan use l'énergie, et il y a des requins).

// Un îlot rond au large, du côté (si, sj) de la carte (-1 ou 1 pour i et j) ; renvoie son centre.
function carveOffshore(d, r, si, sj, rad, minGap, maxGap, margin = 5) {
  const S = SIZE, Tt = d.type;
  let best = null;
  for (let ci = margin; ci < S - margin; ci++) for (let cj = margin; cj < S - margin; cj++) {
    let empty = true;
    for (let a = -3; a <= 3 && empty; a++) for (let b = -3; b <= 3 && empty; b++) if (Tt[ci + a][cj + b]) empty = false;
    if (!empty) continue;
    // la côte la plus proche
    let near = 99;
    for (let a = -maxGap - 3; a <= maxGap + 3; a++) for (let b = -maxGap - 3; b <= maxGap + 3; b++) {
      const i = ci + a, j = cj + b;
      if (inside(i, j) && Tt[i][j]) near = Math.min(near, Math.hypot(a, b) - rad);
    }
    if (near < minGap || near > maxGap) continue;
    // au plus près du coin voulu
    const score = (si * ci + sj * cj) / S + r() * 0.05;
    if (!best || score > best.score) best = { ci, cj, score };
  }
  if (!best) return null;
  const { ci, cj } = best;
  for (let a = -Math.ceil(rad); a <= Math.ceil(rad); a++) for (let b = -Math.ceil(rad); b <= Math.ceil(rad); b++) {
    if (a * a + b * b > rad * rad + 0.5) continue;
    const edge = a * a + b * b > (rad - 1) * (rad - 1);
    Tt[ci + a][cj + b] = edge ? T.SAND : T.GRASS;
    d.dist[ci + a][cj + b] = edge ? 1 : 2;
    d.depth[ci + a][cj + b] = 1.4 + r() * 0.8;
  }
  return { i: ci, j: cj };
}

export function carveIslet(d, r) {
  // en bas à gauche, loin au large (plus loin que la vue depuis la côte : il faut nager pour le trouver) : le trou du
  // niveau 0, au centre de l'îlot
  // (assez loin du bord de la carte pour que le fond de l'eau, plus clair autour de l'îlot, ne s'y coupe pas net)
  const c = carveOffshore(d, r, -1, 1, 2.6, 16, 22, 10) || carveOffshore(d, r, -1, 1, 2.6, 8, 22, 10);
  if (!c) return null;
  const { i: ci, j: cj } = c;
  d.type[ci][cj] = T.VOID;
  d.secretHole = { i: ci, j: cj };
  d.presents.push({ x: cellX(ci + 1), z: cellX(cj - 1), type: 'jackpot', taken: false });
  for (const [a, b, flip] of [[-1, -1, false], [1, 2, true]]) {
    d.items.push({ kind: 'palm', x: cellX(ci + a) + 0.1, z: cellX(cj + b) + 0.1, flip });
    d.solids.push({ x: cellX(ci + a) + 0.1, z: cellX(cj + b) + 0.1, r: 0.3 });
  }
  return d.secretHole;
}

// En haut à droite : un îlot plein de cadeaux.
export function carveTreasureIsle(d, r) {
  const c = carveOffshore(d, r, 1, -1, 2.6, 5, 10);
  if (!c) return null;
  for (const [a, b] of [[0, 0], [1, 0], [-1, 1], [0, -1], [1, 1]]) {
    d.presents.push({ x: cellX(c.i + a) + (r() - 0.5) * 0.3, z: cellX(c.j + b) + (r() - 0.5) * 0.3, type: rollPresent(r), taken: false });
  }
  d.items.push({ kind: 'palm', x: cellX(c.i - 1), z: cellX(c.j - 1), flip: true });
  d.solids.push({ x: cellX(c.i - 1), z: cellX(c.j - 1), r: 0.3 });
  return c;
}

// Tout ce qui n'est pas de la terre devient l'océan (sauf le trou secret) ; d.ocean marque l'eau du large.
export function fillOcean(d) {
  const S = SIZE, Tt = d.type;
  d.ocean = Array.from({ length: S }, () => new Uint8Array(S));
  // distance à la terre ferme : le fond s'assombrit au large
  d.oceanDist = grid(0);
  const q = [];
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
    if (Tt[i][j] === T.VOID) d.oceanDist[i][j] = Infinity; else q.push([i, j]);
  }
  for (let h = 0; h < q.length; h++) {
    const [i, j] = q[h];
    for (const [di, dj] of N4) {
      const a = i + di, b = j + dj;
      if (inside(a, b) && d.oceanDist[a][b] > d.oceanDist[i][j] + 1) { d.oceanDist[a][b] = d.oceanDist[i][j] + 1; q.push([a, b]); }
    }
  }
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
    if (Tt[i][j] !== T.VOID || (d.secretHole && d.secretHole.i === i && d.secretHole.j === j)) continue;
    Tt[i][j] = T.WATER;
    d.ocean[i][j] = 1;
    d.depth[i][j] = 1.2;
  }
  // les requins du large : pas loin des côtes, bien espacés (on ne voit que l'aileron)
  const r = mulberry(d.seed * 13 + 41), spots = [];
  for (let k = 0; k < 600 && spots.length < 5; k++) {
    const i = 3 + Math.floor(r() * (S - 6)), j = 3 + Math.floor(r() * (S - 6)), od = d.oceanDist[i][j];
    if (!d.ocean[i][j] || od < 2 || od > 7 || spots.some((s) => Math.hypot(s.i - i, s.j - j) < 14)) continue;
    spots.push({ i, j });
    d.earthlings.push({ type: 'shark', x: cellX(i), z: cellX(j), gone: false });
  }
}

// Le pas de tir de la fusée, sur le dernier étage.
export function placeRocket(d, start, r) {
  const S = SIZE, Tt = d.type, walk = bfs((a, b) => Tt[a][b] !== T.VOID, start).d;
  const cands = [];
  for (let i = 3; i < S - 3; i++) for (let j = 3; j < S - 3; j++) {
    if (walk[i][j] < 6 || walk[i][j] > 16 || d.dist[i][j] < 3) continue;
    let ok = true;
    for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 2 && ok; b++) { const t = Tt[i + a][j + b]; if (!t || t === T.WATER || t === T.ICE) ok = false; }
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
export function makeSpecial(d, { elevatorAt = null, gifts = [], dancers = 3, hottub = false, loungers = 0, landing = null }, r) {
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
    return free[0] || d.start;
  };
  if (elevatorAt) {
    d.elevator = { i: elevatorAt.i, j: elevatorAt.j };
    for (let i = elevatorAt.i - 2; i <= elevatorAt.i + 2; i++) for (let j = elevatorAt.j - 2; j <= elevatorAt.j + 3; j++) if (inside(i, j) && d.type[i][j] === T.WATER) d.type[i][j] = T.GRASS;
  }
  // le jacuzzi : à quelques pas de l'endroit où l'on atterrit en tombant du trou secret (landing : x, z du trou)
  const near = (p, a, b) => free.filter((c) => { const l = Math.hypot(c.i - p.i, c.j - p.j); return l >= a && l <= b && away(c, elevatorAt, 5); });
  let land = null;
  if (landing) for (const c of free) if (!land || Math.hypot(cellX(c.i) - landing.x, cellX(c.j) - landing.z) < Math.hypot(cellX(land.i) - landing.x, cellX(land.j) - landing.z)) land = c;
  if (hottub) {
    const spots = land ? near(land, 3.5, 6.5).filter((c) => d.dist[c.i][c.j] >= 3) : [];
    if (land && !spots.length) spots.push(...near(land, 3, 9));
    const c = spots.length ? spots[Math.floor(r() * spots.length)] : pick(5);
    d.hottub = { i: c.i, j: c.j, x: cellX(c.i), z: cellX(c.j) };
  }
  const clear = (x, z, rad) => { d.items = d.items.filter((it) => Math.hypot(it.x - x, it.z - z) > rad); d.solids = d.solids.filter((s) => Math.hypot(s.x - x, s.z - z) > rad); };
  if (d.elevator) clear(cellX(d.elevator.i), cellX(d.elevator.j) + 0.8, 2.6);
  if (d.hottub) clear(d.hottub.x, d.hottub.z, 2.4);
  for (const type of gifts) { const c = pick(); d.presents.push({ x: cellX(c.i), z: cellX(c.j), type, taken: false }); }
  // ici, les danseuses sont amicales : elles ne font danser personne
  // les danseuses tournent autour du jacuzzi (sur Funkotron, partout)
  const round = d.hottub ? near(d.hottub, 2.5, 7).filter((c) => away(c, d.hottub, 2.5)) : [];
  for (let k = 0; k < dancers; k++) {
    const c = round.length ? round.splice(Math.floor(r() * round.length), 1)[0] : pick();
    d.earthlings.push({ type: 'hula', x: cellX(c.i), z: cellX(c.j), gone: false, friendly: true });
  }
  // celles qui ne sortent pas du jacuzzi (0,4 : le décalage de la pose des terriens)
  for (let k = 0; k < loungers && d.hottub; k++) {
    const a = 2.3 + k * 2.1;
    d.earthlings.push({ type: 'hula', x: d.hottub.x + Math.cos(a) * 0.8 + 0.4, z: d.hottub.z + Math.sin(a) * 0.8 + 0.4, gone: false, friendly: true, lounge: true });
  }
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
    const n = Math.min(4, Math.round((r() < 0.35 ? 1 : 2) * Math.max(1, AREA * 0.45)));
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
      // retour : la première case d'herbe, de sable ou de route en s'enfonçant dans les terres
      let ret = { x: land.x, z: land.z + 1 };
      const ux = Math.sign(near.i - ci), uz = Math.sign(near.j - cj);
      for (let step = 1; step <= 4; step++) {
        const ii = near.i + ux * step, jj = near.j + uz * step;
        if (inside(ii, jj) && (Tt[ii][jj] === T.GRASS || Tt[ii][jj] === T.SAND || Tt[ii][jj] === T.ROAD)) { ret = { x: cellX(ii), z: cellX(jj) }; break; }
      }
      d.surprises.push({ kind: 'geyser', x: back.x, z: back.z, to: ret });
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
