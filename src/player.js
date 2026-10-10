// ToeJam : déplacement relatif à la caméra, collisions, eau, bord du vide, animation du modèle 3D.
import * as THREE from 'three';
import { GAP } from './config.js';
import { T } from './gen.js';
import { topOf } from './terrain3d.js';
import { BOOTH } from './booth.js';
import { buildToeJam, poseToeJam } from './toejam3d.js';

const SPEED = 3.1;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Player {
  constructor(scene, assets) {
    this.m = buildToeJam();
    scene.add(this.m.root);
    this.H = 1.5;

    // « ! » au-dessus de la tête quand le sol disparaît
    const bang = (this.bangMesh = new THREE.Group());
    const ym = new THREE.MeshBasicMaterial({ color: '#ffd23f' });
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.12), ym); a.position.y = 0.26;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), ym);
    bang.add(a, b);
    scene.add(bang);
    // ombre douce sur le point d'atterrissage pendant une chute
    this.fallShadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ map: assets.blob, transparent: true, depthWrite: false }));
    this.fallShadow.rotation.x = -Math.PI / 2;
    scene.add(this.fallShadow);

    this.pos = new THREE.Vector3();
    this.level = 0;
    this.heading = 0; this.headingT = 0;
    this.walk = 0; this.t = 0;
    this.control = false; this.visible = true;
    this.vel = { x: 0, z: 1 };
    this.inWater = false; this.squash = 0; this.teeter = 0; this.bang = false;
    this.anim = 'idle';
    this.shadowOverride = null;
  }

  place(level, x, z) { this.level = level; this.pos.set(x, level * GAP, z); }
  mid() { return new THREE.Vector3(this.pos.x, this.pos.y + this.H * 0.5, this.pos.z); }
  faceDir(x, z) { this.headingT = Math.atan2(x, z); }

  // mv : commande à l'écran ; yaw : angle de la caméra. Renvoie { fall } ou { elevator }.
  update(dt, world, fx, mv, yaw) {
    this.t += dt;
    const L = world.levels[this.level];
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const wx = cy * mv.x + sy * mv.z, wz = -sy * mv.x + cy * mv.z;
    const moving = Math.hypot(wx, wz) > 0.15;
    const here = world.type(this.level, this.pos.x, this.pos.z);
    const sp = SPEED * (here === T.WATER ? 0.55 : here === T.ROAD ? 1.3 : 1);
    let event = null;
    if (moving) {
      this.vel = { x: wx, z: wz };
      this.faceDir(wx, wz);
      let nx = this.pos.x + wx * sp * dt, nz = this.pos.z + wz * sp * dt;
      if (this.level === 0) {
        // tout en bas, pas d'étage pour le rattraper : ToeJam mouline au bord
        if (!world.type(0, nx, this.pos.z)) { nx = this.pos.x; this.teeter = 0.4; }
        if (!world.type(0, nx, nz)) { nz = this.pos.z; this.teeter = 0.4; }
      }
      ({ x: nx, z: nz } = world.push(this.level, nx, nz, 0.3));
      const b = L.booth;
      if (b && !b.userData.traveling) {
        const bx = b.position.x, bz = b.position.z, hw = BOOTH.W / 2 + 0.25, hd = BOOTH.D / 2 + 0.25;
        if (Math.abs(nx - bx) < hw && Math.abs(nz - bz) < hd) {
          if (Math.abs(nx - bx) < 0.5 && this.pos.z >= bz + hd - 0.05 && wz < -0.3) event = { elevator: true };
          else {
            const px = hw - Math.abs(nx - bx), pz = hd - Math.abs(nz - bz);
            if (px < pz) nx = bx + Math.sign(nx - bx || 1) * hw; else nz = bz + Math.sign(nz - bz || 1) * hd;
          }
        }
      }
      this.walk += sp * dt;
      this.pos.x = nx; this.pos.z = nz;
      if (!event && this.level > 0 && !world.type(this.level, nx, nz)) event = { fall: true };
    }
    const now = world.type(this.level, this.pos.x, this.pos.z);
    const wasWater = this.inWater;
    this.inWater = now === T.WATER;
    if (this.inWater && !wasWater) fx.splash(new THREE.Vector3(this.pos.x, L.y - 0.16, this.pos.z));
    this.rippleT = (this.rippleT || 0) - dt;
    if (this.inWater && this.rippleT <= 0) { fx.ripple(new THREE.Vector3(this.pos.x, L.y - 0.15, this.pos.z)); this.rippleT = moving ? 0.28 : 0.9; }
    const gy = L.y + (this.inWater ? -0.46 + Math.sin(this.t * 4) * 0.03 : topOf(now));
    this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 14);
    this.teeter = Math.max(0, this.teeter - dt);
    this.anim = this.teeter > 0 ? 'teeter' : moving ? 'walk' : 'idle';
    return event;
  }

  animate(dt) {
    this.t += this.control ? 0 : dt;
    // en chute ou en déséquilibre, ToeJam se tourne vers nous
    if (['fall', 'teeter', 'splat', 'getup'].includes(this.anim)) this.headingT = this.camFacing ?? this.headingT;
    this.heading += wrap(this.headingT - this.heading) * Math.min(1, dt * 14);
    poseToeJam(this.m, this.anim, this.t, this.walk, this.squash);
    this.squash = Math.max(0, this.squash - dt * 2.2);
  }

  sync() {
    const r = this.m.root;
    r.position.copy(this.pos);
    r.rotation.y = this.heading;
    r.visible = this.visible;
    const so = this.shadowOverride;
    this.fallShadow.visible = !!so;
    if (so) { this.fallShadow.position.set(so.x, so.y + 0.03, so.z); this.fallShadow.scale.setScalar(so.s); }
    this.bangMesh.visible = this.bang;
    this.bangMesh.position.set(this.pos.x, this.pos.y + this.H + 0.35 + Math.abs(Math.sin(this.t * 12)) * 0.15, this.pos.z);
  }
}
