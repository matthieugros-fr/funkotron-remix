import './setup.js';
import * as THREE from 'three';
import { GAP, LEVELS } from './config.js';
import { Pipeline } from './render.js';
import { makeAssets } from './assets.js';
import { World } from './world.js';
import { Player } from './player.js';
import { FX } from './fx.js';
import { Hud } from './hud.js';
import { input } from './input.js';
import { cellX } from './gen.js';
import { FallSeq, ElevatorSeq, levelTitle } from './sequences.js';
import { clamp, easeInCubic, easeOutBack } from './util.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const SEED = Number(params.get('graine')) || 1991;

const pipe = new Pipeline(document.getElementById('game'), document.getElementById('hud'));
const scene = new THREE.Scene();
const assets = makeAssets();
const world = new World(scene, SEED, assets);
const player = new Player(scene, assets);
const fx = new FX(scene);
const hud = new Hud(document.getElementById('hud'));

const start = world.levels[0].data.start;
player.place(0, cellX(start.i), cellX(start.j));

const g = {
  state: 'title', stateT: 0, t: 0,
  scene, world, player, fx, hud, pipe,
  seq: null, ambient: [],
  focus: player.mid(), holeR: 14, hole: 14,
  shake: 0, md: false,
};

function setState(s) { g.state = s; g.stateT = 0; }

function irisAt(v, r) {
  const p = pipe.project(v);
  pipe.blitU.uIris.value.set(p.x, p.y, r);
}

function debugKeys() {
  for (let k = 0; k < LEVELS; k++) {
    if (input.hit(`Digit${k + 1}`)) {
      const s = world.levels[k].data.start;
      player.place(k, cellX(s.i), cellX(s.j));
      g.focus.copy(player.mid());
      hud.showCard(levelTitle(k));
    }
  }
  if (input.hit('KeyF') && player.level > 0 && !g.seq) g.seq = new FallSeq(g);
  if (input.hit('KeyE')) {
    const b = world.boothPos(player.level);
    if (b) { player.pos.x = b.x; player.pos.z = b.z + 1.3; }
  }
  if (input.hit('KeyM')) { g.md = !g.md; pipe.blitU.uLevels.value = g.md ? 8 : 256; }
}

function step(dt) {
  g.t += dt; g.stateT += dt;
  const mv = input.move();
  if (DEBUG) debugKeys();

  let target = player.mid();
  if (g.state === 'title') {
    // la caméra flâne au-dessus du premier étage
    const s = world.levels[0].data.start;
    target = new THREE.Vector3(cellX(s.i) + Math.sin(g.t * 0.13) * 7, 0.6, cellX(s.j) + Math.sin(g.t * 0.09) * 5);
    player.anim = 'idle';
    if (input.start()) setState('intro');
  } else if (g.state === 'intro') {
    // la caméra rejoint ToeJam, l'iris se referme sur lui, puis se rouvre
    const T = g.stateT;
    if (T < 0.6) target = g.focus.clone().lerp(player.mid(), Math.min(1, dt * 6));
    if (T >= 0.6 && T < 1.1) irisAt(player.mid(), Math.max(0, (1 - easeInCubic((T - 0.6) / 0.5)) * pipe.TW));
    else if (T >= 1.1 && T < 1.35) irisAt(player.mid(), 0);
    else if (T >= 1.35 && T < 2.1) {
      if (!g.cardShown) { g.cardShown = true; hud.showCard(levelTitle(0)); hud.hint = 9; }
      irisAt(player.mid(), easeOutBack((T - 1.35) / 0.75) * pipe.TW * 0.75);
    } else if (T >= 2.1) {
      pipe.blitU.uIris.value.z = -1;
      player.control = true;
      setState('play');
    }
  } else {
    if (g.seq) {
      if (g.seq.update(dt)) g.seq = null;
      else target = g.seq.focus();
    } else if (player.control) {
      const ev = player.update(dt, world, fx, mv);
      if (ev?.fall) g.seq = new FallSeq(g);
      else if (ev?.elevator) g.seq = new ElevatorSeq(g);
    }
  }
  g.ambient = g.ambient.filter((a) => !a.update(dt));

  // caméra : suit vite à l'horizontale, avec un peu de retard à la verticale pendant les séquences
  const kH = g.seq ? 7 : 9, kV = g.seq ? 4.5 : 9;
  g.focus.x += (target.x - g.focus.x) * (1 - Math.exp(-kH * dt));
  g.focus.z += (target.z - g.focus.z) * (1 - Math.exp(-kH * dt));
  g.focus.y += (target.y - g.focus.y) * (1 - Math.exp(-kV * dt));
  g.shake *= Math.exp(-dt * 7);
  const amp = g.shake > 0.4 ? g.shake : 0;
  const shake = { x: Math.round((Math.random() * 2 - 1) * amp), y: Math.round((Math.random() * 2 - 1) * amp) };
  pipe.aim(g.focus, shake);

  // trou de visibilité : autour de ToeJam, ou de la cabine quand elle voyage
  g.hole += (g.holeR - g.hole) * Math.min(1, dt * 8);
  const actor = g.seq?.holeActor?.() || { pos: player.mid() };
  const hp = pipe.project(actor.pos);
  world.update(dt, g.t, g.focus, { x: hp.x, y: hp.y, z: hp.z, r: g.hole });

  player.animate(dt);
  player.sync();
  fx.lineMat.color.copy(world.pal.tint);
  fx.update(dt);
  pipe.skyU.uTime.value = g.t;
  const P = world.pal;
  pipe.skyU.uTop.value.copy(P.skyTop); pipe.skyU.uBot.value.copy(P.skyBot);
  pipe.skyU.uNeb1.value.copy(P.neb1); pipe.skyU.uNeb2.value.copy(P.neb2);
  player.mat.color.copy(P.tint);
  pipe.render(scene);
  hud.draw(dt, g);
  input.endFrame();
}

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
  g, world, player, pipe, input,
  step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) step(dt); },
  press(code) { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); },
};
if (DEBUG) console.log('Funkotron Remix — touches de test : 1-4 étage, F chute, E devant l’ascenseur, M couleurs Mega Drive');
