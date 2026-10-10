// La pile d'étages : les 25 niveaux existent pour de vrai, les uns au-dessus des autres.
// Les données de tous les étages sont générées au départ ; les volumes 3D ne sont construits
// que pour les étages proches du joueur (et détruits quand il s'éloigne).
import * as THREE from 'three';
import { SIZE, GAP, LEVELS, KEYFRAMES, PAL_KEYS } from './config.js';
import { generateLevel, placeFeatures, carveIslet, placeRocket, makeSpecial, cellX, toCell, T } from './gen.js';
import { buildRocket, buildHottub } from './specials.js';
import { buildTerrain, buildWater, topOf } from './terrain3d.js';
import { buildDecor } from './decor3d.js';
import { patchMaterial, levelUniforms, setDetailTexture, shaderTime } from './dither.js';
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

// Ambiances des deux étages hors série.
const SPECIAL_PAL = {
  [-1]: { skyTop: '#2a0a3a', skyBot: '#ff7a4a', neb1: '#ffd06a', neb2: '#ff5fd2', sun: '#ffe0b0', hemiSky: '#ffd8c0', hemiGround: '#7a3a5a', fog: '#ff7a4a' },
  25: { skyTop: '#3a0a5a', skyBot: '#ff4fd0', neb1: '#ffd23f', neb2: '#3affc0', sun: '#fff0f8', hemiSky: '#ffe0ff', hemiGround: '#6a2a8a', fog: '#c43aa0' },
};

function levelPalette(k) {
  if (SPECIAL_PAL[k]) return Object.fromEntries(PAL_KEYS.map((key) => [key, new THREE.Color(SPECIAL_PAL[k][key])]));
  let a = KEYFRAMES[0], b = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) if (k >= KEYFRAMES[i].at && k <= KEYFRAMES[i + 1].at) { a = KEYFRAMES[i]; b = KEYFRAMES[i + 1]; break; }
  const f = b.at === a.at ? 0 : (k - a.at) / (b.at - a.at);
  return Object.fromEntries(PAL_KEYS.map((key) => [key, new THREE.Color(a[key]).lerp(new THREE.Color(b[key]), f)]));
}

