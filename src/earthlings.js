// Les terriens : modèles en volumes et comportements.
// Chacun erre près de chez lui, repère ToeJam à la vue (deux fois moins loin s'il marche sur
// la pointe des pieds), le poursuit à sa façon, et le bouscule au contact.
// Une tomate bien placée les fait déguerpir.
import * as THREE from 'three';
import { EARTHLINGS } from './catalog.js';
import { T } from './gen.js';
import { topOf } from './terrain3d.js';
import { sound } from './audio.js';

const mats = new Map();
function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color, ...o }));
  return mats.get(key);
}
function add(parent, geo, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, o) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, o) : color);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function joint(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
const sph = (r, a = 14, b = 10) => new THREE.SphereGeometry(r, a, b);
const cyl = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s);
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 8);

function legs(body, color, y, spread = 0.1, len = 0.3, shoe = '#2a2440') {
  return [-1, 1].map((s) => {
    const j = joint(body, s * spread, y, 0);
    add(j, cap(0.06, len), color, 0, -len / 2 - 0.04, 0);
    add(j, new THREE.BoxGeometry(0.13, 0.08, 0.2), shoe, 0, -len - 0.08, 0.03);
    return j;
  });
}
function eyes(head, y, z, spread, r = 0.035) {
  for (const s of [-1, 1]) add(head, sph(r, 8, 6), '#1a1033', s * spread, y, z);
}

