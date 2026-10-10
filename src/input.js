// Clavier (ZQSD sur AZERTY, WASD sur QWERTY, flèches) et manette.
const down = new Set(), pressed = new Set();
const BLOCK = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
// dernier contact avec les commandes (clavier, souris, manette) : au bout d'un moment, le duo se met à danser
let lastTouch = performance.now();
const touch = () => { lastTouch = performance.now(); };
addEventListener('pointerdown', touch);
addEventListener('wheel', touch);
addEventListener('keydown', (e) => {
  touch();
  if (!e.repeat) pressed.add(e.code);
  down.add(e.code);
  if (BLOCK.includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => down.delete(e.code));
addEventListener('blur', () => down.clear());

let padPrev = [];
function pads() {
  const all = navigator.getGamepads ? navigator.getGamepads() : [];
  return [...all].filter((p) => p && p.connected);
}
function pad(i = 0) { return pads()[i] || null; }
let padPrev2 = [];

// Touches de chaque joueur en coopération (en solo, tout pilote ToeJam).
export const KEYS = {
  0: { up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'] },
  1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'] },
  2: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'] },
};

export const input = {
  // who : 0 = solo, 1 = ToeJam en coop, 2 = Earl en coop
  move(who = 0) {
    let x = 0, z = 0;
    const k = KEYS[who], any = (codes) => codes.some((c) => down.has(c));
    if (any(k.left)) x -= 1;
    if (any(k.right)) x += 1;
    if (any(k.up)) z -= 1;
    if (any(k.down)) z += 1;
    const p = pad(who === 2 ? 1 : 0);
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
  padHit(b, i = 0) { const p = pad(i), prev = i ? padPrev2 : padPrev; return !!(p && p.buttons[b]?.pressed && !prev[b]); },
  start() {
    const p = pad();
    const padHit = p && [0, 9].some((b) => p.buttons[b]?.pressed && !padPrev[b]);
    return this.hit('Enter', 'NumpadEnter', 'Space') || padHit;
  },
  // secondes depuis le dernier contact
  idle() { return (performance.now() - lastTouch) / 1000; },
  forceIdle(s) { lastTouch = performance.now() - s * 1000; },
  endFrame() {
    pressed.clear();
    const p = pad(0), q = pad(1);
    for (const x of [p, q]) if (x && (x.buttons.some((b) => b.pressed) || x.axes.some((a) => Math.abs(a) > 0.3))) touch();
    padPrev = p ? p.buttons.map((b) => b.pressed) : [];
    padPrev2 = q ? q.buttons.map((b) => b.pressed) : [];
  },
};