export class World {
  constructor(scene, seed, assets, bag) {
    this.scene = scene; this.seed = seed; this.assets = assets; this.bag = bag;
    this.levels = [];
    setDetailTexture(assets.detail);
    const pieces = pieceLevels(seed);
    let forced = null;
    for (let k = 0; k < LEVELS; k++) {
      const data = generateLevel(k, (seed * 7919 + k * 1013) >>> 0, forced);
      placeFeatures(data, forced || data.center, { isTop: k === LEVELS - 1, piece: pieces.has(k) ? pieces.get(k) : null });
      this.levels.push(this.makeLevel(k, data));
      forced = data.elevator;
    }
    const r = mulberry(seed + 4242);
    // le secret du premier étage, et le niveau 0 caché dessous (son ascenseur arrive au départ du niveau 1)
    carveIslet(this.levels[0].data, r);
    const start1 = this.levels[0].data.start;
    const d0 = generateLevel(-1, (seed * 31 + 7) >>> 0, start1);
    placeFeatures(d0, start1, { isTop: true });
    makeSpecial(d0, { elevatorAt: start1, gifts: ['life', 'wings', 'hitops', 'jackpot', 'spring'], dancers: 3, hottub: true }, r);
    this.levels[-1] = this.makeLevel(-1, d0);
    // la fusée sur le dernier étage, et Funkotron juste au-dessus
    const top = this.levels[LEVELS - 1].data, pad = placeRocket(top, top.start, r);
    const dF = generateLevel(LEVELS, (seed * 53 + 11) >>> 0, pad);
    placeFeatures(dF, pad, { isTop: true });
    makeSpecial(dF, { dancers: 5 }, r);
    dF.landing = pad;
    this.levels.push(this.makeLevel(LEVELS, dF));
    this.all = [this.levels[-1], ...this.levels];
    this.palettes = this.levels.map((L) => levelPalette(L.k));
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
    if (wg) {
      const water = keep(new THREE.Mesh(wg, patchMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false }), U, { water: true })));
      water.receiveShadow = true; water.renderOrder = 1;
    }
    const dg = buildDecor(data);
    if (dg) {
      const decor = keep(new THREE.Mesh(dg, patchMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }), U)));
      decor.castShadow = decor.receiveShadow = true;
    }
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
    L.built = true;
  }

  unbuild(L) {
    if (!L.built) return;
    const geos = new Set();
    for (const m of L.own) { L.group.remove(m); geos.add(m.geometry); m.material.dispose(); }
    for (const p of L.pickups) { L.group.remove(p.model); p.model.traverse((o) => o.geometry && geos.add(o.geometry)); }
    for (const g of geos) g.dispose();
    if (L.booth && L.booth.parent === L.group) L.group.remove(L.booth);
    if (L.rocket?.parent === L.group) L.group.remove(L.rocket);
    if (L.hottub) L.group.remove(L.hottub);
    L.rocket = null; L.hottub = null;
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
  nearestLand(k, x, z) {
    const L = this.levels[k], d = L.data, e = d.elevator;
    let best = null, bd = Infinity;
    for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
      const t = d.type[i][j];
      if (!t || t === T.WATER) continue;
      if (e && Math.abs(i - e.i) <= 1 && Math.abs(j - e.j) <= 1) continue;
      const cx = cellX(i), cz = cellX(j);
      if (L.data.solids.some((s) => Math.hypot(s.x - cx, s.z - cz) < s.r + 0.4)) continue;
      const dd = (cx - x) ** 2 + (cz - z) ** 2;
      if (dd < bd) { bd = dd; best = { x: cx, z: cz }; }
    }
    return best;
  }

  randomLand(k) {
    const d = this.levels[k].data, cells = [];
    for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) if (d.type[i][j] === T.GRASS && d.dist[i][j] >= 2) cells.push([i, j]);
    const [i, j] = cells[Math.floor(Math.random() * cells.length)];
    return this.nearestLand(k, cellX(i), cellX(j));
  }

  boothPos(k) {
    const e = this.levels[k].data.elevator;
    return e ? { x: cellX(e.i), z: cellX(e.j) } : null;
  }

  // La carte se dévoile autour du joueur.
  reveal(k, x, z, rad = 6) {
    const d = this.levels[k].data, seen = d.seen, ci = toCell(x), cj = toCell(z);
    let n = 0;
    for (let i = ci - rad; i <= ci + rad; i++) for (let j = cj - rad; j <= cj + rad; j++)
      if (i >= 0 && j >= 0 && i < SIZE && j < SIZE && (i - ci) ** 2 + (j - cj) ** 2 <= rad * rad && !seen[i * SIZE + j]) {
        seen[i * SIZE + j] = 1;
        if (d.type[i][j]) n++;
      }
    return n;
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
  update(dt, t, focus, hole) {
    shaderTime.value = t;
    const cur = Math.round(focus.y / GAP);
    // un étage construit par image au plus, du plus proche au plus lointain
    for (const off of [0, -1, 1, -2, 2]) {
      const L = this.levels[cur + off];
      if (L && !L.built) { this.build(L); break; }
    }
    for (const L of this.all) if (L.built && Math.abs(L.k - cur) > 3 && !L.booth?.userData.traveling && !L.rocketAway) this.unbuild(L);

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
      L.U.uHole.value.set(hole.x, hole.y, hole.r, hole.z);
      if (L.hottub) L.hottub.userData.water.position.y = 0.36 + Math.sin(t * 4) * 0.02;
      const b = L.booth;
      if (b) {
        const bu = b.userData.U;
        if (b.userData.traveling) { bu.uFade.value = 1; bu.uFogAmt.value = 0; }
        else { bu.uFade.value = fade; bu.uFogAmt.value = L.U.uFogAmt.value; bu.uFog.value.copy(P.fog); }
        b.visible = b.userData.traveling || L.group.visible;
      }
      if (!L.group.visible) continue;
      for (const p of L.pickups) {
        const m = p.model, ph = m.userData.phase;
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
