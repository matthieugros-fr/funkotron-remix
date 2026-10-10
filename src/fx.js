// Particules en gros pixels (poussière, éclaboussures) et traînées de vitesse pendant les chutes.
import * as THREE from 'three';

const HIDE = -1e4;

export class FX {
  constructor(scene) {
    this.N = 400;
    this.pos = new Float32Array(this.N * 3); this.col = new Float32Array(this.N * 3);
    this.vel = new Float32Array(this.N * 3); this.life = new Float32Array(this.N); this.grav = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) this.pos[i * 3 + 1] = HIDE;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.next = 0;

    this.M = 90;
    this.lpos = new Float32Array(this.M * 6); this.llife = new Float32Array(this.M);
    for (let i = 0; i < this.M; i++) { this.lpos[i * 6 + 1] = HIDE; this.lpos[i * 6 + 4] = HIDE; }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(this.lpos, 3));
    this.lineMat = new THREE.LineBasicMaterial({ color: '#e9e4ff' });
    this.lines = new THREE.LineSegments(lg, this.lineMat);
    this.lines.frustumCulled = false;
    scene.add(this.lines);
    this.lnext = 0; this.acc = 0;
    this.tmp = new THREE.Color();
  }

  spawn(x, y, z, vx, vy, vz, life, color, grav = 9) {
    const i = this.next; this.next = (this.next + 1) % this.N;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
    this.tmp.set(color); this.col.set([this.tmp.r, this.tmp.g, this.tmp.b], i * 3);
    this.life[i] = life; this.grav[i] = grav;
  }

  dust(p, n = 16, colors = ['#f6eccf', '#d8c49a', '#ffffff']) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.3, sp = 2 + Math.random() * 2;
      this.spawn(p.x + Math.cos(a) * 0.3, p.y + 0.05, p.z + Math.sin(a) * 0.3, Math.cos(a) * sp, 1 + Math.random() * 1.8, Math.sin(a) * sp,
        0.45 + Math.random() * 0.35, colors[k % colors.length], 7);
    }
  }

  splash(p) {
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.2;
      this.spawn(p.x, p.y + 0.1, p.z, Math.cos(a) * sp, 2.5 + Math.random() * 2, Math.sin(a) * sp, 0.5, k % 3 ? '#9fd2ff' : '#ffffff', 14);
    }
  }

  // Ronds dans l'eau autour des pieds.
  ripple(p) {
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      this.spawn(p.x + Math.cos(a) * 0.25, p.y, p.z + Math.sin(a) * 0.25, Math.cos(a) * 1.3, 0, Math.sin(a) * 1.3, 0.45, '#cfeaff', 0);
    }
  }

  // Traînées verticales autour d'un point qui tombe ou qui monte.
  streaks(c, dt, rate = 50) {
    this.acc += dt * rate;
    while (this.acc > 1) {
      this.acc--;
      const i = this.lnext; this.lnext = (this.lnext + 1) % this.M;
      const x = c.x + (Math.random() - 0.5) * 7, z = c.z + (Math.random() - 0.5) * 3, y = c.y + (Math.random() - 0.5) * 7;
      const L = 1 + Math.random() * 2;
      this.lpos.set([x, y, z, x, y + L, z], i * 6);
      this.llife[i] = 0.18 + Math.random() * 0.1;
    }
  }

  update(dt) {
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = HIDE; continue; }
      const k = i * 3, drag = Math.exp(-2.5 * dt);
      this.vel[k] *= drag; this.vel[k + 2] *= drag; this.vel[k + 1] -= this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    for (let i = 0; i < this.M; i++) {
      if (this.llife[i] <= 0) continue;
      this.llife[i] -= dt;
      if (this.llife[i] <= 0) { this.lpos[i * 6 + 1] = HIDE; this.lpos[i * 6 + 4] = HIDE; }
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}
