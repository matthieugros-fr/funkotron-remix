// Les changements de niveau, chorégraphiés image par image.
import * as THREE from 'three';
import { GAP } from './config.js';
import { BOOTH } from './booth.js';
import { clamp, lerp, smooth, easeInOutCubic, easeOutBounce, easeInCubic, easeOutCubic } from './util.js';

const NAMES = ['NIVEAU 1', 'NIVEAU 2', 'NIVEAU 3', 'NIVEAU 4'];
export const levelTitle = (k) => NAMES[k] || `NIVEAU ${k + 1}`;

// Chute : suspension façon dessin animé, plongeon à travers le vide, écrasement, on se relève.
export class FallSeq {
  constructor(g) {
    const p = g.player;
    this.g = g; this.t = 0; this.phase = 'hang';
    this.from = p.level; this.to = p.level - 1;
    const l = Math.hypot(p.vel.x, p.vel.z) || 1;
    this.dir = { x: p.vel.x / l, z: p.vel.z / l };
    this.y0 = p.pos.y; this.y1 = this.to * GAP; this.vy = 0;
    this.target = g.world.nearestLand(this.to, p.pos.x + this.dir.x * 1.2, p.pos.z + this.dir.z * 1.2);
    p.control = false; p.bang = true; p.anim = 'fall';
    g.holeR = 2;
  }

  focus() { return this.g.player.mid(); }

  update(dt) {
    const g = this.g, p = g.player;
    this.t += dt;
    if (this.phase === 'hang') {
      // le temps de comprendre qu'il n'y a plus rien sous ses pieds
      p.pos.x += this.dir.x * 0.7 * dt; p.pos.z += this.dir.z * 0.7 * dt;
      p.anim = 'fall';
      if (this.t > 0.34) { this.phase = 'drop'; p.bang = false; this.sx = p.pos.x; this.sz = p.pos.z; }
    } else if (this.phase === 'drop') {
      this.vy = Math.max(this.vy - 34 * dt, -26);
      p.pos.y += this.vy * dt;
      const f = clamp((this.y0 - p.pos.y) / (this.y0 - this.y1));
      const e = smooth(f);
      p.pos.x = lerp(this.sx, this.target.x, e);
      p.pos.z = lerp(this.sz, this.target.z, e);
      p.anim = 'fall';
      p.shadowOverride = { x: this.target.x, y: this.y1, z: this.target.z - 0.04, s: 0.25 + 0.75 * f * f };
      if (f > 0.05) g.fx.streaks(p.mid(), dt);
      if (p.pos.y <= this.y1) {
        p.pos.set(this.target.x, this.y1, this.target.z);
        p.level = this.to;
        p.shadowOverride = null;
        this.phase = 'land'; this.t = 0;
        p.anim = 'splat'; p.squash = 1;
        g.fx.dust(p.pos, 20);
        g.shake = 3.5;
        g.hud.showCard(levelTitle(this.to));
        g.holeR = 1;
      }
    } else {
      p.anim = this.t > 0.62 ? 'getup' : 'splat';
      if (this.t > 0.95) { p.anim = 'idle'; p.control = true; return true; }
    }
    return false;
  }
}

// Ascenseur : on entre, les portes se ferment, la cabine s'écrase puis file vers le haut
// à travers le dessous de l'étage supérieur, émerge du sol, rebondit, s'ouvre.
export class ElevatorSeq {
  constructor(g) {
    const p = g.player;
    this.g = g; this.t = 0;
    this.L = g.world.levels[p.level];
    this.booth = this.L.booth;
    this.bx = this.booth.position.x; this.bz = this.booth.position.z;
    this.y0 = this.L.y; this.y1 = this.y0 + GAP;
    this.px0 = p.pos.x; this.pz0 = p.pos.z;
    this.flags = {};
    p.control = false;
    g.holeR = 1;
  }

  once(name) { if (this.flags[name]) return false; this.flags[name] = true; return true; }

  boothMid() { return new THREE.Vector3(this.booth.position.x, this.booth.position.y + BOOTH.H * 0.5, this.booth.position.z); }

  focus() {
    if (this.t < 1.05 || this.t > 3.65) return this.g.player.mid();
    return this.boothMid();
  }

  holeActor() { return this.t >= 1.05 && this.t <= 3.65 ? { pos: this.boothMid() } : null; }