const MODELS = {
  dentist() {
    const root = new THREE.Group(), body = joint(root);
    const L = legs(body, '#3a3550', 0.45);
    add(body, cyl(0.24, 0.32, 0.75), '#f4f6ff', 0, 0.8);
    add(body, new THREE.BoxGeometry(0.1, 0.12, 0.02), '#9ad8ff', 0.1, 0.95, 0.25);
    const head = joint(body, 0, 1.36);
    add(head, sph(0.22), '#f0c39a');
    add(head, sph(0.23, 12, 6), '#9aa0b0', 0, 0.07, -0.04, 1, 0.75, 1);
    add(head, cyl(0.08, 0.08, 0.02), '#e8eef8', 0, 0.12, 0.2).rotation.x = Math.PI / 2;
    eyes(head, 0.02, 0.2, 0.08);
    add(head, new THREE.BoxGeometry(0.14, 0.04, 0.02), '#ffffff', 0, -0.09, 0.2);
    const arm = joint(body, 0.3, 1.0, 0);
    add(arm, cap(0.06, 0.25), '#f4f6ff', 0, -0.15, 0.05).rotation.x = -0.9;
    const drill = joint(arm, 0, -0.18, 0.3);
    add(drill, cyl(0.05, 0.05, 0.25), '#8b93a8').rotation.x = Math.PI / 2;
    const bit = add(drill, new THREE.ConeGeometry(0.03, 0.16, 6), '#d9e3ff', 0, 0, 0.2);
    bit.rotation.x = Math.PI / 2;
    return { root, body, legs: L, extra: { bit } };
  },
  nerd() {
    const root = new THREE.Group(), body = joint(root);
    const L = legs(body, '#4a5a8a', 0.36, 0.08, 0.24);
    add(body, cyl(0.2, 0.24, 0.5), '#ff9a3a', 0, 0.62);
    add(body, new THREE.BoxGeometry(0.1, 0.12, 0.02), '#ffffff', 0.08, 0.72, 0.22);
    const head = joint(body, 0, 1.05);
    add(head, sph(0.22), '#f2c29b');
    add(head, sph(0.23, 12, 6), '#6b4a2e', 0, 0.08, -0.03, 1, 0.7, 1);
    for (const s of [-1, 1]) { const gl = add(head, new THREE.TorusGeometry(0.07, 0.02, 6, 12), '#1a1033', s * 0.09, 0.02, 0.2); gl.rotation.y = 0; }
    add(head, new THREE.BoxGeometry(0.06, 0.02, 0.02), '#1a1033', 0, 0.02, 0.21);
    eyes(head, 0.02, 0.22, 0.09, 0.025);
    return { root, body, legs: L };
  },
  hamster() {
    const root = new THREE.Group(), body = joint(root, 0, 0.5);
    const ball = add(body, sph(0.5, 18, 12), mat('#cfe8ff', { transparent: true, opacity: 0.32, depthWrite: false }));
    ball.castShadow = false;
    const h = joint(body);
    add(h, sph(0.24), '#e8a050', 0, -0.12, 0, 1, 0.85, 1.15);
    add(h, sph(0.14), '#fff3e0', 0, -0.16, 0.12);
    for (const s of [-1, 1]) add(h, sph(0.06, 8, 6), '#ff9ab0', s * 0.13, 0.08, 0.05);
    eyes(h, -0.04, 0.24, 0.08);
    const lines = add(body, new THREE.TorusGeometry(0.5, 0.012, 4, 24), '#9ab8d8');
    lines.rotation.order = 'YXZ';
    return { root, body, extra: { ball: lines, inner: h } };
  },
  cupid() {
    const root = new THREE.Group(), body = joint(root, 0, 1.5);
    add(body, sph(0.24), '#ffc8b0', 0, 0, 0, 1, 1.1, 1);
    add(body, sph(0.2, 10, 6), '#ffffff', 0, -0.14, 0, 1.1, 0.6, 1.1);
    const head = joint(body, 0, 0.36);
    add(head, sph(0.2), '#ffc8b0');
    add(head, sph(0.21, 10, 6), '#ffe36b', 0, 0.07, -0.02, 1, 0.7, 1);
    eyes(head, 0.02, 0.18, 0.07);
    const wings = [-1, 1].map((s) => {
      const w = joint(body, s * 0.12, 0.12, -0.15);
      add(w, sph(0.22, 10, 6), '#ffffff', s * 0.22, 0, 0, 1, 0.12, 0.6);
      return w;
    });
    const bow = add(body, new THREE.TorusGeometry(0.22, 0.02, 6, 16, Math.PI), '#c8902a', 0.28, 0.05, 0.12);
    bow.rotation.z = -Math.PI / 2;
    add(body, new THREE.ConeGeometry(0.04, 0.1, 6), '#ff4a8a', 0.3, 0.05, 0.3).rotation.x = Math.PI / 2;
    return { root, body, extra: { wings } };
  },
  devil() {
    const root = new THREE.Group(), body = joint(root);
    const L = legs(body, '#c22828', 0.32, 0.08, 0.2, '#1a1033');
    add(body, sph(0.26), '#e8281f', 0, 0.55, 0, 1, 1.1, 1);
    const head = joint(body, 0, 0.92);
    add(head, sph(0.21), '#e8281f');
    for (const s of [-1, 1]) add(head, new THREE.ConeGeometry(0.05, 0.16, 6), '#fff3c0', s * 0.11, 0.2, 0).rotation.z = -s * 0.4;
    eyes(head, 0.03, 0.19, 0.07);
    add(head, new THREE.BoxGeometry(0.12, 0.025, 0.02), '#1a1033', 0, -0.07, 0.19);
    const tail = joint(body, 0, 0.45, -0.22);
    add(tail, cyl(0.025, 0.025, 0.35, 6), '#c22828', 0, 0.1, -0.1).rotation.x = -0.9;
    add(tail, new THREE.ConeGeometry(0.06, 0.12, 4), '#c22828', 0, 0.22, -0.26).rotation.x = -0.9;
    const fork = joint(body, 0.3, 0.6, 0.1);
    add(fork, cyl(0.025, 0.025, 0.9, 6), '#8b93a8', 0, 0.2, 0);
    for (const x of [-0.07, 0, 0.07]) add(fork, new THREE.ConeGeometry(0.025, 0.14, 4), '#d9e3ff', x, 0.7, 0);
    return { root, body, legs: L, extra: { fork } };
  },
  opera() {
    const root = new THREE.Group(), body = joint(root);
    add(body, new THREE.ConeGeometry(0.6, 1.1, 16), '#8a3ad0', 0, 0.55);
    add(body, sph(0.3), '#8a3ad0', 0, 1.1, 0, 1.1, 0.9, 1);
    const head = joint(body, 0, 1.55);
    add(head, sph(0.24), '#f2c29b');
    add(head, new THREE.SphereGeometry(0.26, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#a8aec2', 0, 0.06, 0);
    for (const s of [-1, 1]) add(head, new THREE.ConeGeometry(0.06, 0.3, 6), '#fff3e0', s * 0.26, 0.2, 0).rotation.z = -s * 1.0;
    for (const s of [-1, 1]) add(head, cyl(0.05, 0.03, 0.5, 6), '#ffd23f', s * 0.22, -0.3, -0.05);
    eyes(head, 0.04, 0.21, 0.08);
    const mouth = add(head, sph(0.06, 8, 6), '#5a0f22', 0, -0.09, 0.2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: '#ff8ad8', transparent: true, opacity: 0.7, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 1.4; ring.visible = false;
    root.add(ring);
    return { root, body, extra: { mouth, ring } };
  },
  wiseman() {
    const root = new THREE.Group(), body = joint(root);
    const carrot = add(body, new THREE.ConeGeometry(0.42, 1.5, 12), '#ff8a2a', 0, 0.85);
    carrot.rotation.x = Math.PI;
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; add(body, new THREE.ConeGeometry(0.07, 0.5, 5), '#3fae4a', Math.cos(a) * 0.12, 1.78, Math.sin(a) * 0.12).rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); }
    for (let y = 0.4; y < 1.4; y += 0.25) add(body, new THREE.TorusGeometry(0.3 - (1.4 - y) * 0.1, 0.012, 4, 16), '#d96a1a', 0, y, 0).rotation.x = Math.PI / 2;
    const face = joint(body, 0, 1.25, 0.3);
    add(face, sph(0.15), '#f0c39a');
    add(face, sph(0.13, 10, 8), '#f4f4f4', 0, -0.12, 0.03, 1, 1.2, 0.8);
    eyes(face, 0.03, 0.13, 0.05, 0.025);
    return { root, body };
  },
};
MODELS.hula = function () {
  const root = new THREE.Group(), body = joint(root);
  const L = legs(body, '#c98a5a', 0.4, 0.08, 0.3, '#c98a5a');
  const skirt = add(body, new THREE.ConeGeometry(0.34, 0.45, 12, 1, true), '#5fcf5a', 0, 0.55, 0);
  skirt.material = mat('#5fcf5a', { side: THREE.DoubleSide });
  add(body, cyl(0.15, 0.2, 0.4), '#c98a5a', 0, 0.9);
  add(body, sph(0.12), '#ff5fd2', -0.07, 1.0, 0.1, 1, 0.7, 0.6); add(body, sph(0.12), '#ff5fd2', 0.07, 1.0, 0.1, 1, 0.7, 0.6);
  const lei = add(body, new THREE.TorusGeometry(0.17, 0.05, 6, 14), '#ffd23f', 0, 1.12, 0); lei.rotation.x = Math.PI / 2 - 0.3;
  const head = joint(body, 0, 1.36);
  add(head, sph(0.2), '#c98a5a');
  add(head, sph(0.22, 12, 8), '#2a1a12', 0, 0.04, -0.06, 1, 1.05, 1);
  add(head, sph(0.06, 8, 6), '#ff8ad8', 0.15, 0.1, 0.05);
  eyes(head, 0.02, 0.18, 0.07);
  const arms = [-1, 1].map((s) => { const j = joint(body, s * 0.18, 1.05, 0); add(j, cap(0.045, 0.3), '#c98a5a', 0, -0.18, 0); return j; });
  return { root, body, legs: L, extra: { arms } };
};

const MODEL_OF = { dentist: 'dentist', nerds: 'nerd', hamster: 'hamster', cupid: 'cupid', devil: 'devil', opera: 'opera', wiseman: 'wiseman', hula: 'hula' };

export class Earthlings {
  constructor(scene) { this.scene = scene; this.list = []; this.level = -1; }

  clear() { for (const e of this.list) this.scene.remove(e.m.root); this.list = []; this.level = -1; }

  // Fait apparaître les terriens de l'étage où se trouve ToeJam.
  setLevel(world, k) {
    this.clear();
    this.level = k;
    const L = world.levels[k];
    for (const item of L.data.earthlings) {
      if (item.gone) continue;
      const n = item.type === 'nerds' ? item.left ?? 4 : 1;
      item.left = n;
      for (let i = 0; i < n; i++) {
        const m = MODELS[MODEL_OF[item.type]]();
        if (item.type === 'nerds') m.root.scale.setScalar(0.9);
        const pos = new THREE.Vector3(item.x + (i % 2) * 0.8 - 0.4, L.y, item.z + Math.floor(i / 2) * 0.8 - 0.4);
        m.root.position.copy(pos);
        this.scene.add(m.root);
        this.list.push({ item, type: item.type, def: EARTHLINGS[item.type], m, pos, home: pos.clone(), dir: { x: 0, z: 1 }, target: null,
          state: 'wander', t: Math.random() * 5, cool: 0, idx: i, roll: 0, singT: 0, noise: 0 });
      }
    }
  }

  // Le terrien amical tout proche (le sage), s'il y en a un.
  friendNear(pos) {
    return this.list.find((e) => e.type === 'wiseman' && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < 1.6) || null;
  }

  // Retire un terrien (tomate, ou sage qui s'en va) avec un nuage de fumée.
  poof(e, fx) {
    this.scene.remove(e.m.root);
    this.list = this.list.filter((x) => x !== e);
    fx.dust(e.pos, 18, ['#ffffff', '#d9d9e6', '#b9b0de']);
    sound.play('poof');
    if (e.type === 'nerds') { e.item.left -= 1; if (e.item.left <= 0) e.item.gone = true; }
    else e.item.gone = true;
  }

  // Une tomate touche-t-elle quelqu'un ? Renvoie le terrien touché.
  hit(pos) {
    const e = this.list.find((e) => !e.def.friendly && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < 0.8 && Math.abs(e.pos.y + (e.def.flies ? 1.5 : 0.6) - pos.y) < 1.2);
    return e || null;
  }

  ok(world, x, z) {
    const t = world.type(this.level, x, z);
    return t && t !== T.WATER;
  }

  update(dt, g) {
    const world = g.world, L = world.levels[this.level];
    const visible = g.player.level === this.level && !g.seq && g.state !== 'title';
    const targets = g.players.filter((q) => q.visible && q.control && q.level === this.level);
    const active = visible && g.state === 'play' && !g.menu && targets.length > 0;
    for (const e of this.list) {
      e.m.root.visible = visible;
      if (!active) continue;
      // chacun s'intéresse au joueur le plus proche
      let p = targets[0];
      for (const q of targets) if (Math.hypot(q.pos.x - e.pos.x, q.pos.z - e.pos.z) < Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z)) p = q;
      const d = e.def, dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, dist = Math.hypot(dx, dz);
      e.t += dt; e.cool = Math.max(0, e.cool - dt);
      const sight = d.sight * (p.sneaking ? 0.5 : 1);
      if (!d.friendly && e.state === 'wander' && dist < sight) {
        e.state = 'chase';
        if (e.noise <= 0) { sound.play(d.sound, { vol: 0.7 }); e.noise = 4; }
      } else if (e.state === 'chase' && dist > sight * 1.8) e.state = 'wander';
      e.noise -= dt;

      let speed = d.speed, tx, tz;
      if (e.type === 'opera') {
        // la cantatrice ne court pas : elle chante, et ça fait mal aux oreilles
        speed = dist < 6 ? 0 : d.speed;
        if (dist < 4.5) {
          if (e.singT <= 0 || e.singT > 3) { e.singT = 0.001; sound.play('cantatrice', { vol: 0.6 }); }
          e.singT += dt;
          g.damage(6 * dt, p);
          const push = 2.2 / Math.max(dist, 0.5);
          p.kick(dx / Math.max(dist, 0.01) * push * dt * 8, dz / Math.max(dist, 0.01) * push * dt * 8);
        } else e.singT = 0;
        e.dir = { x: dx / (dist || 1), z: dz / (dist || 1) };
      }
      if (e.type === 'cupid' && e.state === 'chase') {
        // Cupidon tourne autour de sa cible, puis pique dessus
        const a = e.t * 1.2 + e.idx, dive = (e.t % 3.2) > 2.4;
        tx = dive ? p.pos.x : p.pos.x + Math.cos(a) * 3; tz = dive ? p.pos.z : p.pos.z + Math.sin(a) * 3;
        speed = dive ? 7 : d.chase;
      } else if (e.state === 'chase' && e.type !== 'opera') {
        tx = p.pos.x; tz = p.pos.z; speed = d.chase;
        if (e.type === 'nerds') { const a = e.idx * 1.6 + e.t * 0.5; tx += Math.cos(a) * 0.5; tz += Math.sin(a) * 0.5; }
        if (e.type === 'hamster') {
          // la boule fonce en ligne droite et ne tourne qu'au bout d'un moment
          e.roll -= dt;
          if (e.roll <= 0) { e.roll = 1.1; e.dir = { x: dx / (dist || 1), z: dz / (dist || 1) }; sound.play('hamster', { vol: 0.5 }); }
          tx = e.pos.x + e.dir.x * 5; tz = e.pos.z + e.dir.z * 5;
        }
      } else if (e.type !== 'opera') {
        if (!e.target || Math.hypot(e.target.x - e.pos.x, e.target.z - e.pos.z) < 0.3 || e.t > 6) {
          e.t = 0;
          const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 4;
          e.target = { x: e.home.x + Math.cos(a) * r, z: e.home.z + Math.sin(a) * r };
        }
        tx = e.target.x; tz = e.target.z; speed = d.speed * 0.6;
      }
      if (tx !== undefined && speed > 0) {
        let vx = tx - e.pos.x, vz = tz - e.pos.z;
        const l = Math.hypot(vx, vz) || 1;
        vx /= l; vz /= l;
        // on s'écarte des copains
        for (const o of this.list) {
          if (o === e) continue;
          const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, od = Math.hypot(ox, oz);
          if (od < 0.7 && od > 0.001) { vx += (ox / od) * 0.8; vz += (oz / od) * 0.8; }
        }
        const l2 = Math.hypot(vx, vz) || 1;
        vx /= l2; vz /= l2;
        e.dir.x += (vx - e.dir.x) * Math.min(1, dt * (e.type === 'hamster' ? 1.5 : 8));
        e.dir.z += (vz - e.dir.z) * Math.min(1, dt * (e.type === 'hamster' ? 1.5 : 8));
        const nx = e.pos.x + e.dir.x * speed * dt, nz = e.pos.z + e.dir.z * speed * dt;
        if (d.flies || this.ok(world, nx, nz)) { e.pos.x = nx; e.pos.z = nz; e.moving = true; }
        else { e.target = null; e.moving = false; if (e.type === 'hamster') { e.dir.x *= -1; e.dir.z *= -1; e.roll = 0.6; } }
      } else e.moving = false;
      const ty = world.type(this.level, e.pos.x, e.pos.z);
      e.pos.y = L.y + (ty ? topOf(ty) : 0);

      // contact
      const reach = e.type === 'hamster' ? 0.85 : e.type === 'cupid' ? 0.9 : 0.7;
      if (!d.friendly && e.type !== 'opera' && dist < reach && e.cool <= 0) {
        e.cool = 1.2;
        g.hurt(e, dx / (dist || 1), dz / (dist || 1), p);
        if (e.type === 'hamster') { e.dir.x *= -1; e.dir.z *= -1; e.roll = 0.8; }
      }
    }
    if (visible) this.animate(g.t);
  }

  animate(t) {
    for (const e of this.list) {
      const m = e.m, ph = t * 9 + e.idx;
      m.root.position.copy(e.pos);
      if (e.type !== 'hamster') m.root.rotation.y = Math.atan2(e.dir.x, e.dir.z);
      if (m.legs) m.legs.forEach((l, i) => { l.rotation.x = e.moving ? Math.sin(ph + i * Math.PI) * 0.7 : 0; });
      switch (e.type) {
        case 'dentist': m.extra.bit.rotation.y = t * 40; m.body.position.y = e.moving ? Math.abs(Math.sin(ph)) * 0.05 : 0; break;
        case 'nerds': m.body.rotation.z = Math.sin(ph * 0.5) * 0.08; break;
        case 'hamster': {
          const sp = e.moving ? 1 : 0;
          m.extra.ball.rotation.set(t * 6 * sp, Math.atan2(e.dir.x, e.dir.z), 0);
          m.extra.inner.rotation.y = Math.atan2(e.dir.x, e.dir.z);
          m.extra.inner.position.y = Math.abs(Math.sin(t * 14)) * 0.04 * sp;
          break;
        }
        case 'cupid': m.body.position.y = 1.5 + Math.sin(t * 3 + e.idx) * 0.15; m.extra.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 18) * 0.6; }); break;
        case 'devil': m.body.position.y = Math.abs(Math.sin(t * 7)) * 0.18; m.extra.fork.rotation.x = Math.sin(t * 7) * 0.3; break;
        case 'opera': {
          const sing = e.singT > 0;
          m.extra.mouth.scale.setScalar(sing ? 1.6 + Math.sin(t * 20) * 0.3 : 0.6);
          m.extra.ring.visible = sing;
          const s = 1 + ((t * 2) % 1) * 3.5;
          m.extra.ring.scale.setScalar(s); m.extra.ring.material.opacity = 0.7 * (1 - (s - 1) / 3.5);
          break;
        }
        case 'wiseman': m.body.rotation.z = Math.sin(t * 1.2) * 0.05; break;
        case 'hula':
          m.body.rotation.z = Math.sin(t * 4 + e.idx) * 0.12;
          m.extra.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (1.2 + Math.sin(t * 4 + i * Math.PI) * 0.4); a.rotation.x = Math.sin(t * 2) * 0.3; });
          break;
      }
    }
  }
}
