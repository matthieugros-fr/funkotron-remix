// ToeJam : déplacement relatif à la caméra, collisions, eau, bord du vide, pouvoirs des cadeaux,
// animation du modèle 3D.
import * as THREE from 'three';
import { GAP } from './config.js';
import { T } from './gen.js';
import { topOf } from './terrain3d.js';
import { BOOTH } from './booth.js';
import { buildToeJam, buildEarl, poseToeJam } from './toejam3d.js';
import { attachHero, poseHero, emote } from './hero3d.js';
import { sound } from './audio.js';
import { LIQUIDS } from './biomes.js';

const SPEED = 3.1;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const lam = (c, e) => new THREE.MeshLambertMaterial({ color: c, emissive: e || '#000000' });

// Accessoires des cadeaux, accrochés au modèle et cachés tant qu'ils ne servent pas.
function buildGear(m) {
  const white = lam('#ffffff'), cloud = lam('#7c8296'), steel = lam('#9aa3c0'), skate = lam('#c22840');
  // ailes d'Icare dans le dos
  const wings = new THREE.Group();
  wings.position.set(0, 0.86, -0.2);
  m.body.add(wings);
  const sides = [-1, 1].map((s) => {
    const p = new THREE.Group(); wings.add(p);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), white);
    w.scale.set(1, 0.08, 0.42); w.position.x = s * 0.48; w.castShadow = true; p.add(w);
    for (let k = 0; k < 3; k++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.3), white);
      f.position.set(s * (0.75 + k * 0.08), -0.02, -0.12 + k * 0.12); f.rotation.y = s * 0.3; p.add(f);
    }
    p.userData.s = s;
    return p;
  });
  wings.userData.sides = sides;
  // ressorts et patins sous chaque basket
  const springs = [], skates = [];
  for (const leg of m.legs) {
    const sp = new THREE.Group(); sp.position.set(0, -0.47, 0.04); leg.add(sp);
    for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12), steel); t.rotation.x = Math.PI / 2; t.position.y = -k * 0.045; sp.add(t); }
    springs.push(sp);
    const sk = new THREE.Group(); sk.position.set(0, -0.45, 0.04); leg.add(sk);
    sk.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.32), skate));
    for (const z of [-0.1, 0.1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8), steel); w.rotation.z = Math.PI / 2; w.position.set(0, -0.04, z); sk.add(w); }
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 8), steel); tube.rotation.x = Math.PI / 2; tube.position.set(0, 0.05, -0.19); sk.add(tube);
    skates.push(sk);
  }
  // nuage de pluie personnel
  const rain = new THREE.Group();
  for (const [x, y, z, r] of [[0, 0, 0, 0.32], [0.3, -0.04, 0.05, 0.24], [-0.3, -0.05, -0.02, 0.26], [0.05, 0.12, -0.1, 0.24]]) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), cloud); c.position.set(x, y, z); c.castShadow = true; rain.add(c);
  }
  return { wings, springs, skates, rain };
}

