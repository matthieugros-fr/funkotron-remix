// La pile d'étages : les 25 niveaux existent pour de vrai, les uns au-dessus des autres.
// Les données de tous les étages sont générées au départ ; les volumes 3D ne sont construits
// que pour les étages proches du joueur (et détruits quand il s'éloigne).
import * as THREE from 'three';
import { SIZE, GAP, LEVELS, KEYFRAMES, PAL_KEYS } from './config.js';
import { generateLevel, placeFeatures, cellX, toCell, T } from './gen.js';
import { buildTerrain, buildWater, topOf } from './terrain3d.js';
import { buildDecor } from './decor3d.js';
import { patchMaterial, levelUniforms, setDetailTexture, shaderTime } from './dither.js';
import { createBooth } from './booth.js';
import { pickupMaterials, presentModel, setPresentWrap, billModel, mailboxModel, pieceModel } from './pickups.js';
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

function levelPalette(k) {
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
      const group = new THREE.Group();
      group.position.y = k * GAP;
      scene.add(group);
      const U = levelUniforms(THREE);
      U.uLevelY.value = k * GAP;
      this.levels.push({ k, y: k * GAP, data, group, U, built: false, booth: null, pickups: [], colliders: data.solids });
      forced = data.elevator;
    }
    this.palettes = this.levels.map((L) => levelPalette(L.k));
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
    if (data.piece && !data.piece.taken) place('piece', data.piece, pieceModel(M, data.piece.index));
    if (data.mailbox) place('mailbox', data.mailbox, mailboxModel(M));
    L.built = true;
  }

  unbuild(L) {
    if (!L.built) return;
    const geos = new Set();
    for (const m of L.own) { L.group.remove(m); geos.add(m.geometry); m.material.dispose(); }
    for (const p of L.pickups) { L.group.remove(p.model); p.model.traverse((o) => o.geometry && geos.add(o.geometry)); }
    for (const g of geos) g.dispose();
    if (L.booth && L.booth.parent === L.group) L.group.remove(L.booth);
    L.own = []; L.pickups = []; L.built = false;
  }

  dispose() {
    for (const L of this.levels) { this.unbuild(L); this.scene.remove(L.group); if (L.booth?.parent) L.booth.parent.remove(L.booth); }
    for (const o of this.lights) this.scene.remove(o);
  }

  // Après un Randomiseur : les cadeaux posés changent de papier.
  refreshWraps(bag) {
    for (const L of this.levels) for (const p of L.pickups) if (p.kind === 'present') setPresentWrap(p.model, L.mats, bag.wrapOf[p.item.type]);
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
    for (const s of this.levels[k].colliders) {
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
      if (L.colliders.some((s) => Math.hypot(s.x - cx, s.z - cz) < s.r + 0.4)) continue;
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
    const seen = this.levels[k].data.seen, ci = toCell(x), cj = toCell(z);
    for (let i = ci - rad; i <= ci + rad; i++) for (let j = cj - rad; j <= cj + rad; j++)
      if (i >= 0 && j >= 0 && i < SIZE && j < SIZE && (i - ci) ** 2 + (j - cj) ** 2 <= rad * rad) seen[i * SIZE + j] = 1;
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

  // Appelé à chaque image : construction, ambiance, fondus, trou autour du héros, soleil, objets.
  update(dt, t, focus, hole) {
    shaderTime.value = t;
    const cur = Math.round(focus.y / GAP);
    // un étage construit par image au plus, du plus proche au plus lointain
    for (const off of [0, -1, 1, -2, 2]) {
      const L = this.levels[cur + off];
      if (L && !L.built) { this.build(L); break; }
    }
    for (const L of this.levels) if (L.built && Math.abs(L.k - cur) > 3 && !L.booth?.userData.traveling) this.unbuild(L);

    const lv = clamp(focus.y / GAP, 0, LEVELS - 1), i0 = Math.floor(lv), i1 = Math.min(LEVELS - 1, i0 + 1), f = smooth(lv - i0);
    for (const key of PAL_KEYS) this.pal[key].lerpColors(this.palettes[i0][key], this.palettes[i1][key], f);
    const P = this.pal;

    for (const L of this.levels) {
      const above = L.y - focus.y;
      const fade = above <= 0.5 ? 1 : clamp(1 - (above - 0.5) / 5);
      L.U.uFade.value = fade;
      L.group.visible = L.built && fade > 0.02 && focus.y - L.y < GAP * 2.3;
      if (!L.built) continue;
      L.U.uFog.value.copy(P.fog);
      L.U.uFogAmt.value = focus.y > L.y + 0.5 ? Math.min(0.82, ((focus.y - L.y) / GAP) * 0.5) : 0;
      L.terrain.castShadow = above <= 0.5;
      L.U.uHole.value.set(hole.x, hole.y, hole.r, hole.z);
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
