// La pile d'étages : tous les niveaux existent pour de vrai, les uns au-dessus des autres.
import * as THREE from 'three';
import { SIZE, GAP, LEVELS, PALETTES } from './config.js';
import { generateLevel, placeFeatures, cellX, toCell, T } from './gen.js';
import { buildTerrain, buildWater, buildDecor, snapX, snapZ0 } from './levelmesh.js';
import { patchMaterial, levelUniforms } from './dither.js';
import { createBooth, BOOTH } from './booth.js';
import { clamp, smooth } from './util.js';

const PAL_KEYS = Object.keys(PALETTES[0]);

export class World {
  constructor(scene, seed, assets) {
    this.scene = scene;
    this.levels = [];
    let forced = null;
    for (let k = 0; k < LEVELS; k++) {
      const data = generateLevel(k, (seed * 7919 + k * 1013) >>> 0, forced);
      placeFeatures(data, forced || data.center, k === LEVELS - 1);
      this.levels.push(this.makeLevel(k, data, assets));
      forced = data.elevator;
    }
    this.palettes = PALETTES.map((p) => Object.fromEntries(PAL_KEYS.map((k) => [k, new THREE.Color(p[k])])));
    this.pal = Object.fromEntries(PAL_KEYS.map((k) => [k, new THREE.Color()]));

    this.hemi = new THREE.HemisphereLight('#ffffff', '#000000', 0.45 * Math.PI);
    scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight('#ffffff', 0.78 * Math.PI));
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    sun.shadow.intensity = 0.55;
    scene.add(sun, sun.target);
  }

  makeLevel(k, data, assets) {
    const group = new THREE.Group();
    group.position.y = k * GAP;
    this.scene.add(group);
    const U = levelUniforms(THREE);
    const terrain = new THREE.Mesh(buildTerrain(data), patchMaterial(new THREE.MeshLambertMaterial({ map: assets.atlas }), U));
    terrain.castShadow = terrain.receiveShadow = true;
    group.add(terrain);
    const wg = buildWater(data);
    let water = null;
    if (wg) {
      water = new THREE.Mesh(wg, patchMaterial(new THREE.MeshLambertMaterial({ map: assets.water }), U, { water: true }));
      water.receiveShadow = true;
      group.add(water);
    }
    const decorMat = patchMaterial(new THREE.MeshBasicMaterial({ map: assets.decor, alphaTest: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), U);
    const dg = buildDecor(data);
    if (dg) group.add(new THREE.Mesh(dg, decorMat));
    let booth = null;
    if (data.elevator) {
      booth = createBooth(assets.booth);
      booth.position.set(snapX(cellX(data.elevator.i)), 0, snapZ0(cellX(data.elevator.j)));
      booth.userData.home = { group, x: booth.position.x, z: booth.position.z };
      group.add(booth);
    }
    return { k, y: k * GAP, data, group, U, terrain, water, decorMat, booth, colliders: data.solids, holeR: 0 };
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

  boothPos(k) {
    const b = this.levels[k].booth;
    return b ? { x: b.userData.home.x, z: b.userData.home.z } : null;
  }

  // Appelé à chaque image : ambiance, fondus d'étages, trou autour du héros, soleil.
  update(dt, t, focus, hole) {
    const lv = clamp(focus.y / GAP, 0, LEVELS - 1), i0 = Math.floor(lv), i1 = Math.min(LEVELS - 1, i0 + 1), f = smooth(lv - i0);
    for (const key of PAL_KEYS) this.pal[key].lerpColors(this.palettes[i0][key], this.palettes[i1][key], f);
    const P = this.pal;

    for (const L of this.levels) {
      const above = L.y - focus.y;
      const fade = above <= 0.5 ? 1 : clamp(1 - (above - 0.5) / 5);
      L.U.uFade.value = fade;
      L.group.visible = fade > 0.02;
      L.U.uFog.value.copy(P.fog);
      L.U.uFogAmt.value = focus.y > L.y + 0.5 ? Math.min(0.82, ((focus.y - L.y) / GAP) * 0.5) : 0;
      L.terrain.castShadow = above <= 0.5;
      L.U.uHole.value.set(hole.x, hole.y, hole.r, hole.z);
      L.decorMat.color.copy(P.tint);
      if (L.water) L.water.material.map.offset.set(Math.floor(t * 3) / 32, Math.floor(t * 2) / 32);
      const b = L.booth;
      if (b) {
        const bu = b.userData.U;
        if (b.userData.traveling) { bu.uFade.value = 1; bu.uFogAmt.value = 0; }
        else { bu.uFade.value = fade; bu.uFogAmt.value = L.U.uFogAmt.value; bu.uFog.value.copy(P.fog); }
        b.visible = b.userData.traveling || fade > 0.02;
      }
    }
    this.hemi.color.copy(P.hemiSky);
    this.hemi.groundColor.copy(P.hemiGround);
    this.sun.color.copy(P.sun);
    const sx = Math.round(focus.x * 32) / 32, sz = Math.round(focus.z * 32) / 32;
    this.sun.position.set(sx - 9, focus.y + 25, sz + 13);
    this.sun.target.position.set(sx, focus.y, sz);
  }
}
