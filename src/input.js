// Clavier (ZQSD sur AZERTY, WASD sur QWERTY, flèches) et manette.
const down = new Set(), pressed = new Set();
const BLOCK = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
addEventListener('keydown', (e) => {
  if (!e.repeat) pressed.add(e.code);
  down.add(e.code);
  if (BLOCK.includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => down.delete(e.code));
addEventListener('blur', () => down.clear());

let padPrev = [];
function pad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p && p.connected) return p;
  return null;
}

export const input = {
  move() {
    let x = 0, z = 0;
    if (down.has('ArrowLeft') || down.has('KeyA')) x -= 1;
    if (down.has('ArrowRight') || down.has('KeyD')) x += 1;
    if (down.has('ArrowUp') || down.has('KeyW')) z -= 1;
    if (down.has('ArrowDown') || down.has('KeyS')) z += 1;
    const p = pad();
    if (p) {
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.25) { x += ax; z += ay; }
      if (p.buttons[12]?.pressed) z -= 1;
      if (p.buttons[13]?.pressed) z += 1;
      if (p.buttons[14]?.pressed) x -= 1;
      if (p.buttons[15]?.pressed) x += 1;
    }
    const l = Math.hypot(x, z);
    if (l > 1) { x /= l; z /= l; }
    return { x, z };
  },
  isDown(code) { return down.has(code); },
  look() { const p = pad(); return p ? p.axes[2] || 0 : 0; },
  hit(...codes) {
    for (const c of codes) if (pressed.has(c)) { pressed.delete(c); return true; }
    return false;
  },
  start() {
    const p = pad();
    const padHit = p && [0, 9].some((b) => p.buttons[b]?.pressed && !padPrev[b]);
    return this.hit('Enter', 'NumpadEnter', 'Space') || padHit;
  },
  endFrame() {
    pressed.clear();
    const p = pad();
    padPrev = p ? p.buttons.map((b) => b.pressed) : [];
  },
};