  update(dt) {
    const g = this.g, p = g.player, b = this.booth, ud = b.userData, t = (this.t += dt);
    if (t < 0.4) {
      // ToeJam se glisse au fond de la cabine
      const k = smooth(t / 0.4);
      p.pos.x = lerp(this.px0, this.bx, k); p.pos.z = lerp(this.pz0, this.bz, k);
      p.faceDir(0, -1); p.anim = 'walk'; p.walk += dt * 3;
    } else if (t < 0.85) {
      p.pos.x = this.bx; p.pos.z = this.bz; p.faceDir(0, 1); p.anim = 'idle';
      ud.setDoors(1 - easeOutCubic((t - 0.4) / 0.45));
    } else if (t < 1.05) {
      if (this.once('closed')) { ud.setDoors(0); p.visible = false; g.shake = 1.2; }
      const e = smooth((t - 0.85) / 0.2);
      b.scale.set(1 + 0.08 * e, 1 - 0.12 * e, 1 + 0.08 * e);
      ud.bulbMat.color.set(Math.floor(t * 16) % 2 ? '#ffe680' : '#ff4a5c');
    } else if (t < 3.15) {
      if (this.once('launch')) {
        // la cabine quitte son étage et voyage seule dans l'espace
        ud.traveling = true;
        this.L.group.remove(b);
        g.scene.add(b);
        b.position.set(this.bx, this.y0, this.bz);
        g.holeR = 2.6;
      }
      const u = (t - 1.05) / 2.1, e = easeInOutCubic(u), st = Math.sin(Math.PI * u);
      b.position.y = this.y0 + (GAP + 0.9) * e;
      b.scale.set(1 - 0.1 * st, 1 + 0.24 * st, 1 - 0.1 * st);
      ud.bulbMat.color.set(Math.floor(t * 10) % 2 ? '#ffe680' : '#ff4a5c');
      if (st > 0.25) g.fx.streaks(this.boothMid(), dt, 70);
      p.pos.set(this.bx, b.position.y + 0.12, this.bz);
    } else if (t < 3.65) {
      const k = (t - 3.15) / 0.5;
      b.position.y = this.y1 + 0.9 * (1 - easeOutBounce(k));
      b.scale.set(1, 1, 1);
      if (k > 0.36 && this.once('impact')) {
        g.fx.dust(new THREE.Vector3(this.bx, this.y1, this.bz + 0.6), 26);
        g.shake = 3;
      }
      p.pos.set(this.bx, this.y1, this.bz);
    } else if (t < 4.05) {
      if (this.once('arrived')) {
        b.position.y = this.y1;
        p.level = this.L.k + 1; p.visible = true; p.faceDir(0, 1); p.anim = 'idle';
        ud.bulbMat.color.set('#ffe680');
        g.holeR = 1;
        g.hud.showCard(levelTitle(p.level));
      }
      ud.setDoors(easeOutCubic((t - 3.65) / 0.4));
    } else if (t < 4.5) {
      // il sort, la cabine reste derrière lui
      const k = smooth((t - 4.05) / 0.45);
      p.pos.z = lerp(this.bz, this.bz + 1.9, k); p.faceDir(0, 1); p.anim = 'walk'; p.walk += dt * 3;
    } else {
      p.anim = 'idle'; p.control = true;
      g.ambient.push(new BoothReturn(g, b, this.L, this.y1));
      return true;
    }
    return false;
  }
}

// Une fois ToeJam sorti, la cabine referme ses portes, s'enfonce dans le sol et redescend chez elle.
class BoothReturn {
  constructor(g, b, L, y1) { this.g = g; this.b = b; this.L = L; this.y1 = y1; this.t = 0; }
  update(dt) {
    const b = this.b, ud = b.userData, t = (this.t += dt);
    if (t < 0.8) return false;
    if (t < 1.1) { ud.setDoors(1 - (t - 0.8) / 0.3); return false; }
    if (t < 2.9) {
      const u = (t - 1.1) / 1.8;
      b.position.y = this.y1 - GAP * easeInCubic(u);
      b.scale.set(1 + 0.05 * Math.sin(t * 40) * (1 - u), 1, 1);
      if (u < 0.25 && Math.random() < 0.5) this.g.fx.dust(new THREE.Vector3(b.position.x, this.y1, b.position.z + 0.7), 2);
      return false;
    }
    // rentrée à la maison
    this.g.scene.remove(b);
    b.position.set(ud.home.x, 0, ud.home.z);
    b.scale.set(1, 1, 1);
    ud.setDoors(1);
    ud.traveling = false;
    this.L.group.add(b);
    return true;
  }
}
