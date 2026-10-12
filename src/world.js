// La pile d'étages : les 25 niveaux existent pour de vrai, les uns au-dessus des autres.
// Les données de tous les étages sont générées au départ ; les volumes 3D ne sont construits
// que pour les étages proches du joueur (et détruits quand il s'éloigne).
import * as THREE from 'three';
import { SIZE, BLOCK, FOG_R, GAP, LEVELS, KEYFRAMES, PAL_KEYS } from './config.js';
import { generateLevel, placeFeatures, carveIslet, carveTreasureIsle, fillOcean, placeRocket, makeSpecial, cellX, toCell, T } from './gen.js';
import { buildRocket, buildHottub } from './specials.js';
import { buildTerrain, buildWater, buildOceanFrame, topOf } from './terrain3d.js';
import { buildDecor } from './decor3d.js';
import { buildEdges } from './edges.js';
import { patchMaterial, levelUniforms, setDetailTexture, shaderTime, shaderFogOn } from './dither.js';
import { BIOMES, LIQUIDS, pickBiomes } from './biomes.js';
import { buildSurprises, dropSurprises, RECORDS } from './surprises.js';
import { createBooth } from './booth.js';
import { pickupMaterials, presentModel, setPresentWrap, billModel, mailboxModel, pieceModel, foodModel } from './pickups.js';
import { mulberry } from './rng.js';
import { clamp, smooth } from './util.js';

// Choisit les 10 étages qui cachent un morceau du vaisseau, bien répartis entre le 2e et le 24e.
function pieceLevels(seed) {
  const r = mulberry(seed + 77), out = new Map();
  for (let b = 0; b < 10; b++) {
    const lo = 1 + Math.floor(b * 2.3), hi = Math.max(lo, Math.floor((b + 1) * 2.3));
    out.set(lo + Math.floor(r() * (hi - lo + 1)), b);
  }
  return out;
}

