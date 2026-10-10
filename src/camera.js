// Caméra orbitale : A / E (Q / E en QWERTY), glisser à la souris ou stick droit pour tourner,
// molette pour zoomer. Les valeurs visées sont rejointes en douceur.
import { VIEW_H } from './config.js';
import { clamp } from './util.js';

export class CameraControl {
  constructor(canvas, input) {
    this.input = input;
    this.yaw = this.yawT = 0.55;
    this.view = this.viewT = VIEW_H;
    let px = null;
    canvas.addEventListener('pointerdown', (e) => { px = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (px === null) return; this.yawT -= (e.clientX - px) * 0.009; px = e.clientX; });
    const up = () => { px = null; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.viewT = clamp(this.viewT * (1 + e.deltaY * 0.0012), 12, 30); }, { passive: false });
  }

  update(dt, enabled = true) {
    if (enabled) {
      const i = this.input;
      if (i.isDown('KeyQ')) this.yawT += 1.9 * dt;
      if (i.isDown('KeyE')) this.yawT -= 1.9 * dt;
      const lx = i.look();
      if (Math.abs(lx) > 0.2) this.yawT -= lx * 2.2 * dt;
    }
    this.yaw += (this.yawT - this.yaw) * (1 - Math.exp(-10 * dt));
    this.view += (this.viewT - this.view) * (1 - Math.exp(-8 * dt));
  }
}
