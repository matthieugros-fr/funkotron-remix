// Les changements de niveau, chorégraphiés image par image.
// En coopération, le duo reste soudé : si l'un tombe, l'autre saute aussi ; l'ascenseur les emmène tous les deux.
import * as THREE from 'three';
import { GAP, LEVELS } from './config.js';
import { BOOTH } from './booth.js';
import { sound } from './audio.js';
import { clamp, lerp, smooth, easeInOutCubic, easeOutBounce, easeInCubic, easeOutCubic } from './util.js';

export const levelTitle = (k) => (k === LEVELS ? 'FUNKOTRON' : `NIVEAU ${k + 1}`);
const others = (g, p) => g.players.filter((q) => q !== p && q.active);

// Chute : suspension façon dessin animé, plongeon à travers le vide, écrasement, on se relève.
export class FallSeq {
  constructor(g, faller = g.player) {
    this.g = g; this.t = 0;
    this.from = faller.level; this.to = faller.level - 1;
    this.y1 = this.to * GAP;
    // le partenaire saute aussi, une fraction de seconde après (« ATTENDS-MOI ! »)
    this.runners = [faller, ...others(g, faller)].map((p, i) => {
      const l = Math.hypot(p.vel.x, p.vel.z) || 1, dir = { x: p.vel.x / l, z: p.vel.z / l };
      const tgt = i === 0
        ? g.world.nearestLand(this.to, p.pos.x + dir.x * 1.2, p.pos.z + dir.z * 1.2)
        : null;
      p.control = false; p.bang = i === 0; p.anim = 'fall';
      return { p, dir, delay: i * 0.45, phase: 'hang', t: 0, y0: p.pos.y, vy: 0, target: tgt };
    });
    const lead = this.runners[0].target;
    for (const r of this.runners.slice(1)) r.target = g.world.nearestLand(this.to, lead.x + 1.1, lead.z + 0.4);
    if (this.runners.length > 1) g.hud.toast(`${this.runners[1].p.kind === 'earl' ? 'EARL' : 'TOEJAM'} SAUTE AUSSI ! LA SOLIDARITÉ, C'EST BEAU.`);
    g.holeR = 2;
    sound.play('surprise');
  }

  focus() { return this.runners[0].p.mid(); }

  update(dt) {
    const g = this.g;
    this.t += dt;
    let done = true;
    for (const r of this.runners) {
      const p = r.p;
      if (this.t < r.delay) { done = false; continue; }
      r.t += dt;
      if (r.phase === 'hang') {
        // le temps de comprendre qu'il n'y a plus rien sous ses pieds
        p.pos.x += r.dir.x * 0.7 * dt; p.pos.z += r.dir.z * 0.7 * dt;
        p.anim = 'fall';
        if (r.t > 0.34) {
          // celui qui tombe crie, celui qui le suit appelle son copain
          if (r === this.runners[0]) { sound.play('chute'); p.say('chute', true); } else p.say('appel', true);
          r.phase = 'drop'; p.bang = false; r.sx = p.pos.x; r.sz = p.pos.z;
        }
        done = false;
      } else if (r.phase === 'drop') {
        r.vy = Math.max(r.vy - 34 * dt, -26);
        p.pos.y += r.vy * dt;
        const f = clamp((r.y0 - p.pos.y) / (r.y0 - this.y1)), e = smooth(f);
        p.pos.x = lerp(r.sx, r.target.x, e);
        p.pos.z = lerp(r.sz, r.target.z, e);
        p.anim = 'fall';
        p.shadowOverride = { x: r.target.x, y: this.y1, z: r.target.z - 0.04, s: 0.25 + 0.75 * f * f };
        if (f > 0.05) g.fx.streaks(p.mid(), dt);
        if (p.pos.y <= this.y1) {
          p.pos.set(r.target.x, this.y1, r.target.z);
          p.level = this.to; p.shadowOverride = null; p.land();
          r.phase = 'land'; r.t = 0;
          p.anim = 'splat'; p.squash = 1;
          sound.play('splat');
          g.fx.dust(p.pos, 20);
          g.shake = 3.5;
          g.stats.falls++;
          if (r === this.runners[0]) { g.hud.showCard(levelTitle(this.to), this.to === -1 ? 'LE NIVEAU SECRET. CHUT.' : ''); g.holeR = 1; }
        }
        done = false;
      } else {
        p.anim = r.t > 0.62 ? 'getup' : 'splat';
        if (r.t > 0.95) { p.anim = 'idle'; p.control = true; } else done = false;
      }
    }
    return done;
  }
}