export class Player {
  constructor(scene, assets, kind = 'toejam') {
    this.kind = kind;
    this.m = kind === 'earl' ? buildEarl() : buildToeJam();
    scene.add(this.m.root);
    attachHero(this.m, kind);
    this.H = kind === 'earl' ? 1.7 : 1.5;
    this.effects = { rocket: 0, wings: 0, spring: 0, hitops: 0, rain: 0, love: 0 };
    this.health = 100;
    this.gear = buildGear(this.m);
    scene.add(this.gear.rain);

    // « ! » au-dessus de la tête quand le sol disparaît
    const bang = (this.bangMesh = new THREE.Group());
    const ym = new THREE.MeshBasicMaterial({ color: '#ffd23f' });
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.12), ym); a.position.y = 0.26;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), ym);
    bang.add(a, b);
    scene.add(bang);
    // ombre douce au sol pendant une chute ou un vol
    this.fallShadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ map: assets.blob, transparent: true, depthWrite: false }));
    this.fallShadow.rotation.x = -Math.PI / 2;
    scene.add(this.fallShadow);

    this.pos = new THREE.Vector3();
    this.level = 0;
    this.heading = 0; this.headingT = 0;
    this.walk = 0; this.t = 0;
    this.control = false; this.visible = true;
    this.vel = { x: 0, z: 1 };
    this.vx = 0; this.vz = 0;
    this.alt = 0; this.ground = 0;
    this.inWater = false; this.squash = 0; this.teeter = 0; this.bang = false;
    this.anim = 'idle';
    this.shadowOverride = null;
    this.eff = {};
    this.kx = 0; this.kz = 0; this.invuln = 0; this.sneaking = false;
  }

  place(level, x, z) { this.level = level; this.pos.set(x, level * GAP, z); this.ground = this.pos.y; this.alt = 0; }
  emote(name, dur) { emote(this.m, name, dur); }
  say(line, force) { return sound.say(this.kind, line, force); }
  mid() { return new THREE.Vector3(this.pos.x, this.pos.y + this.H * 0.5, this.pos.z); }
  faceDir(x, z) { this.headingT = Math.atan2(x, z); }
  // bourrade reçue : une poussée qui s'amortit (et qui peut envoyer dans le vide)
  kick(x, z) { this.kx += x; this.kz += z; }

  // mv : commande à l'écran ; yaw : angle de la caméra ; eff : pouvoirs actifs (secondes restantes).
  // Renvoie { fall } quand il quitte le sol, { elevator } quand il entre dans la cabine.
  update(dt, world, fx, mv, yaw, eff, sneak = false) {
    this.t += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.sneaking = sneak;
    // amoureux : les commandes sont inversées
    if (eff.love > 0) mv = { x: -mv.x, z: -mv.z };
    this.eff = eff;
    const L = world.levels[this.level];
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const wx = cy * mv.x + sy * mv.z, wz = -sy * mv.x + cy * mv.z;
    let moving = Math.hypot(wx, wz) > 0.15;
    const flying = eff.wings > 0, springing = eff.spring > 0;
    // altitude : vol plané avec les ailes, rebonds avec les ressorts
    if (springing) this.alt = Math.abs(Math.sin((this.t * Math.PI) / 0.55)) * 1.1;
    else this.alt += ((flying ? 1.3 + Math.sin(this.t * 3) * 0.15 : 0) - this.alt) * Math.min(1, dt * 4);
    const airborne = flying || this.alt > 0.2;

    const here = world.type(this.level, this.pos.x, this.pos.z);
    let sp = SPEED;
    if (eff.hitops > 0) sp *= 1.7;
    if (eff.rain > 0) sp *= 0.72;
    if (sneak) sp *= 0.45;
    const liquid = LIQUIDS[L.data.biome?.liquid] || LIQUIDS.water;
    if (!airborne && here === T.WATER) sp *= liquid.slow ?? 0.55;
    else if (!airborne && here === T.ROAD) sp *= 1.3;
    let dx, dz;
    const onIce = !airborne && here === T.ICE;
    if (onIce && eff.rocket <= 0) {
      // la glace : on glisse, on tourne mal, on freine encore plus mal
      const k = 1 - Math.exp(-dt * (moving ? 1.7 : 0.45));
      this.vx += (wx * sp * 1.15 - this.vx) * k; this.vz += (wz * sp * 1.15 - this.vz) * k;
      dx = this.vx * dt; dz = this.vz * dt;
      const v = Math.hypot(this.vx, this.vz);
      if (moving) this.faceDir(wx, wz);
      moving = v > 0.3;
      if (v > 1.5 && Math.random() < dt * 8) fx.sparkle(this.pos, '#e8f8ff', 1, 0.2);
    } else if (eff.rocket > 0) {
      // patins-fusées : on glisse, on freine mal, on finit souvent dans le vide
      const k = 1 - Math.exp(-dt * (moving ? 2.4 : 0.8));
      this.vx += (wx * 7.8 - this.vx) * k; this.vz += (wz * 7.8 - this.vz) * k;
      dx = this.vx * dt; dz = this.vz * dt;
      const v = Math.hypot(this.vx, this.vz);
      moving = v > 0.4;
      if (moving) { this.faceDir(this.vx, this.vz); fx.flame(this.pos, this.vx / v, this.vz / v); }
    } else {
      this.vx = wx * sp; this.vz = wz * sp;
      dx = this.vx * dt; dz = this.vz * dt;
      if (moving) this.faceDir(wx, wz);
    }
    // la bourrade s'ajoute au déplacement
    dx += this.kx * dt; dz += this.kz * dt;
    const kd = Math.exp(-5 * dt);
    this.kx *= kd; this.kz *= kd;
    if (Math.hypot(this.kx, this.kz) > 0.4) moving = true;
    let event = null;
    if (moving) {
      const l = Math.hypot(dx, dz) || 1;
      this.vel = { x: dx / l, z: dz / l };
      let nx = this.pos.x + dx, nz = this.pos.z + dz;
      if (this.level <= 0 && !airborne) {
        // tout en bas, pas d'étage pour le rattraper : on mouline au bord (sauf au-dessus du trou secret)
        const k = this.level, ok = (x, z) => world.type(k, x, z) || world.isHole(k, x, z);
        if (!ok(nx, this.pos.z) || !ok(nx, nz)) { if (this.teeter <= 0) sound.play('desequilibre'); }
        if (!ok(nx, this.pos.z)) { nx = this.pos.x; this.teeter = 0.4; this.vx = 0; }
        if (!ok(nx, nz)) { nz = this.pos.z; this.teeter = 0.4; this.vz = 0; }
      }
      if (!airborne) {
        ({ x: nx, z: nz } = world.push(this.level, nx, nz, 0.3));
        const b = L.booth;
        if (b && !b.userData.traveling) {
          const bx = b.position.x, bz = b.position.z, hw = BOOTH.W / 2 + 0.25, hd = BOOTH.D / 2 + 0.25;
          if (Math.abs(nx - bx) < hw && Math.abs(nz - bz) < hd) {
            if (Math.abs(nx - bx) < 0.5 && this.pos.z >= bz + hd - 0.05 && dz < 0) event = { elevator: true };
            else {
              const px = hw - Math.abs(nx - bx), pz = hd - Math.abs(nz - bz);
              if (px < pz) nx = bx + Math.sign(nx - bx || 1) * hw; else nz = bz + Math.sign(nz - bz || 1) * hd;
              this.vx *= 0.3; this.vz *= 0.3;
            }
          }
        }
      }
      this.walk += Math.hypot(nx - this.pos.x, nz - this.pos.z);
      // un pas toutes les 0,55 unité, au sol seulement
      if (!airborne && Math.floor(this.walk / 0.55) !== this.lastStep) { this.lastStep = Math.floor(this.walk / 0.55); sound.play(this.inWater ? 'pas_eau' : 'pas', { vary: 0.12, vol: sneak ? 0.35 : 1 }); }
      this.pos.x = nx; this.pos.z = nz;
      if (eff.hitops > 0 && Math.random() < 0.3) fx.sparkle(this.pos, '#ffe36b', 1, 0.3);
    }
    // de retour au sol : y a-t-il encore quelque chose sous les pieds ?
    const now = world.type(this.level, this.pos.x, this.pos.z);
    if (!airborne && !event && !now) {
      if (this.level > 0 || world.isHole(this.level, this.pos.x, this.pos.z)) event = { fall: true };
      else {
        const p = world.nearestLand(this.level, this.pos.x, this.pos.z);
        this.pos.x = p.x; this.pos.z = p.z; this.teeter = 0.6;
        fx.dust(this.pos, 12);
      }
    }
    const wasWater = this.inWater;
    this.inWater = now === T.WATER && !airborne;
    if (this.inWater && !wasWater) sound.play('eclaboussure');
    if (this.inWater && !wasWater) fx.splash(new THREE.Vector3(this.pos.x, L.y - 0.16, this.pos.z));
    this.rippleT = (this.rippleT || 0) - dt;
    if (this.inWater && this.rippleT <= 0) { fx.ripple(new THREE.Vector3(this.pos.x, L.y - 0.15, this.pos.z)); this.rippleT = moving ? 0.28 : 0.9; }
    const gy = L.y + (this.inWater ? -0.46 + Math.sin(this.t * 4) * 0.03 : now ? topOf(now) : 0);
    this.ground += (gy - this.ground) * Math.min(1, dt * 14);
    this.pos.y = this.ground + this.alt;
    if (springing && this.alt < 0.05 && this.lastAlt >= 0.05) sound.play('ressort', { vary: 0.1 });
    if (springing && this.alt < 0.05 && this.lastAlt >= 0.05 && now) fx.dust(new THREE.Vector3(this.pos.x, this.ground, this.pos.z), 6);
    this.lastAlt = this.alt;
    this.teeter = Math.max(0, this.teeter - dt);
    this.anim = this.teeter > 0 ? 'teeter' : flying ? 'fly' : airborne ? 'jump' : moving ? 'walk' : 'idle';
    return event;
  }

  // Remet ToeJam au sol (après une séquence).
  land() { this.alt = 0; this.ground = this.pos.y; }

  animate(dt) {
    this.t += this.control ? 0 : dt;
    // en chute ou en déséquilibre, ToeJam se tourne vers nous
    if (['fall', 'teeter', 'splat', 'getup', 'groove'].includes(this.anim) && !this.hiT) this.headingT = this.camFacing ?? this.headingT;
    this.heading += wrap(this.headingT - this.heading) * Math.min(1, dt * 14);
    poseToeJam(this.m, this.anim, this.t, this.walk, this.squash);
    poseHero(this.m, this.anim, this.t, this.walk, dt, this.eff);
    this.squash = Math.max(0, this.squash - dt * 2.2);
    // accessoires
    const e = this.eff || {}, G = this.gear;
    const blink = (v) => v > 0 && (v > 3 || Math.floor(v * 8) % 2 === 0);
    G.wings.visible = blink(e.wings);
    for (const p of G.wings.userData.sides) p.rotation.z = p.userData.s * (0.25 + Math.sin(this.t * 13) * 0.5);
    for (const s of G.springs) s.visible = blink(e.spring);
    for (const s of G.skates) s.visible = blink(e.rocket);
    G.rain.visible = e.rain > 0;
  }

  sync(fx, dt) {
    const r = this.m.root;
    r.position.copy(this.pos);
    r.rotation.y = this.heading;
    r.visible = this.visible && !(this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0);
    const so = this.shadowOverride;
    const showAlt = !so && this.alt > 0.25 && this.visible;
    this.fallShadow.visible = !!so || showAlt;
    if (so) { this.fallShadow.position.set(so.x, so.y + 0.03, so.z); this.fallShadow.scale.setScalar(so.s); }
    else if (showAlt) { this.fallShadow.position.set(this.pos.x, this.ground + 0.03, this.pos.z); this.fallShadow.scale.setScalar(Math.max(0.4, 1 - this.alt * 0.3)); }
    this.bangMesh.visible = this.bang;
    this.bangMesh.position.set(this.pos.x, this.pos.y + this.H + 0.35 + Math.abs(Math.sin(this.t * 12)) * 0.15, this.pos.z);
    const rain = this.gear.rain;
    if (rain.visible) {
      rain.position.set(this.pos.x, this.pos.y + this.H + 0.9 + Math.sin(this.t * 2) * 0.05, this.pos.z);
      fx.rain(new THREE.Vector3(rain.position.x, rain.position.y - 0.25, rain.position.z), dt);
    }
  }
}