// Les étages où se cachent les disques d'or (un par étage, jamais au premier).
function recordLevels(seed) {
  const r = mulberry(seed + 313), pool = Array.from({ length: LEVELS - 2 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return new Set(pool.slice(0, RECORDS));
}

// Ambiances des deux étages hors série.
const SPECIAL_PAL = {
  [-1]: { skyTop: '#2a0a3a', skyBot: '#ff7a4a', neb1: '#ffd06a', neb2: '#ff5fd2', sun: '#ffe0b0', hemiSky: '#ffd8c0', hemiGround: '#7a3a5a', fog: '#ff7a4a' },
  25: { skyTop: '#3a0a5a', skyBot: '#ff4fd0', neb1: '#ffd23f', neb2: '#3affc0', sun: '#fff0f8', hemiSky: '#ffe0ff', hemiGround: '#6a2a8a', fog: '#c43aa0' },
};

function levelPalette(k, biome) {
  if (SPECIAL_PAL[k]) return Object.fromEntries(PAL_KEYS.map((key) => [key, new THREE.Color(SPECIAL_PAL[k][key])]));
  const base = basePalette(k);
  // le biome teinte un peu la lumière (soleil blanc sur la banquise, sol rougeoyant au volcan…)
  for (const [key, hex] of Object.entries(biome?.pal || {})) base[key].lerp(new THREE.Color(hex), 0.45);
  return base;
}

function basePalette(k) {
  let a = KEYFRAMES[0], b = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) if (k >= KEYFRAMES[i].at && k <= KEYFRAMES[i + 1].at) { a = KEYFRAMES[i]; b = KEYFRAMES[i + 1]; break; }
  const f = b.at === a.at ? 0 : (k - a.at) / (b.at - a.at);
  return Object.fromEntries(PAL_KEYS.map((key) => [key, new THREE.Color(a[key]).lerp(new THREE.Color(b[key]), f)]));
}

function disposeTree(o) {
  o.traverse((n) => { if (n.isMesh) { n.geometry?.dispose(); (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => m?.dispose()); } });
}

export class World {
  constructor(scene, seed, assets, bag) {
    this.scene = scene; this.seed = seed; this.assets = assets; this.bag = bag;
    this.levels = [];
    setDetailTexture(assets.detail);
    const pieces = pieceLevels(seed);
    const biomes = pickBiomes(LEVELS, mulberry(seed + 999));
    const records = recordLevels(seed);
    let forced = null;
    for (let k = 0; k < LEVELS; k++) {
      const data = generateLevel(k, (seed * 7919 + k * 1013) >>> 0, forced, biomes[k]);
      placeFeatures(data, forced || data.center, { isTop: k === LEVELS - 1, piece: pieces.has(k) ? pieces.get(k) : null, record: records.has(k) });
      this.levels.push(this.makeLevel(k, data));
      forced = data.elevator;
    }
    const r = mulberry(seed + 4242);
    // le premier étage, une île dans l'océan : le secret (un îlot percé, au large, qui mène au niveau 0), un îlot aux
    // cadeaux, puis l'océan partout ailleurs
    carveIslet(this.levels[0].data, r);
    carveTreasureIsle(this.levels[0].data, r);
    fillOcean(this.levels[0].data);
    const start1 = this.levels[0].data.start;
    const d0 = generateLevel(-1, (seed * 31 + 7) >>> 0, start1, ['prairie', 'bonbons']);
    placeFeatures(d0, start1, { isTop: true });
    makeSpecial(d0, { elevatorAt: start1, gifts: ['life', 'wings', 'hitops', 'jackpot', 'spring'], dancers: 3, hottub: true }, r);
    this.levels[-1] = this.makeLevel(-1, d0);
    // la fusée sur le dernier étage, et Funkotron juste au-dessus
    const top = this.levels[LEVELS - 1].data, pad = placeRocket(top, top.start, r);
    const dF = generateLevel(LEVELS, (seed * 53 + 11) >>> 0, pad, ['bonbons', 'champis']);
    placeFeatures(dF, pad, { isTop: true });
    makeSpecial(dF, { dancers: 5 }, r);
    dF.landing = pad;
    dF.seen.fill(255); // Funkotron, c'est la fête : pas de brouillard
    this.levels.push(this.makeLevel(LEVELS, dF));
    this.all = [this.levels[-1], ...this.levels];
    this.palettes = this.levels.map((L) => levelPalette(L.k, L.data.biome));
    this.palettes[-1] = levelPalette(-1);
    this.pal = Object.fromEntries(PAL_KEYS.map((k) => [k, new THREE.Color()]));

    this.lights = [];
    const hemi = (this.hemi = new THREE.HemisphereLight('#ffffff', '#000000', 1.15));
    const sun = (this.sun = new THREE.DirectionalLight('#ffffff', 2.6));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.intensity = 0.7;
    scene.add(hemi, sun, sun.target);
    this.lights.push(hemi, sun, sun.target);
    for (const k of [0, 1, 2]) this.build(this.levels[k]);
  }

  makeLevel(k, data) {
    const group = new THREE.Group();
    group.position.y = k * GAP;
    this.scene.add(group);
    const U = levelUniforms(THREE);
    U.uLevelY.value = k * GAP;
    U.uFogSize.value = SIZE;
    const B = data.biome || BIOMES.prairie, liq = LIQUIDS[B.liquid] || LIQUIDS.water;
    U.tDetail.value = this.assets.details[B.detail] || this.assets.detail;
    if (liq.deep) {
      U.uLiqDeep.value.set(liq.deep); U.uLiqShore.value.set(liq.shore); U.uLiqCrest.value.set(liq.crest); U.uLiqGlow.value = liq.glow;
    }
    const liq2 = LIQUIDS[(data.biome2 || B).liquid];
    const L2 = liq2?.deep ? liq2 : liq.deep ? liq : LIQUIDS.water;
    U.uLiq2Deep.value.set(L2.deep); U.uLiq2Shore.value.set(L2.shore); U.uLiq2Crest.value.set(L2.crest); U.uLiq2Glow.value = L2.glow;
    return { k, y: k * GAP, data, group, U, built: false, booth: null, pickups: [], colliders: data.solids };
  }

  isHole(k, x, z) {
    const h = this.levels[k]?.data.secretHole;
    return !!h && toCell(x) === h.i && toCell(z) === h.j;
  }

  // --- construction paresseuse des étages
  build(L) {
    if (L.built) return;
    const { data, group, U } = L;
    const own = (L.own = []);
    const keep = (m) => { own.push(m); group.add(m); return m; };
    const terrain = (L.terrain = keep(new THREE.Mesh(buildTerrain(data), patchMaterial(new THREE.MeshLambertMaterial({ vertexColors: true }), U, { detail: true }))));
    terrain.castShadow = terrain.receiveShadow = true;
    const wg = buildWater(data);
    const waterMat = () => patchMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false }), U, { water: true });
    if (wg) {
      const water = keep(new THREE.Mesh(wg, waterMat()));
      water.receiveShadow = true; water.renderOrder = 1;
    }
    // le premier étage est une île : l'océan continue au-delà de la carte
    if (data.ocean) {
      const f = buildOceanFrame();
      keep(new THREE.Mesh(f.floor, new THREE.MeshLambertMaterial({ vertexColors: true }))).receiveShadow = true;
      const sea = keep(new THREE.Mesh(f.water, waterMat()));
      sea.renderOrder = 1;
    }
    // le brouillard : une texture de ce qu'on a vu (data.seen, 0 ou 255 par case) et une nappe violette posée sur
    // l'étage, percée là où l'on a regardé ; le décor disparaît dessous
    const fogTex = (L.fogTex = new THREE.DataTexture(data.seen, SIZE, SIZE, THREE.RedFormat, THREE.UnsignedByteType));
    fogTex.magFilter = fogTex.minFilter = THREE.LinearFilter;
    fogTex.needsUpdate = true;
    U.tFog.value = fogTex;
    // au niveau 1, la nappe couvre aussi l'océan autour de la carte (il prend l'état des cases du bord)
    const fogW = data.ocean ? SIZE + 320 : SIZE;
    const sheet = keep(new THREE.Mesh(new THREE.PlaneGeometry(fogW, fogW).rotateX(-Math.PI / 2), patchMaterial(new THREE.MeshBasicMaterial({ color: '#4b1f6e' }), U, { hole: false, sheet: true })));
    sheet.position.y = 0.07;
    const dg = buildDecor(data);
    if (dg) {
      const decor = keep(new THREE.Mesh(dg, patchMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }), U, { fogged: true })));
      decor.castShadow = decor.receiveShadow = true;
    }
    // à partir du niveau 2, les bords du vide s'allument quand on s'en approche
    if (L.k >= 1) { const ed = buildEdges(data); if (ed) keep(ed); }
    if (data.elevator && !L.booth) {
      L.booth = createBooth(this.assets.booth);
      L.booth.position.set(cellX(data.elevator.i), 0, cellX(data.elevator.j));
      L.booth.userData.home = { group, x: L.booth.position.x, z: L.booth.position.z };
    }
    if (L.booth && !L.booth.userData.traveling && L.booth.parent !== group) group.add(L.booth);

    const M = (L.mats = pickupMaterials(U));
    L.pickups = [];
    const place = (kind, item, model, y = 0) => {
      model.position.set(item.x, topOf(data.type[toCell(item.x)][toCell(item.z)]) + y, item.z);
      model.userData.phase = Math.random() * 6;
      group.add(model);
      L.pickups.push({ kind, item, model });
    };
    for (const p of data.presents) if (!p.taken) place('present', p, presentModel(M, this.bag.wrapOf[p.type]));
    for (const b of data.bucks) if (!b.taken) place('buck', b, billModel(M), 0.45);
    for (const f of data.foods) if (!f.taken) place('food', f, foodModel(M, f.type));
    if (data.piece && !data.piece.taken) place('piece', data.piece, pieceModel(M, data.piece.index));
    if (data.mailbox) place('mailbox', data.mailbox, mailboxModel(M));
    if (data.rocket) {
      L.rocket = buildRocket(U);
      L.rocket.position.set(data.rocket.x, 0, data.rocket.z);
      group.add(L.rocket); own.push(...[]);
      L.rocketHome = L.rocket;
    }
    if (data.hottub) {
      L.hottub = buildHottub(U);
      L.hottub.position.set(data.hottub.x, 0, data.hottub.z);
      group.add(L.hottub);
    }
    buildSurprises(L);
    L.lowHidden = undefined;
    L.built = true;
  }

  unbuild(L) {
    if (!L.built) return;
    dropSurprises(L);
    const geos = new Set();
    for (const m of L.own) { L.group.remove(m); geos.add(m.geometry); m.material.dispose(); }
    for (const p of L.pickups) { L.group.remove(p.model); p.model.traverse((o) => o.geometry && geos.add(o.geometry)); }
    for (const g of geos) g.dispose();
    if (L.booth && L.booth.parent === L.group) L.group.remove(L.booth);
    if (L.rocket?.parent === L.group) { L.group.remove(L.rocket); disposeTree(L.rocket); }
    if (L.hottub) { L.group.remove(L.hottub); disposeTree(L.hottub); }
    if (L.mats) {
      const M = L.mats;
      for (const m of [...M.wraps, ...M.ribbons, M.bill, M.beam, M.glow, ...(M.cached?.() || [])]) m.dispose();
      L.mats = null;
    }
    L.rocket = null; L.hottub = null;
    L.fogTex?.dispose(); L.fogTex = null;
    L.own = []; L.pickups = []; L.built = false;
  }

  dispose() {
    for (const L of this.all) { this.unbuild(L); this.scene.remove(L.group); if (L.booth?.parent) L.booth.parent.remove(L.booth); }
    for (const o of this.lights) this.scene.remove(o);
  }

  // Après un Randomiseur : les cadeaux posés changent de papier.
  refreshWraps(bag) {
    for (const L of this.all) for (const p of L.pickups) if (p.kind === 'present') setPresentWrap(p.model, L.mats, bag.wrapOf[p.item.type]);
  }

  // Dépose un cadeau livré (boîte aux lettres) sur l'étage.
  addPresent(k, x, z, type) {
    const L = this.levels[k], item = { x, z, type, taken: false };
    L.data.presents.push(item);
    if (L.built) {
      const m = presentModel(L.mats, this.bag.wrapOf[type]);
      m.position.set(x, topOf(this.type(k, x, z)), z);
      m.userData.phase = 0;
      L.group.add(m);
      L.pickups.push({ kind: 'present', item, model: m });
    }
    return item;
  }

  // Sous-titre d'un étage : ses deux biomes, ou son nom propre.
  levelName(k) {
    if (k === -1) return 'LE NIVEAU SECRET. CHUT.';
    if (k >= LEVELS) return 'LA PLANÈTE DU FUNK';
    const d = this.levels[k]?.data;
    if (!d?.biome) return '';
    return d.biome2 && d.biome2 !== d.biome ? `${d.biome.name} ET ${d.biome2.name}` : d.biome.name;
  }

  // n places libres sur la terre ferme autour de (cx, cz), bien espacées (le butin d'un coffre, d'une piste…)
  scatter(k, cx, cz, n, { minR = 1, gap = 0.7, avoid = [] } = {}) {
    const out = [], d = this.levels[k].data;
    const ok = (x, z) => { const t = this.type(k, x, z); return t && t !== T.WATER && t !== T.ICE; };
    const free = (x, z) => [...out, ...avoid].every((p) => Math.hypot(p.x - x, p.z - z) >= gap) && !(d.solids || []).some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 0.35);
    for (let r = minR; out.length < n && r < minR + 6; r += 0.5) {
      const m = Math.max(6, Math.round((2 * Math.PI * r) / gap)), a0 = Math.random() * Math.PI * 2;
      for (let i = 0; i < m && out.length < n; i++) {
        const a = a0 + (i / m) * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        if (ok(x, z) && free(x, z)) out.push({ x, z });
      }
    }
    while (out.length < n) out.push(this.nearestLand(k, cx, cz));
    return out;
  }

  addBuck(k, x, z) {
    const L = this.levels[k], item = { x, z, taken: false };
    L.data.bucks.push(item);
    if (L.built) {
      const m = billModel(L.mats);
      m.position.set(x, topOf(this.type(k, x, z)) + 0.45, z);
      m.userData.phase = Math.random() * 6;
      L.group.add(m);
      L.pickups.push({ kind: 'buck', item, model: m });
    }
    return item;
  }

  type(k, x, z) {
    const L = this.levels[k];
    if (!L) return T.VOID;
    const i = toCell(x), j = toCell(z);
    if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) return T.VOID;
    return L.data.type[i][j];
  }

  push(k, x, z, r) {
    for (const s of this.levels[k].data.solids) {
      const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz), m = s.r + r;
      if (d < m && d > 1e-5) { x = s.x + (dx / d) * m; z = s.z + (dz / d) * m; }
    }
    return { x, z };
  }

  // Case de sol la plus proche (ni eau, ni obstacle, ni cabine) : là où l'on atterrit après une chute.
  // La case de terre ferme la plus proche (ni eau, ni cabine, ni décor solide). Jamais nulle.
  nearestLand(k, x, z) {
    const L = this.levels[k], d = L.data, e = d.elevator;
    // grille des cases encombrées, calculée une fois (et refaite si les collisions changent)
    if (!L.blocked || L.blockedN !== d.solids.length) {
      L.blocked = new Uint8Array(SIZE * SIZE); L.blockedN = d.solids.length;
      for (const s of d.solids) {
        const r = s.r + 0.4;
        for (let i = Math.max(0, Math.floor(s.x + SIZE / 2 - r)); i <= Math.min(SIZE - 1, Math.floor(s.x + SIZE / 2 + r)); i++)
          for (let j = Math.max(0, Math.floor(s.z + SIZE / 2 - r)); j <= Math.min(SIZE - 1, Math.floor(s.z + SIZE / 2 + r)); j++)
            if (Math.hypot(s.x - cellX(i), s.z - cellX(j)) < r) L.blocked[i * SIZE + j] = 1;
      }
    }
    let best = null, bd = Infinity, any = null, ad = Infinity;
    for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
      const t = d.type[i][j];
      if (!t) continue;
      const cx = cellX(i), cz = cellX(j), dd = (cx - x) ** 2 + (cz - z) ** 2;
      if (dd < ad) { ad = dd; any = { x: cx, z: cz }; }
      if (t === T.WATER || L.blocked[i * SIZE + j]) continue;
      if (e && Math.abs(i - e.i) <= 1 && Math.abs(j - e.j) <= 1) continue;
      if (dd < bd) { bd = dd; best = { x: cx, z: cz }; }
    }
    return best || any || { x, z };
  }

  // Les cases qu'on rejoint à pied depuis (i, j), avec le nombre de pas (-1 : inaccessible).
  walkFrom(k, i0, j0) {
    const d = this.levels[k].data, steps = new Int16Array(SIZE * SIZE).fill(-1);
    const ok = (i, j) => i >= 0 && j >= 0 && i < SIZE && j < SIZE && d.type[i][j] && d.type[i][j] !== T.WATER;
    if (!ok(i0, j0)) return steps;
    const q = [[i0, j0]];
    steps[i0 * SIZE + j0] = 0;
    for (let h = 0; h < q.length; h++) {
      const [i, j] = q[h], s = steps[i * SIZE + j];
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (!ok(a, b) || steps[a * SIZE + b] >= 0) continue;
        steps[a * SIZE + b] = s + 1; q.push([a, b]);
      }
    }
    return steps;
  }

  // Une case d'herbe au hasard, loin des bords, sur la terre où l'on arrive : jamais sur un îlot isolé.
  randomLand(k) {
    const L = this.levels[k], d = L.data, s = d.start || d.center, cells = [];
    L.main ||= s ? this.walkFrom(k, s.i, s.j) : null;
    const main = (i, j) => !L.main || L.main[i * SIZE + j] >= 0;
    for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) if (d.type[i][j] === T.GRASS && d.dist[i][j] >= 2 && main(i, j)) cells.push([i, j]);
    if (!cells.length) for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) if (d.type[i][j] && d.type[i][j] !== T.WATER && main(i, j)) cells.push([i, j]);
    if (!cells.length) return this.nearestLand(k, s ? cellX(s.i) : 0, s ? cellX(s.j) : 0);
    const [i, j] = cells[Math.floor(Math.random() * cells.length)];
    return this.nearestLand(k, cellX(i), cellX(j));
  }

  // Une place à quelques pas de (x, z), qu'on peut rejoindre à pied (le terrien surprise sort de là).
  spotNear(k, x, z, rMin = 3, rMax = 5) {
    const steps = this.walkFrom(k, toCell(x), toCell(z)), out = [];
    for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
      if (steps[i * SIZE + j] < 0) continue;
      const r = Math.hypot(cellX(i) - x, cellX(j) - z);
      if (r >= rMin && r <= rMax && steps[i * SIZE + j] <= rMax * 2) out.push([i, j]);
    }
    if (!out.length) return this.scatter(k, x, z, 1, { minR: rMin })[0];
    const [i, j] = out[Math.floor(Math.random() * out.length)];
    return this.nearestLand(k, cellX(i), cellX(j));
  }

  boothPos(k) {
    const e = this.levels[k].data.elevator;
    return e ? { x: cellX(e.i), z: cellX(e.j) } : null;
  }

  // Brouillard : on ne voit le terrain qu'à FOG_R cases autour de soi, et ce qu'on a vu reste visible (data.seen :
  // 255 par case vue). La carte compte en cases de BLOCK × BLOCK, comme les carrés de l'original : la première fois
  // qu'on voit de la terre dans une case, elle rapporte un point. Renvoie le nombre de ces cases nouvelles.
  reveal(k, x, z, rad = FOG_R) {
    const d = this.levels[k]?.data;
    if (!d) return 0;
    const ci = toCell(x), cj = toCell(z), key = ci * 4096 + cj;
    if (d.lastReveal === key) return 0; // même case qu'à l'image précédente : rien de neuf
    d.lastReveal = key;
    let n = 0;
    for (let i = Math.max(0, ci - rad); i <= Math.min(SIZE - 1, ci + rad); i++)
      for (let j = Math.max(0, cj - rad); j <= Math.min(SIZE - 1, cj + rad); j++)
        if ((i - ci) ** 2 + (j - cj) ** 2 <= rad * rad) n += this.see(d, i, j);
    return n;
  }
  // une case vue ; renvoie 1 si c'est la première terre vue dans sa case de la carte
  see(d, i, j) {
    const q = i * SIZE + j;
    if (d.seen[q]) return 0;
    d.seen[q] = 255;
    d.fogDirty = true;
    if (!d.type[i][j] || d.ocean?.[i]?.[j]) return 0;
    const NB = SIZE / BLOCK, b = Math.floor(i / BLOCK) * NB + Math.floor(j / BLOCK);
    if (!d.blockSeen) this.countBlocks(d);
    if (d.blockSeen[b]) return 0;
    d.blockSeen[b] = 1;
    return 1;
  }
  // les cases de la carte où l'on a déjà vu de la terre (après un chargement)
  countBlocks(d) {
    const NB = SIZE / BLOCK;
    d.blockSeen = new Uint8Array(NB * NB);
    for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++)
      if (d.seen[i * SIZE + j] && d.type[i][j] && !d.ocean?.[i]?.[j]) d.blockSeen[Math.floor(i / BLOCK) * NB + Math.floor(j / BLOCK)] = 1;
  }
  // une case entière de la carte (le téléphone)
  revealBlock(d, bi, bj) {
    let n = 0;
    for (let i = bi * BLOCK; i < Math.min(SIZE, (bi + 1) * BLOCK); i++) for (let j = bj * BLOCK; j < Math.min(SIZE, (bj + 1) * BLOCK); j++) n += this.see(d, i, j);
    return n;
  }
  // tout l'étage (le télescope)
  revealAll(k) {
    const d = this.levels[k].data;
    d.seen.fill(255);
    d.fogDirty = true;
    d.blockSeen = null;
  }
  // la case est-elle déjà vue ?
  seenAt(k, x, z) {
    if (!shaderFogOn.value) return true;
    const d = this.levels[k]?.data, i = toCell(x), j = toCell(z);
    return !d || i < 0 || j < 0 || i >= SIZE || j >= SIZE || d.seen[i * SIZE + j] > 0;
  }

  // Objets touchés par le joueur sur son étage ; on les retire et on les renvoie.
  collect(k, pos) {
    const L = this.levels[k], got = [];
    if (!L.built) return got;
    L.pickups = L.pickups.filter((p) => {
      if (p.kind === 'mailbox') return true;
      const r = p.kind === 'piece' ? 0.85 : 0.6;
      if (Math.hypot(pos.x - p.item.x, pos.z - p.item.z) > r) return true;
      p.item.taken = true;
      L.group.remove(p.model);
      got.push(p);
      return false;
    });
    return got;
  }

  mailboxNear(k, pos) {
    const m = this.levels[k].data.mailbox;
    return m && Math.hypot(pos.x - m.x, pos.z - m.z) < 1.3 ? m : null;
  }

  // Change le trou de visibilité de tous les étages (une vue par joueur en écran partagé).
  setHole(hole) { for (const L of this.all) if (L.built) L.U.uHole.value.set(hole.x, hole.y, hole.r, hole.z); }

  // Appelé à chaque image : construction, ambiance, fondus, trou autour du héros, soleil, objets.
  // Chaque image : construit les étages autour de chaque point suivi par une caméra (un par image au plus,
  // du plus proche au plus lointain), défait ceux qui sont loin de tous.
  update(dt, t, foci) {
    shaderTime.value = t;
    this.t = t;
    const curs = foci.map((f) => Math.round(f.y / GAP));
    build: for (const off of [0, -1, 1, -2, 2]) {
      for (const cur of curs) {
        const L = this.levels[cur + off];
        if (L && !L.built) { this.build(L); break build; }
      }
    }
    for (const L of this.all) if (L.built && curs.every((c) => Math.abs(L.k - c) > 3) && !L.booth?.userData.traveling && !L.rocketAway) this.unbuild(L);
  }

  // Avant de dessiner une vue : fondus, brouillard, trou de visibilité, palette et soleil réglés
  // pour le point que suit cette caméra (en coop, chaque moitié d'écran peut être sur son étage).
  view(focus, hole) {
    const t = this.t;
    const lv = clamp(focus.y / GAP, -1, LEVELS), i0 = Math.floor(lv), i1 = Math.min(LEVELS, i0 + 1), f = smooth(lv - i0);
    for (const key of PAL_KEYS) this.pal[key].lerpColors(this.palettes[i0][key], this.palettes[i1][key], f);
    const P = this.pal;

    for (const L of this.all) {
      const above = L.y - focus.y;
      const fade = above <= 0.5 ? 1 : clamp(1 - (above - 0.5) / 5);
      L.U.uFade.value = fade;
      L.group.visible = L.built && fade > 0.02 && focus.y - L.y < GAP * 2.3 && (L.k !== -1 || this.showSecret);
      if (!L.built) continue;
      L.U.uFog.value.copy(P.fog);
      L.U.uFogAmt.value = focus.y > L.y + 0.5 ? Math.min(0.82, ((focus.y - L.y) / GAP) * 0.5) : 0;
      L.terrain.castShadow = above <= 0.5;
      // les étages du dessous, noyés dans la brume : ni objets ni ombres portées (beaucoup moins à dessiner)
      const low = L.U.uFogAmt.value > 0.3;
      if (L.lowHidden !== low) {
        L.lowHidden = low;
        for (const p of L.pickups) p.model.visible = !low;
        for (const s of L.surp || []) s.m.visible = !low;
        L.group.traverse((o) => { if (o.isMesh && o !== L.terrain) { o.userData.cs ??= o.castShadow; o.castShadow = !low && o.userData.cs; } });
      }
      L.U.uHole.value.set(hole.x, hole.y, hole.r, hole.z);
      if (L.data.fogDirty && L.fogTex) { L.fogTex.needsUpdate = true; L.data.fogDirty = false; }
      if (L.hottub) L.hottub.userData.water.position.y = 0.36 + Math.sin(t * 4) * 0.02;
      const b = L.booth;
      if (b) {
        const bu = b.userData.U;
        if (b.userData.traveling) { bu.uFade.value = 1; bu.uFogAmt.value = 0; }
        else { bu.uFade.value = fade; bu.uFogAmt.value = L.U.uFogAmt.value; bu.uFog.value.copy(P.fog); }
        b.visible = b.userData.traveling || (L.group.visible && this.seenAt(L.k, b.position.x, b.position.z));
      }
      if (!L.group.visible) continue;
      // sous le brouillard, ni objets ni surprises
      if (L.rocket) L.rocket.visible = L.rocketAway || this.seenAt(L.k, L.rocket.position.x, L.rocket.position.z);
      for (const s of L.surp || []) if (s.m && !low) s.m.visible = this.seenAt(L.k, s.m.position.x, s.m.position.z);
      for (const p of L.pickups) {
        const m = p.model, ph = m.userData.phase;
        if (!low) m.visible = this.seenAt(L.k, m.position.x, m.position.z);
        if (p.kind === 'present') { m.userData.box.position.y = Math.abs(Math.sin(t * 2.2 + ph)) * 0.12; m.rotation.y = Math.sin(t * 0.7 + ph) * 0.4; }
        else if (p.kind === 'buck') { m.rotation.y = t * 2.5 + ph; m.children[0].position.y = Math.sin(t * 3 + ph) * 0.06; }
        else if (p.kind === 'piece') { m.userData.part.rotation.y = t * 1.3; m.userData.part.position.y = 0.9 + Math.sin(t * 2) * 0.1; }
        else if (p.kind === 'mailbox') m.userData.flag.rotation.z = Math.sin(t * 1.5) * 0.08;
        else if (p.kind === 'food') {
          m.userData.part.rotation.y = t * 0.8 + ph;
          if (m.userData.flies) m.userData.flies.forEach((f, k) => f.position.set(Math.cos(t * 9 + k * 3) * 0.2, 0.35 + Math.sin(t * 13 + k) * 0.06, Math.sin(t * 9 + k * 3) * 0.2));
        }
      }
    }
    this.hemi.color.copy(P.hemiSky);
    this.hemi.groundColor.copy(P.hemiGround);
    this.sun.color.copy(P.sun);
    const sx = Math.round(focus.x * 24) / 24, sz = Math.round(focus.z * 24) / 24;
    this.sun.position.set(sx - 11, focus.y + 25, sz + 9);
    this.sun.target.position.set(sx, focus.y, sz);
  }
}