// Ascenseur : on entre, les portes se ferment, la cabine s'écrase puis file vers le haut
// à travers le dessous de l'étage supérieur, émerge du sol, rebondit, s'ouvre.
export class ElevatorSeq {
  constructor(g, rider = g.player) {
    this.g = g; this.t = 0; this.p = rider;
    this.mates = others(g, rider);
    this.L = g.world.levels[rider.level];
    this.booth = this.L.booth;
    this.bx = this.booth.position.x; this.bz = this.booth.position.z;
    this.y0 = this.L.y; this.y1 = this.y0 + GAP;
    this.px0 = rider.pos.x; this.pz0 = rider.pos.z;
    this.flags = {};
    for (const q of [rider, ...this.mates]) q.control = false;
    g.holeR = 1;
  }

  once(name) { if (this.flags[name]) return false; this.flags[name] = true; return true; }
  boothMid() { return new THREE.Vector3(this.booth.position.x, this.booth.position.y + BOOTH.H * 0.5, this.booth.position.z); }
  focus() { return this.t < 1.05 || this.t > 3.65 ? this.p.mid() : this.boothMid(); }
  holeActor() { return this.t >= 1.05 && this.t <= 3.65 ? { pos: this.boothMid() } : null; }

  update(dt) {
    const g = this.g, p = this.p, b = this.booth, ud = b.userData, t = (this.t += dt);
    const all = [p, ...this.mates];
    if (t < 0.4) {
      const k = smooth(t / 0.4);
      p.pos.x = lerp(this.px0, this.bx, k); p.pos.z = lerp(this.pz0, this.bz, k);
      p.faceDir(0, -1); p.anim = 'walk'; p.walk += dt * 3;
    } else if (t < 0.85) {
      if (this.once('doorsfx')) sound.play('portes');
      p.pos.x = this.bx; p.pos.z = this.bz; p.faceDir(0, 1); p.anim = 'idle';
      ud.setDoors(1 - easeOutCubic((t - 0.4) / 0.45));
    } else if (t < 1.05) {
      if (this.once('closed')) {
        ud.setDoors(0); g.shake = 1.2;
        // le partenaire est aspiré dans la cabine, où qu'il soit
        for (const q of this.mates) { g.fx.dust(q.pos, 12); sound.play('poof', { vol: 0.6 }); }
        for (const q of all) q.visible = false;
      }
      const e = smooth((t - 0.85) / 0.2);
      b.scale.set(1 + 0.08 * e, 1 - 0.12 * e, 1 + 0.08 * e);
      ud.bulbMat.color.set(Math.floor(t * 16) % 2 ? '#ffe680' : '#ff4a5c');
    } else if (t < 3.15) {
      if (this.once('launch')) {
        ud.traveling = true;
        sound.play('decollage');
        sound.jingle('ascenseur');
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
      for (const q of all) q.pos.set(this.bx, b.position.y + 0.12, this.bz);
    } else if (t < 3.65) {
      const k = (t - 3.15) / 0.5;
      b.position.y = this.y1 + 0.9 * (1 - easeOutBounce(k));
      b.scale.set(1, 1, 1);
      if (k > 0.36 && this.once('impact')) {
        sound.play('arrivee');
        g.fx.dust(new THREE.Vector3(this.bx, this.y1, this.bz + 0.6), 26);
        g.shake = 3;
      }
      for (const q of all) q.pos.set(this.bx, this.y1, this.bz);
    } else if (t < 4.05) {
      if (this.once('arrived')) {
        b.position.y = this.y1;
        for (const q of all) { q.level = this.L.k + 1; q.faceDir(0, 1); q.anim = 'idle'; }
        p.visible = true;
        ud.bulbMat.color.set('#ffe680');
        g.holeR = 1;
        g.hud.showCard(levelTitle(p.level));
      }
      ud.setDoors(easeOutCubic((t - 3.65) / 0.4));
    } else if (t < 4.5) {
      const k = smooth((t - 4.05) / 0.45);
      p.pos.z = lerp(this.bz, this.bz + 1.9, k); p.faceDir(0, 1); p.anim = 'walk'; p.walk += dt * 3;
      this.mates.forEach((q, i) => {
        if (this.once('mate' + i)) { q.visible = true; g.fx.dust(q.pos, 8); }
        q.pos.x = this.bx + 1.1 * k; q.pos.z = lerp(this.bz, this.bz + 1.9, k); q.faceDir(0, 1); q.anim = 'walk'; q.walk += dt * 3;
      });
    } else {
      for (const q of all) { q.anim = 'idle'; q.control = true; q.land(); }
      g.ambient.push(new BoothReturn(g, b, this.L, this.y1));
      return true;
    }
    return false;
  }
}

// Une fois le duo sorti, la cabine referme ses portes, s'enfonce dans le sol et redescend chez elle.
class BoothReturn {
  constructor(g, b, L, y1) { this.g = g; this.b = b; this.L = L; this.y1 = y1; this.t = 0; }
  update(dt) {
    const b = this.b, ud = b.userData, t = (this.t += dt);
    if (t < 0.8) return false;
    if (t < 1.1) { if (!this.closed) { this.closed = true; sound.play('portes', { vol: 0.6 }); } ud.setDoors(1 - (t - 0.8) / 0.3); return false; }
    if (t < 2.9) {
      const u = (t - 1.1) / 1.8;
      b.position.y = this.y1 - GAP * easeInCubic(u);
      b.scale.set(1 + 0.05 * Math.sin(t * 40) * (1 - u), 1, 1);
      if (u < 0.25 && Math.random() < 0.5) this.g.fx.dust(new THREE.Vector3(b.position.x, this.y1, b.position.z + 0.7), 2);
      return false;
    }
    this.g.scene.remove(b);
    b.position.set(ud.home.x, 0, ud.home.z);
    b.scale.set(1, 1, 1);
    ud.setDoors(1);
    ud.traveling = false;
    this.L.group.add(b);
    return true;
  }
}

// La Porte : l'iris se ferme sur celui qui l'a ouverte, il réapparaît ailleurs sur l'étage.
export class DoorSeq {
  constructor(g, p = g.player) { this.g = g; this.p = p; this.t = 0; p.control = false; p.anim = 'idle'; sound.play('porte'); }
  focus() { return this.p.mid(); }
  update(dt) {
    const g = this.g, p = this.p, t = (this.t += dt);
    if (t < 0.4) g.iris(p.mid(), (1 - t / 0.4) * g.pipe.TW * 0.6);
    else if (!this.moved) {
      this.moved = true;
      g.fx.dust(p.pos, 14);
      const s = g.world.randomLand(p.level);
      p.pos.x = s.x; p.pos.z = s.z;
      g.focus.copy(p.mid());
    } else if (t < 0.9) g.iris(p.mid(), ((t - 0.4) / 0.5) * g.pipe.TW * 0.6);
    else { g.iris(null); g.fx.dust(p.pos, 14); p.control = true; return true; }
    return false;
  }
}

// Total Bummer : on s'effondre, puis on se relève (s'il reste une vie).
export class BummerSeq {
  constructor(g, p = g.player) { this.g = g; this.p = p; this.t = 0; p.control = false; p.anim = 'splat'; p.squash = 1; g.shake = 2; sound.play('splat'); }
  focus() { return this.p.mid(); }
  update(dt) {
    const p = this.p, t = (this.t += dt);
    p.anim = t < 1.1 ? 'splat' : 'getup';
    if (t > 1.5) { p.anim = 'idle'; p.control = true; return true; }
    return false;
  }
}

// Le grand départ : le duo monte dans la fusée, compte à rebours, décollage à travers le ciel,
// atterrissage sur Funkotron.
export class EndingSeq {
  constructor(g, L) {
    this.g = g; this.L = L; this.t = 0; this.flags = {};
    this.rocket = L.rocket;
    this.rx = L.rocket.position.x; this.rz = L.rocket.position.z;
    this.y0 = L.y; this.y1 = (L.k + 1) * GAP;
    this.crew = g.players.filter((q) => q.active);
    for (const q of this.crew) { q.control = false; q.sx = q.pos.x; q.sz = q.pos.z; }
    g.holeR = 1;
  }
  once(n) { if (this.flags[n]) return false; this.flags[n] = true; return true; }
  mid() { const o = this.P || this.rocket; return new THREE.Vector3(this.rx, (this.P ? o.position.y : this.y0) + 2, this.rz); }
  focus() { return this.t < 1.2 ? this.crew[0].mid() : this.mid(); }
  holeActor() { return this.t > 4.4 ? { pos: this.mid() } : null; }

