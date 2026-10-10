import './setup.js';
import * as THREE from 'three';
import { GAP, LEVELS } from './config.js';
import { Pipeline } from './render.js';
import { CameraControl } from './camera.js';
import { makeAssets } from './assets.js';
import { World } from './world.js';
import { Player } from './player.js';
import { FX } from './fx.js';
import { Hud } from './hud.js';
import { input } from './input.js';
import { cellX } from './gen.js';
import { PRESENTS, PRESENT, PIECES } from './catalog.js';
import { Bag, openPresent } from './presents.js';
import { Tomatoes, Delivery } from './projectiles.js';
import { FallSeq, ElevatorSeq, DoorSeq, BummerSeq, levelTitle } from './sequences.js';
import { easeInCubic, easeOutBack } from './util.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FIXED = (params.get('graine') || 'FUNK91').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6) || 'FUNK91';
const codeToSeed = (code) => (parseInt(code, 36) % 2147483647) || 1991;
const randomCode = () => Array.from({ length: 6 }, () => '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 34)]).join('');

const pipe = new Pipeline(document.getElementById('game'), document.getElementById('hud'));
const scene = new THREE.Scene();
const assets = makeAssets();
const player = new Player(scene, assets);
const fx = new FX(scene);
const hud = new Hud(document.getElementById('hud'));
const cam = new CameraControl(document.getElementById('game'), input);
const tomatoes = new Tomatoes(scene);

const g = {
  state: 'title', stateT: 0, t: 0, menuSel: 0,
  scene, player, fx, hud, pipe, cam,
  seq: null, ambient: [], menu: null, bagSel: 0, shopSel: 0, shop: [], prompt: null,
  focus: new THREE.Vector3(), holeR: 1, hole: 1, shake: 0, md: false,
};

function setState(s) { g.state = s; g.stateT = 0; }

g.iris = (v, r) => {
  if (!v) { pipe.blitU.uIris.value.z = -1; return; }
  const p = pipe.project(v);
  pipe.blitU.uIris.value.set(p.x / pipe.ss, p.y / pipe.ss, r);
};

// Nouvelle partie : nouveau monde (même graine = même monde), compteurs à zéro.
function newGame(code) {
  if (g.world) g.world.dispose();
  g.seedCode = code;
  const seed = codeToSeed(code);
  g.bag = new Bag(seed + 5);
  g.world = new World(scene, seed, assets, g.bag);
  const s = g.world.levels[0].data.start;
  player.place(0, cellX(s.i), cellX(s.j));
  Object.assign(player, { visible: true, control: false, anim: 'idle', bang: false, shadowOverride: null, vx: 0, vz: 0 });
  g.effects = { rocket: 0, wings: 0, spring: 0, hitops: 0, rain: 0 };
  Object.assign(g, { tomatoes: 0, bucks: 0, lives: 3, pieces: new Set(), seq: null, ambient: [], menu: null, prompt: null, cardShown: false, lastLevel: 0 });
  tomatoes.clear();
  g.focus.copy(player.mid());
}

g.loseLife = () => {
  g.lives -= 1;
  if (g.lives <= 0) {
    player.control = false; player.anim = 'splat'; player.squash = 1;
    setState('over');
  } else g.seq = new BummerSeq(g);
};
g.teleport = () => { g.seq = new DoorSeq(g); };

function openShop() {
  const pool = PRESENTS.filter((p) => p.price);
  g.shop = [];
  while (g.shop.length < 3) {
    const p = pool[Math.floor(Math.random() * pool.length)].id;
    if (!g.shop.includes(p)) g.shop.push(p);
  }
  g.shopSel = 0;
  g.menu = 'shop';
}

function onPickup(p) {
  const pos = new THREE.Vector3(p.item.x, player.pos.y, p.item.z);
  if (p.kind === 'present') {
    g.bag.add(p.item.type);
    fx.sparkle(pos, '#ff8ad8', 10, 0.6);
    hud.toast(`UN CADEAU : ${g.bag.label(p.item.type)}`);
  } else if (p.kind === 'buck') {
    g.bucks += 1;
    fx.coins(pos, 4);
  } else if (p.kind === 'piece') {
    g.pieces.add(p.item.index);
    const n = g.pieces.size;
    hud.showCard(`MORCEAU ${n}/10`, n === 10 ? 'VAISSEAU COMPLET ! MONTE TOUT EN HAUT.' : PIECES[p.item.index]);
    fx.sparkle(pos, '#ffe680', 30, 1.2);
    g.shake = 2;
  }
}

function menuInput() {
  const up = input.hit('ArrowUp', 'KeyW'), down = input.hit('ArrowDown', 'KeyS');
  const close = input.hit('Escape', 'Backspace') || input.padHit(1);
  const ok = input.hit('Space', 'Enter', 'NumpadEnter') || input.padHit(0);
  if (g.menu === 'map') { if (close || ok || input.hit('KeyC') || input.padHit(3)) g.menu = null; return; }
  if (g.menu === 'bag') {
    const list = g.bag.list(), n = list.length;
    if (close || !n) { if (close || ok) g.menu = null; return; }
    if (up) g.bagSel = (g.bagSel - 1 + n) % n;
    if (down) g.bagSel = (g.bagSel + 1) % n;
    g.bagSel = Math.min(g.bagSel, n - 1);
    if (ok) { g.menu = null; openPresent(g, list[g.bagSel].type); }
    return;
  }
  if (g.menu === 'shop') {
    const n = g.shop.length;
    if (close) { g.menu = null; return; }
    if (up) g.shopSel = (g.shopSel - 1 + n) % n;
    if (down) g.shopSel = (g.shopSel + 1) % n;
    if (ok) {
      const t = g.shop[g.shopSel], price = PRESENT[t].price;
      if (g.bucks < price) { hud.toast('PAS ASSEZ DE BILLETS.'); return; }
      g.bucks -= price;
      g.menu = null;
      g.ambient.push(new Delivery(g, t));
      hud.toast('COMMANDE PASSÉE. LIVRAISON PAR LES AIRS.');
    }
  }
}

function goLevel(k) {
  k = Math.max(0, Math.min(LEVELS - 1, k));
  const s = g.world.levels[k].data.start;
  player.place(k, cellX(s.i), cellX(s.j));
  g.focus.copy(player.mid());
  hud.showCard(levelTitle(k));
}

function debugKeys() {
  for (let k = 0; k < 9; k++) if (input.hit(`Digit${k + 1}`)) goLevel(k);
  if (input.hit('PageUp')) goLevel(player.level + 1);
  if (input.hit('PageDown')) goLevel(player.level - 1);
  if (input.hit('KeyG') && player.level > 0 && !g.seq) g.seq = new FallSeq(g);
  if (input.hit('KeyT')) {
    const b = g.world.boothPos(player.level);
    if (b) { player.pos.x = b.x; player.pos.z = b.z + 1.5; }
  }
  if (input.hit('KeyK')) { g.md = !g.md; pipe.blitU.uLevels.value = g.md ? 8 : 40; }
  if (input.hit('KeyP')) for (const p of PRESENTS) g.bag.add(p.id);
  if (input.hit('KeyO')) g.bucks += 10;
  if (input.hit('KeyY')) g.world.levels[player.level].data.seen.fill(1);
}

// Une image de jeu : renvoie le point que la caméra doit suivre (ou null pour ToeJam).
function playStep(dt, mv) {
  if (g.menu) { menuInput(); return null; }
  g.prompt = null;
  for (const k in g.effects) g.effects[k] = Math.max(0, g.effects[k] - dt);
  if (g.seq) {
    if (g.seq.update(dt)) g.seq = null;
    else return g.seq.focus();
    return null;
  }
  if (!player.control) return null;
  const ev = player.update(dt, g.world, fx, mv, cam.yaw, g.effects);
  if (ev?.fall) { g.seq = new FallSeq(g); return null; }
  if (ev?.elevator) { g.seq = new ElevatorSeq(g); return null; }
  for (const p of g.world.collect(player.level, player.pos)) onPickup(p);
  g.world.reveal(player.level, player.pos.x, player.pos.z);
  const mb = g.world.mailboxNear(player.level, player.pos);
  g.prompt = mb ? 'ESPACE : COMMANDER UN CADEAU' : null;
  if (input.hit('Space', 'Enter', 'NumpadEnter') || input.padHit(0)) { if (mb) openShop(); else { g.menu = 'bag'; g.bagSel = 0; } }
  if (input.hit('KeyC') || input.padHit(3)) g.menu = 'map';
  if ((input.hit('KeyF') || input.padHit(2)) && g.tomatoes > 0) { g.tomatoes--; tomatoes.throw(player); }
  if (player.level !== g.lastLevel) {
    g.lastLevel = player.level;
    if (player.level === LEVELS - 1) {
      const miss = 10 - g.pieces.size;
      hud.toast(miss ? `IL MANQUE ${miss} MORCEAU${miss > 1 ? 'X' : ''} DU VAISSEAU.` : 'VAISSEAU COMPLET. LA SUITE ARRIVE BIENTÔT.');
    }
  }
  return null;
}

function step(dt) {
  g.t += dt; g.stateT += dt;
  const mv = input.move();
  if (DEBUG) debugKeys();
  if (input.hit('KeyL')) hud.toast(pipe.setMode(pipe.mode + 1));

  let target = player.mid();
  if (g.state === 'title') {
    // la caméra flâne au-dessus du premier étage
    const s = g.world.levels[0].data.start;
    target = new THREE.Vector3(cellX(s.i) + Math.sin(g.t * 0.13) * 4, 0.6, cellX(s.j) + Math.sin(g.t * 0.09) * 3);
    player.anim = 'idle';
    cam.yawT += dt * 0.12;
    if (input.hit('ArrowUp', 'KeyW', 'ArrowDown', 'KeyS')) g.menuSel = 1 - g.menuSel;
    if (input.start()) {
      const code = g.menuSel === 0 ? FIXED : randomCode();
      if (code !== g.seedCode) newGame(code);
      setState('intro');
    }
  } else if (g.state === 'intro') {
    // la caméra rejoint ToeJam, l'iris se referme sur lui, puis se rouvre
    const T = g.stateT;
    if (T < 0.6) target = g.focus.clone().lerp(player.mid(), Math.min(1, dt * 6));
    if (T >= 0.6 && T < 1.1) g.iris(player.mid(), Math.max(0, (1 - easeInCubic((T - 0.6) / 0.5)) * pipe.TW));
    else if (T >= 1.1 && T < 1.35) g.iris(player.mid(), 0);
    else if (T >= 1.35 && T < 2.1) {
      if (!g.cardShown) { g.cardShown = true; hud.showCard(levelTitle(0)); hud.hint = 10; }
      g.iris(player.mid(), easeOutBack((T - 1.35) / 0.75) * pipe.TW * 0.75);
    } else if (T >= 2.1) {
      g.iris(null);
      player.control = true;
      setState('play');
    }
  } else if (g.state === 'over') {
    if (g.stateT > 1.5 && input.start()) { newGame(g.seedCode); setState('intro'); }
  } else {
    target = playStep(dt, mv) || target;
  }
  if (!g.menu) g.ambient = g.ambient.filter((a) => !a.update(dt));
  tomatoes.update(dt, g.world, fx);

  // caméra : suit vite à l'horizontale, avec un peu de retard à la verticale pendant les séquences
  const kH = g.seq ? 7 : 9, kV = g.seq ? 4.5 : 9;
  g.focus.x += (target.x - g.focus.x) * (1 - Math.exp(-kH * dt));
  g.focus.z += (target.z - g.focus.z) * (1 - Math.exp(-kH * dt));
  g.focus.y += (target.y - g.focus.y) * (1 - Math.exp(-kV * dt));
  g.shake *= Math.exp(-dt * 7);
  const amp = g.shake > 0.4 ? g.shake : 0;
  const shake = { x: Math.round((Math.random() * 2 - 1) * amp), y: Math.round((Math.random() * 2 - 1) * amp) };
  cam.update(dt, g.state === 'play' && !g.menu);
  player.camFacing = cam.yaw;
  pipe.aim(g.focus, cam.yaw, cam.view, shake);

  // trou de visibilité : autour de ToeJam, ou de la cabine quand elle voyage
  g.hole += (g.holeR - g.hole) * Math.min(1, dt * 8);
  const actor = g.seq?.holeActor?.() || { pos: player.mid() };
  const hp = pipe.project(actor.pos);
  g.world.update(dt, g.t, g.focus, { x: hp.x, y: hp.y, z: hp.z, r: (g.hole / pipe.pxs) * pipe.ss });

  if (!g.menu) player.animate(dt);
  player.sync(fx, dt);
  fx.update(g.menu ? 0 : dt);
  pipe.skyU.uTime.value = g.t;
  // Gargantua se dévoile quand on monte vers le dernier étage
  pipe.skyU.uBH.value = THREE.MathUtils.smoothstep(g.focus.y / GAP, LEVELS - 1.8, LEVELS - 1);
  const P = g.world.pal;
  pipe.skyU.uTop.value.copy(P.skyTop); pipe.skyU.uBot.value.copy(P.skyBot);
  pipe.skyU.uNeb1.value.copy(P.neb1); pipe.skyU.uNeb2.value.copy(P.neb2);
  pipe.render(scene);
  hud.draw(dt, g);
  input.endFrame();
}

newGame(FIXED);

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!window.__game?.paused) step(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Pour les tests : avancer le jeu image par image quand l'onglet ne tourne pas.
window.__game = {
  g, player, pipe, input,
  get world() { return g.world; },
  step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) step(dt); },
  press(code) { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); },
};
if (DEBUG) console.log('Funkotron Remix — test : 1-9 / Page ↑↓ étage, G chute, T ascenseur, P tous les cadeaux, O +10 billets, Y carte, K couleurs MD');
