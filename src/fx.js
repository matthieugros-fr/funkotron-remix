// Particules en gros pixels (poussière, éclaboussures) et traînées de vitesse pendant les chutes.
import * as THREE from 'three';

const HIDE = -1e4;

// Ambiances : combien par seconde, de quelles couleurs, et comment elles naissent.
const AMBIENT = {
  snow: { rate: 22, cols: ['#ffffff', '#e8f4ff'], spawn: (f, x, y, z, c) => f.spawn(x, y + 5 + Math.random() * 3, z, 0.4, -1.1, 0.2, 6, c, 0, 0) },
  leaves: { rate: 6, cols: ['#e8742a', '#d8402a', '#f0b030'], spawn: (f, x, y, z, c) => f.spawn(x, y + 4 + Math.random() * 2, z, 0.6 + Math.random() * 0.4, -0.7, (Math.random() - 0.5) * 0.6, 6, c, 0, 0) },
  sand: { rate: 18, cols: ['#e8c890', '#d0a870', '#f4dcac'], spawn: (f, x, y, z, c) => f.spawn(x - 6, y + 0.2 + Math.random() * 1.6, z, 5 + Math.random() * 2, 0.2, 0.6, 1.6, c, 0, 0) },
  fireflies: { rate: 5, cols: ['#d8ff6a', '#ffe36b'], spawn: (f, x, y, z, c) => f.spawn(x, y + 0.4 + Math.random() * 1.2, z, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6, 3.5, c, 0, 0) },
  sparkles: { rate: 6, cols: ['#ffffff', '#ff9ad8', '#9af0ff'], spawn: (f, x, y, z, c) => f.spawn(x, y + 0.5 + Math.random() * 2.5, z, 0, 0.25, 0, 2, c, 0, 0) },
  spores: { rate: 8, cols: ['#3affe0', '#c8a0ff', '#ff9ad8'], spawn: (f, x, y, z, c) => f.spawn(x, y + 0.1, z, (Math.random() - 0.5) * 0.3, 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3, 4.5, c, 0, 0) },
  embers: { rate: 12, cols: ['#ff6a1a', '#ffb03a', '#ffd23f'], spawn: (f, x, y, z, c) => f.spawn(x, y + 0.1, z, (Math.random() - 0.5) * 0.6, 1.2 + Math.random(), (Math.random() - 0.5) * 0.6, 2.2, c, -0.3, 0.5) },
  butterflies: { rate: 1.5, cols: ['#ffe36b', '#ff8ad8', '#8ad8ff', '#ffffff'], spawn: (f, x, y, z, c) => f.spawn(x, y + 0.5 + Math.random(), z, (Math.random() - 0.5) * 1.2, 0.15, (Math.random() - 0.5) * 1.2, 3, c, 0, 0.2) },
};

export class FX {
  constructor(scene) {
    this.N = 400;
    this.pos = new Float32Array(this.N * 3); this.col = new Float32Array(this.N * 3);
    this.vel = new Float32Array(this.N * 3); this.life = new Float32Array(this.N); this.grav = new Float32Array(this.N); this.drag = new Float32Array(this.N).fill(2.5);
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

  spawn(x, y, z, vx, vy, vz, life, color, grav = 9, drag = 2.5) {
    const i = this.next; this.next = (this.next + 1) % this.N;
    this.drag[i] = drag;
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

  coins(p, n = 12) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
      this.spawn(p.x, p.y + 1, p.z, Math.cos(a) * sp, 4 + Math.random() * 3, Math.sin(a) * sp, 0.9, k % 2 ? '#7fd88a' : '#ffe36b', 12);
    }
  }

  sparkle(p, color = '#ffe680', n = 6, spread = 0.5) {
    for (let k = 0; k < n; k++) {
      this.spawn(p.x + (Math.random() - 0.5) * spread, p.y + Math.random() * spread, p.z + (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * 0.6, 0.8 + Math.random(), (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.3, color, 0);
    }
  }

  flame(p, dx, dz) {
    for (let k = 0; k < 2; k++) {
      this.spawn(p.x + (Math.random() - 0.5) * 0.2, p.y + 0.08, p.z + (Math.random() - 0.5) * 0.2,
        -dx * 2 + (Math.random() - 0.5), 0.6 + Math.random() * 0.6, -dz * 2 + (Math.random() - 0.5), 0.3, k ? '#ffd23f' : '#ff6a2a', -2);
    }
  }

  // Gouttes sous le nuage de pluie : de petits traits qui descendent.
  rain(c, dt) {
    this.racc = (this.racc || 0) + dt * 40;
    while (this.racc > 1) {
      this.racc--;
      const i = this.lnext; this.lnext = (this.lnext + 1) % this.M;
      const x = c.x + (Math.random() - 0.5) * 0.9, z = c.z + (Math.random() - 0.5) * 0.9, y = c.y - Math.random() * 1.6;
      this.lpos.set([x, y, z, x, y + 0.25, z], i * 6);
      this.llife[i] = 0.08;
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

  // Particules d'ambiance du biome autour d'un point suivi par la caméra.
  ambient(kind, c, dt) {
    const A = AMBIENT[kind];
    if (!A) return;
    this.amb = (this.amb || 0) + dt * A.rate;
    while (this.amb >= 1) {
      this.amb--;
      const x = c.x + (Math.random() - 0.5) * 18, z = c.z + (Math.random() - 0.5) * 18;
      A.spawn(this, x, c.y, z, A.cols[Math.floor(Math.random() * A.cols.length)]);
    }
  }

  update(dt) {
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = HIDE; continue; }
      const k = i * 3, drag = Math.exp(-this.drag[i] * dt);
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