  update(dt) {
    const g = this.g, R = this.rocket, t = (this.t += dt), P = this.rocket.userData.rocket;
    if (t < 1.2) {
      // on monte à bord
      const k = smooth(t / 1.1);
      for (const q of this.crew) { q.pos.x = lerp(q.sx, this.rx, k); q.pos.z = lerp(q.sz, this.rz + 0.6, k); q.faceDir(this.rx - q.pos.x, this.rz - q.pos.z); q.anim = 'walk'; q.walk += dt * 3; }
      return false;
    }
    if (this.once('board')) { for (const q of this.crew) { q.visible = false; g.fx.dust(q.pos, 10); } sound.play('portes'); }
    if (t < 4.4) {
      // 3… 2… 1…
      const n = 3 - Math.floor((t - 1.2) / 1.0);
      if (n >= 1 && this.once('count' + n)) { g.hud.showCard(String(n)); sound.play('menu_curseur', { rate: 0.7 }); }
      P.position.x = Math.sin(t * 60) * 0.03 * (t - 1.2);
      if (Math.random() < 0.6) g.fx.dust(new THREE.Vector3(this.rx + (Math.random() - 0.5) * 2, this.y0 + 0.2, this.rz + (Math.random() - 0.5) * 2), 2, ['#d9d9e6', '#ffffff', '#b9b0de']);
      return false;
    }
    if (t < 9.4) {
      if (this.once('lift')) {
        g.hud.showCard('DÉCOLLAGE !');
        sound.play('decollage'); sound.jingle('ascenseur');
        // seule la fusée part ; le pas de tir reste
        this.P = P;
        g.endRocket = P;
        R.remove(P);
        g.scene.add(P);
        P.position.set(this.rx, this.y0 + 0.2, this.rz);
        // elle quitte son étage : elle ne prend plus sa brume
        P.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshLambertMaterial({ color: o.material.color, transparent: o.material.transparent, opacity: o.material.opacity, depthWrite: !o.material.transparent }); });
        g.holeR = 3.2; g.shake = 4;
      }
      const u = (t - 4.4) / 5, e = easeInOutCubic(u);
      P.position.y = this.y0 + 0.2 + (GAP + 0.6) * e;
      P.position.x = this.rx + Math.sin(t * 50) * 0.02;
      const fy = P.position.y;
      for (let k = 0; k < 3; k++) g.fx.spawn(this.rx + (Math.random() - 0.5) * 0.5, fy, this.rz + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 2, -6 - Math.random() * 4, (Math.random() - 0.5) * 2, 0.5, k ? '#ffd23f' : '#ff6a2a', -1);
      g.fx.streaks(this.mid(), dt, 60);
      return false;
    }
    if (t < 10) {
      if (this.once('land')) { P.position.y = this.y1; g.shake = 3; g.fx.dust(new THREE.Vector3(this.rx, this.y1, this.rz), 30); sound.play('arrivee'); }
      return false;
    }
    if (this.once('out')) {
      this.crew.forEach((q, i) => {
        q.level = this.L.k + 1; q.visible = true;
        q.pos.set(this.rx + (i ? 1.2 : -1.2), this.y1, this.rz + 1.8); q.land();
        q.faceDir(0, 1); q.anim = 'dance';
        g.fx.dust(q.pos, 10);
      });
      for (let k = 0; k < 6; k++) g.fx.coins(new THREE.Vector3(this.rx, this.y1 + 2, this.rz), 20);
      g.holeR = 1;
      g.finish();
    }
    return true;
  }
}
