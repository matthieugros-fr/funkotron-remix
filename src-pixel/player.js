// ToeJam : déplacement, collisions, eau, bord du vide, animation du sprite.
import * as THREE from 'three';
import { PX, SY, SIN_P, COS_P, GAP } from './config.js';
import { FW, FH, NCOLS, NROWS, COL } from './toejam.js';
import { T } from './gen.js';
import { Builder, flatQuad, uprightQuad } from './levelmesh.js';
import { BOOTH } from './booth.js';

const SPEED = 3.1;

// Recale une position sur la grille des pixels de l'écran (axe « haut » de la caméra).
export function snapZ(y, z) {
  const u = (y * COS_P - z * SIN_P) * PX;
  return z + (u - Math.round(u)) / (SIN_P * PX);
}

export class Player {
  constructor(scene, assets) {
    const tex = (this.tex = assets.toejam);
    tex.repeat.set(FW / (FW * NCOLS), FH / (FH * NROWS));
    const H = (FH / PX) * SY;
    const geo = new THREE.PlaneGeometry(FW / PX, H);
    geo.translate(0, H / 2, 0);
    this.mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.H = H;

    const decorMat = new THREE.MeshBasicMaterial({ map: assets.decor, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const sb = new Builder(); flatQuad(sb, 'blobS', 0, 0, 0);
    this.shadow = new THREE.Mesh(sb.geometry(), decorMat);
    scene.add(this.shadow);
    const bb = new Builder(); uprightQuad(bb, 'bang', 0, 0);
    this.bangMesh = new THREE.Mesh(bb.geometry(), new THREE.MeshBasicMaterial({ map: assets.decor, alphaTest: 0.5 }));
    scene.add(this.bangMesh);

    this.pos = new THREE.Vector3();
    this.level = 0;
    this.row = 0; this.mirror = false;
    this.walk = 0; this.t = 0;
    this.control = false; this.visible = true;
    this.vel = { x: 0, z: 1 };
    this.inWater = false; this.squash = 0; this.teeter = 0; this.bang = false;
    this.anim = null;                    // pose imposée par une séquence : 'fall', 'teeter', 'splat', 'getup', 'walk', 'idle'
    this.shadowOverride = null;          // { x, y, z, s } pendant une chute
    this.setFrame(0, 0);
  }

  place(level, x, z) { this.level = level; this.pos.set(x, level * GAP, z); }
  mid() { return new THREE.Vector3(this.pos.x, this.pos.y + this.H * 0.45, this.pos.z); }

  face(mx, mz) {
    if (Math.abs(mx) > Math.abs(mz)) { this.row = 2; this.mirror = mx > 0; }
    else { this.row = mz < 0 ? 1 : 0; this.mirror = false; }
  }

  setFrame(row, col, mirror = false) {
    const sx = 1 / NCOLS, sy = 1 / NROWS;
    this.tex.repeat.set(mirror ? -sx : sx, sy);
    this.tex.offset.set(mirror ? (col + 1) * sx : col * sx, 1 - (row + 1) * sy);
  }

  // Renvoie un événement : { fall } quand il quitte le sol, { elevator } quand il entre dans la cabine.
  update(dt, world, fx, mv) {
    this.t += dt;
    const L = world.levels[this.level];
    const moving = Math.hypot(mv.x, mv.z) > 0.15;
    const here = world.type(this.level, this.pos.x, this.pos.z);
    let sp = SPEED * (here === T.WATER ? 0.55 : here === T.ROAD ? 1.3 : 1);
    let event = null;
    if (moving) {
      this.vel = { x: mv.x, z: mv.z };
      this.face(mv.x, mv.z);
      let nx = this.pos.x + mv.x * sp * dt, nz = this.pos.z + mv.z * sp * dt;
      if (this.level === 0) {
        // tout en bas, pas d'étage pour vous rattraper : ToeJam mouline au bord
        if (!world.type(0, nx, this.pos.z)) { nx = this.pos.x; this.teeter = 0.4; }
        if (!world.type(0, nx, nz)) { nz = this.pos.z; this.teeter = 0.4; }
      }
      ({ x: nx, z: nz } = world.push(this.level, nx, nz, 0.28));
      const b = L.booth;
      if (b && !b.userData.traveling) {
        const bx = b.position.x, bz = b.position.z, hw = BOOTH.W / 2 + 0.22, hd = BOOTH.D / 2 + 0.22;
        if (Math.abs(nx - bx) < hw && Math.abs(nz - bz) < hd) {
          if (Math.abs(nx - bx) < 0.5 && this.pos.z >= bz + hd - 0.05 && mv.z < -0.3) event = { elevator: true };
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
    if (this.inWater && !wasWater) fx.splash(this.pos);
    const gy = L.y + (this.inWater ? -0.32 + Math.sin(this.t * 4) * 0.03 : 0);
    this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 14);
    this.teeter = Math.max(0, this.teeter - dt);
    this.anim = this.teeter > 0 ? 'teeter' : moving ? 'walk' : 'idle';
    return event;
  }

  animate(dt) {
    let row = this.row, col, mirror = this.mirror;
    switch (this.anim) {
      case 'walk': col = COL.walk + (Math.floor(this.walk * 3.4) % 6); break;
      case 'teeter': row = 0; mirror = false; col = Math.floor(this.t * 10) % 2 ? COL.teeter1 : COL.teeter0; break;
      case 'fall': row = 0; mirror = false; col = Math.floor(this.t * 14) % 2 ? COL.fall1 : COL.fall0; break;
      case 'splat': row = 0; mirror = false; col = COL.splat; break;
      case 'getup': row = 0; mirror = false; col = COL.getup; break;
      default: {
        const blink = this.t % 3.1 < 0.12;
        col = blink ? COL.blink : Math.floor(this.t * 1.6) % 2 ? COL.idle1 : COL.idle0;
      }
    }
    this.setFrame(row, col, mirror);
    this.squash = Math.max(0, this.squash - dt * 2.5);
  }

  sync() {
    const x = Math.round(this.pos.x * PX) / PX, z = snapZ(this.pos.y, this.pos.z);
    this.mesh.position.set(x, this.pos.y, z);
    const s = this.squash;
    this.mesh.scale.set(1 + 0.35 * s, 1 - 0.4 * s, 1);
    this.mesh.visible = this.visible;
    const so = this.shadowOverride;
    if (so) { this.shadow.position.set(so.x, so.y + 0.02, so.z); this.shadow.scale.setScalar(so.s); }
    else { this.shadow.position.set(x, this.pos.y + (this.inWater ? 0.2 : 0.02), z - 0.04); this.shadow.scale.setScalar(this.inWater ? 0 : 1); }
    this.shadow.visible = this.visible || !!so;
    this.bangMesh.visible = this.bang;
    this.bangMesh.position.set(x, this.pos.y + this.H + 0.15 + Math.abs(Math.sin(this.t * 12)) * 0.15, z);
  }
}
