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
import { PRESENTS, PRESENT, PIECES, FOOD, RANKS, rankOf } from './catalog.js';
import { Earthlings } from './earthlings.js';
import { Bag, openPresent } from './presents.js';
import { Tomatoes, Delivery } from './projectiles.js';
import { FallSeq, ElevatorSeq, DoorSeq, BummerSeq, EndingSeq, levelTitle } from './sequences.js';
import { setRocketPieces } from './specials.js';
import { easeInCubic, easeOutBack } from './util.js';
import { sound, musicForLevel } from './audio.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FIXED = (params.get('graine') || 'FUNK91').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6) || 'FUNK91';
const codeToSeed = (code) => (parseInt(code, 36) % 2147483647) || 1991;
const randomCode = () => Array.from({ length: 6 }, () => '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 34)]).join('');

const pipe = new Pipeline(document.getElementById('game'), document.getElementById('hud'));
const scene = new THREE.Scene();
const assets = makeAssets();
const players = [new Player(scene, assets, 'toejam'), new Player(scene, assets, 'earl')];
const player = players[0];
const fx = new FX(scene);
const hud = new Hud(document.getElementById('hud'));
const cam = new CameraControl(document.getElementById('game'), input);
const tomatoes = new Tomatoes(scene);
const earthlings = new Earthlings(scene);

// Touches d'action : en solo tout pilote ToeJam ; en coop chacun les siennes (et sa manette).
const SOLO = { bag: ['Space', 'Enter', 'NumpadEnter'], tomato: ['KeyF'], sneak: ['ShiftLeft', 'ShiftRight'], pad: 0, move: 0 };
const COOP = [
  { bag: ['Space'], tomato: ['KeyF'], sneak: ['ShiftLeft'], pad: 0, move: 1 },
  { bag: ['Enter', 'NumpadEnter'], tomato: ['ShiftRight'], sneak: ['AltRight'], pad: 1, move: 2 },
];

const g = {
  state: 'title', stateT: 0, t: 0, menuSel: 0, coop: false,
  scene, player, players, fx, hud, pipe, cam,
  seq: null, ambient: [], menu: null, bagSel: 0, shopSel: 0, shop: [], prompt: null,
  focus: new THREE.Vector3(), focusB: new THREE.Vector3(), split: null, holeR: 1, hole: 1, shake: 0, md: false,
};
const active = () => players.filter((p) => p.active);

function setState(s) { g.state = s; g.stateT = 0; }

g.iris = (v, r) => {
  if (!v) { pipe.blitU.uIris.value.z = -1; return; }
  const p = pipe.project(v);
  pipe.blitU.uIris.value.set(p.x / pipe.ss, p.y / pipe.ss, r);
};

function resetPlayer(p, level, x, z, on) {
  p.place(level, x, z);
  Object.assign(p, { active: on, visible: on, control: false, anim: 'idle', bang: false, shadowOverride: null, vx: 0, vz: 0, kx: 0, kz: 0, invuln: 0, health: 100 });
  p.effects = { rocket: 0, wings: 0, spring: 0, hitops: 0, rain: 0, love: 0 };
  p.m.root.visible = on;
}

// Nouvelle partie : nouveau monde (même graine = même monde), compteurs à zéro.
function newGame(code) {
  if (g.world) g.world.dispose();
  if (g.endRocket) { scene.remove(g.endRocket); g.endRocket = null; }
  g.seedCode = code;
  const seed = codeToSeed(code);
  g.bag = new Bag(seed + 5);
  g.world = new World(scene, seed, assets, g.bag);
  const s = g.world.levels[0].data.start, x = cellX(s.i), z = cellX(s.j);
  resetPlayer(player, 0, x, z, true);
  const e = g.world.nearestLand(0, x + 1.3, z);
  resetPlayer(players[1], 0, e.x, e.z, g.coop);
  earthlings.clear();
  Object.assign(g, { xp: 0, rank: 0, tomatoes: 0, bucks: 0, lives: 3, pieces: new Set(), seq: null, ambient: [], menu: null, prompt: null, cardShown: false, lastLevel: 0, split: null });
  g.stats = { time: 0, falls: 0, presents: 0, chased: 0, eaten: 0 };
  tomatoes.clear();
  g.focus.copy(player.mid()); g.focusB.copy(g.focus);
}

g.loseLife = (who = player) => {
  g.lives -= 1;
  who.health = 100;
  if (g.lives <= 0) {
    for (const p of active()) { p.control = false; p.anim = 'splat'; p.squash = 1; }
    setState('over');
    sound.playMusic(null);
    sound.jingle('game-over');
  } else g.seq = new BummerSeq(g, who);
};
g.teleport = (who = player) => { g.seq = new DoorSeq(g, who); };
g.finish = () => { setState('credits'); sound.playMusic('titre'); };

// Expérience : explorer, ouvrir des cadeaux, trouver des morceaux, chasser des terriens.
g.addXp = (n) => {
  const before = rankOf(g.xp);
  g.xp += n;
  const after = rankOf(g.xp);
  if (after > before) {
    g.rank = after;
    for (const p of active()) { p.health = 100; p.emote('joie', 2); }
    hud.showCard('PROMOTION !', `${g.coop ? 'VOUS ÊTES' : 'TU ES'} MAINTENANT : ${RANKS[after].name}`);
    sound.play('promotion');
  }
};
g.damage = (n, who = player) => {
  if (g.state !== 'play' || g.seq) return;
  who.health = Math.min(100, who.health - n);
  if (who.health <= 0) { hud.showCard('ÉPUISÉ', 'MOINS UNE VIE.'); g.loseLife(who); }
};
// Un terrien touche un joueur : énergie, bourrade, et parfois un effet.
g.hurt = (e, nx, nz, who = player) => {
  if (who.invuln > 0 || who.effects.wings > 0) return;
  who.invuln = 1.3;
  who.kick(nx * e.def.knock, nz * e.def.knock);
  sound.play(e.def.sound, { vol: 0.8 });
  if (e.type === 'cupid') {
    who.effects.love = 6;
    sound.play('coeur');
    hud.toast('AMOUREUX ! LES COMMANDES SONT INVERSÉES.');
    return;
  }
  sound.play('aie');
  who.emote('aie', 1);
  g.shake = 2;
  g.damage(e.def.dmg, who);
};

function openShop() {
  const pool = PRESENTS.filter((p) => p.price);
  g.shop = [];
  while (g.shop.length < 3) {
    const p = pool[Math.floor(Math.random() * pool.length)].id;
    if (!g.shop.includes(p)) g.shop.push(p);
  }
  g.shopSel = 0;
  g.menu = 'shop';
  sound.play('boite');
}

// Le sage en costume de carotte révèle ce que cache un emballage, puis repart méditer.
function consultSage(sage) {
  sound.play('sage');
  const unknown = g.bag.list().filter((it) => !g.bag.known.has(it.type));
  if (!unknown.length) {
    hud.showCard('LE SAGE', Math.random() < 0.5 ? "IL PARAÎT QU'IL Y A UN ÉTAGE SOUS LE PREMIER." : 'REVIENS AVEC UN MYSTÈRE.');
    return;
  }
  const t = unknown[Math.floor(Math.random() * unknown.length)].type;
  g.bag.known.add(t);
  hud.showCard('LE SAGE A PARLÉ', `CE PAPIER-LÀ, C'EST : ${PRESENT[t].name}.`);
  setTimeout(() => earthlings.poof(sage, fx), 1600);
}

function onPickup(p, who) {
  const pos = new THREE.Vector3(p.item.x, who.pos.y, p.item.z);
  if (p.kind === 'present') {
    g.bag.add(p.item.type);
    sound.play('cadeau_ramasse');
    who.emote('surprise', 0.8);
    fx.sparkle(pos, '#ff8ad8', 10, 0.6);
    hud.toast(`UN CADEAU : ${g.bag.label(p.item.type)}`);
  } else if (p.kind === 'buck') {
    g.bucks += 1;
    sound.play('billet', { vary: 0.1 });
    who.emote('content', 0.6);
    fx.coins(pos, 4);
  } else if (p.kind === 'food') {
    const f = FOOD[p.item.type];
    who.health = Math.max(0, Math.min(100, who.health + f.heal));
    g.stats.eaten++;
    sound.play(f.heal > 0 ? 'manger' : 'beurk');
    who.emote(f.heal > 0 ? 'joie' : 'beurk', 1.4);
    hud.toast(f.heal > 0 ? `${f.name} : +${f.heal}` : `${f.name}. BEURK. ${f.heal}`);
    if (who.health <= 0) g.damage(1, who);
  } else if (p.kind === 'piece') {
    g.pieces.add(p.item.index);
    sound.play('morceau');
    sound.jingle('morceau');
    for (const q of active()) q.emote('joie', 2.5);
    const n = g.pieces.size;
    g.addXp(20);
    hud.showCard(`MORCEAU ${n}/10`, n === 10 ? 'VAISSEAU COMPLET ! LA FUSÉE ATTEND TOUT EN HAUT.' : PIECES[p.item.index]);
    fx.sparkle(pos, '#ffe680', 30, 1.2);
    g.shake = 2;
  }
}

function menuInput() {
  const up = input.hit('ArrowUp', 'KeyW'), down = input.hit('ArrowDown', 'KeyS');
  const close = input.hit('Escape', 'Backspace') || input.padHit(1) || input.padHit(1, 1);
  const ok = input.hit('Space', 'Enter', 'NumpadEnter') || input.padHit(0) || input.padHit(0, 1);
  if (up || down) sound.play('menu_curseur');
  if (close) sound.play('menu_ouvre', { rate: 0.8 });
  if (g.menu === 'map') { if (close || ok || input.hit('KeyC') || input.padHit(3)) g.menu = null; return; }
  if (g.menu === 'bag') {
    const list = g.bag.list(), n = list.length;
    if (close || !n) { if (close || ok) g.menu = null; return; }
    if (up) g.bagSel = (g.bagSel - 1 + n) % n;
    if (down) g.bagSel = (g.bagSel + 1) % n;
    g.bagSel = Math.min(g.bagSel, n - 1);
    if (ok) { g.menu = null; openPresent(g, list[g.bagSel].type, g.menuOwner || player); g.addXp(3); g.stats.presents++; }
    return;
  }
  if (g.menu === 'shop') {
    const n = g.shop.length;
    if (close) { g.menu = null; return; }
    if (up) g.shopSel = (g.shopSel - 1 + n) % n;
    if (down) g.shopSel = (g.shopSel + 1) % n;
    if (ok) {
      const t = g.shop[g.shopSel], price = PRESENT[t].price;
      if (g.bucks < price) { hud.toast('PAS ASSEZ DE BILLETS.'); sound.play('menu_curseur', { rate: 0.6 }); return; }
      g.bucks -= price;
      g.menu = null;
      g.ambient.push(new Delivery(g, t));
      hud.toast('COMMANDE PASSÉE. LIVRAISON PAR LES AIRS.');
    }
  }
}

function goLevel(k) {
  k = Math.max(-1, Math.min(LEVELS - 1, k));
  const d = g.world.levels[k].data, s = d.start || d.center || { i: 22, j: 22 };
  const n = g.world.nearestLand(k, cellX(s.i), cellX(s.j) + 2);
  for (const [i, p] of active().entries()) p.place(k, n.x + i * 1.2, n.z);
  g.focus.copy(player.mid());
  hud.showCard(levelTitle(k));
}

function debugKeys() {
  for (let k = 0; k < 9; k++) if (input.hit(`Digit${k + 1}`)) goLevel(k);
  if (input.hit('Digit0')) goLevel(-1);
  if (input.hit('PageUp')) goLevel(player.level + 1);
  if (input.hit('PageDown')) goLevel(player.level - 1);
  if (input.hit('KeyG') && player.level > 0 && !g.seq) g.seq = new FallSeq(g, player);
  if (input.hit('KeyT')) {
    const b = g.world.boothPos(player.level);
    if (b) { player.pos.x = b.x; player.pos.z = b.z + 1.5; }
  }
  if (input.hit('KeyK')) { g.md = !g.md; pipe.blitU.uLevels.value = g.md ? 8 : 40; }
  if (input.hit('KeyP')) for (const p of PRESENTS) g.bag.add(p.id);
  if (input.hit('KeyO')) g.bucks += 10;
  if (input.hit('KeyY')) g.world.levels[player.level].data.seen.fill(1);
  if (input.hit('KeyR')) for (let i = 0; i < 10; i++) g.pieces.add(i);
  if (input.hit('KeyU')) {
    // devant la fusée
    goLevel(LEVELS - 1);
    const r = g.world.levels[LEVELS - 1].data.rocket, n = g.world.nearestLand(LEVELS - 1, r.x, r.z + 2.2);
    player.pos.x = n.x; player.pos.z = n.z;
  }
  if (input.hit('KeyI')) {
    // au bord de l'îlot secret
    const h = g.world.levels[0].data.secretHole;
    if (h) { player.place(0, cellX(h.i), cellX(h.j) + 1); g.focus.copy(player.mid()); }
  }
  if (input.hit('KeyJ')) {
    // Earl arrive (ou repart)
    g.coop = !g.coop;
    const p2 = players[1], n = g.world.nearestLand(player.level, player.pos.x + 1.3, player.pos.z);
    resetPlayer(p2, player.level, n.x, n.z, g.coop);
    p2.control = g.coop;
  }
}

// Une image de jeu : renvoie le point que la caméra doit suivre (ou null pour le duo).
function playStep(dt) {
  if (g.menu) { menuInput(); return null; }
  g.prompt = null;
  g.stats.time += dt;
  for (const p of active()) for (const k in p.effects) p.effects[k] = Math.max(0, p.effects[k] - dt);
  if (g.seq) {
    if (g.seq.update(dt)) g.seq = null;
    else return g.seq.focus();
    return null;
  }
  const L = g.world.levels[player.level];
  for (const [i, p] of active().entries()) {
    if (!p.control) continue;
    const A = g.coop ? COOP[i] : SOLO;
    const ev = p.update(dt, g.world, fx, input.move(A.move), cam.yaw, p.effects, A.sneak.some((c) => input.isDown(c)));
    if (p.effects.rain > 0) g.damage(2.5 * dt, p);
    if (ev?.fall) { g.seq = new FallSeq(g, p); return null; }
    if (ev?.elevator) { g.seq = new ElevatorSeq(g, p); return null; }
    for (const pick of g.world.collect(p.level, p.pos)) onPickup(pick, p);
    g.revealed = (g.revealed || 0) + g.world.reveal(p.level, p.pos.x, p.pos.z);
    while (g.revealed >= 40) { g.revealed -= 40; g.addXp(1); }
    // le jacuzzi du niveau secret
    const tub = L.data.hottub;
    if (tub && Math.hypot(p.pos.x - tub.x, p.pos.z - tub.z) < 0.95) {
      p.health = Math.min(100, p.health + 30 * dt);
      if (Math.random() < 0.3) fx.sparkle(new THREE.Vector3(tub.x, p.pos.y + 0.5, tub.z), '#bff4ff', 2, 1.2);
      if (!g.tubSaid) { g.tubSaid = true; hud.toast('AAAAH. LE LUXE.'); }
    }
    // la fusée
    const rk = L.data.rocket, nearRocket = rk && Math.hypot(p.pos.x - rk.x, p.pos.z - rk.z) < 2.1;
    const mb = g.world.mailboxNear(p.level, p.pos), sage = earthlings.friendNear(p.pos);
    const key = g.coop ? (i ? 'ENTRÉE' : 'ESPACE') : 'ESPACE';
    if (nearRocket) g.prompt = g.pieces.size === 10 ? `${key} : EMBARQUER POUR FUNKOTRON` : `IL MANQUE ${10 - g.pieces.size} MORCEAU${10 - g.pieces.size > 1 ? 'X' : ''} À LA FUSÉE`;
    else if (mb) g.prompt = `${key} : COMMANDER UN CADEAU`;
    else if (sage) g.prompt = `${key} : CONSULTER LE SAGE`;
    if (input.hit(...A.bag) || input.padHit(0, A.pad)) {
      if (nearRocket && g.pieces.size === 10) { g.seq = new EndingSeq(g, L); return null; }
      if (sage) consultSage(sage);
      else if (mb) openShop();
      else { g.menu = 'bag'; g.menuOwner = p; g.bagSel = 0; sound.play('menu_ouvre'); return null; }
    }
    if ((input.hit(...A.tomato) || input.padHit(2, A.pad)) && g.tomatoes > 0) { g.tomatoes--; tomatoes.throw(p); }
  }
  if (input.hit('KeyC') || input.padHit(3) || input.padHit(3, 1)) { g.menu = 'map'; sound.play('carte'); }
  // côte à côte, le duo reprend des forces
  if (g.coop) {
    const [a, b] = players;
    if (Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 1.4) {
      for (const p of players) p.health = Math.min(100, p.health + 3 * dt);
      if (Math.random() < 0.04) fx.sparkle(new THREE.Vector3((a.pos.x + b.pos.x) / 2, a.pos.y + 1.6, (a.pos.z + b.pos.z) / 2), '#ff8ad8', 2, 0.4);
    }
  }
  if (player.level !== g.lastLevel) {
    g.lastLevel = player.level;
    if (player.level === LEVELS - 1) {
      const miss = 10 - g.pieces.size;
      hud.toast(miss ? `LA FUSÉE EST LÀ. IL MANQUE ${miss} MORCEAU${miss > 1 ? 'X' : ''}.` : 'LA FUSÉE EST PRÊTE. FONCEZ !');
    }
  }
  return null;
}

// Caméra(s) : une seule quand le duo est proche ; deux, séparées par une ligne qui pivote, sinon.
function framing(target) {
  const [a, b] = players;
  g.split = null;
  if (!(g.coop && b.active && g.state === 'play' && !g.seq && b.visible)) return [target, target];
  const pa = a.mid(), pb = b.mid(), d = pb.clone().sub(pa);
  const { right, up } = pipe.axes(cam.yaw);
  const dr = d.dot(right), du = d.dot(up), L = Math.hypot(dr, du), D = cam.view * 0.5;
  const mid = pa.clone().add(pb).multiplyScalar(0.5);
  if (L <= D) return [mid, mid];
  g.split = { x: dr / L, y: du / L };
  return [pa.clone().addScaledVector(d, D / 2 / L), pb.clone().addScaledVector(d, -D / 2 / L)];
}

function step(dt) {
  g.t += dt; g.stateT += dt;
  if (DEBUG) debugKeys();
  if (input.hit('KeyL')) hud.toast(pipe.setMode(pipe.mode + 1));

  let target = player.mid();
  if (g.state === 'title') {
    // la caméra flâne au-dessus du premier étage
    const s = g.world.levels[0].data.start;
    target = new THREE.Vector3(cellX(s.i) + Math.sin(g.t * 0.13) * 4, 0.6, cellX(s.j) + Math.sin(g.t * 0.09) * 3);
    for (const p of players) p.anim = 'idle';
    cam.yawT += dt * 0.12;
    if (input.hit('ArrowUp', 'KeyW', 'ArrowDown', 'KeyS')) { g.menuSel = 1 - g.menuSel; sound.play('menu_curseur'); }
    if (input.hit('ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD')) {
      g.coop = !g.coop; sound.play('menu_curseur');
      const p2 = players[1];
      p2.active = p2.visible = g.coop; p2.m.root.visible = g.coop;
    }
    if (input.start()) {
      const code = g.menuSel === 0 ? FIXED : randomCode();
      newGame(code);
      setState('intro');
    }
  } else if (g.state === 'intro') {
    // la caméra rejoint ToeJam, l'iris se referme sur lui, puis se rouvre
    const T = g.stateT;
    if (T < 0.6) target = g.focus.clone().lerp(player.mid(), Math.min(1, dt * 6));
    if (T >= 0.6 && T < 1.1) g.iris(player.mid(), Math.max(0, (1 - easeInCubic((T - 0.6) / 0.5)) * pipe.TW));
    else if (T >= 1.1 && T < 1.35) g.iris(player.mid(), 0);
    else if (T >= 1.35 && T < 2.1) {
      if (!g.cardShown) { g.cardShown = true; hud.showCard(levelTitle(0), g.coop ? 'TOEJAM ET EARL, EN DUO.' : ''); hud.hint = 10; }
      g.iris(player.mid(), easeOutBack((T - 1.35) / 0.75) * pipe.TW * 0.75);
    } else if (T >= 2.1) {
      g.iris(null);
      for (const p of active()) p.control = true;
      setState('play');
    }
  } else if (g.state === 'over') {
    if (g.stateT > 1.5 && input.start()) { newGame(g.seedCode); setState('intro'); }
  } else if (g.state === 'credits') {
    // sur Funkotron : on danse, la caméra tourne, le générique défile
    for (const p of active()) { p.anim = 'dance'; p.faceDir(Math.sin(cam.yaw), Math.cos(cam.yaw)); }
    target = player.mid().add(new THREE.Vector3(0.6, 0.3, 0));
    cam.yawT += dt * 0.25;
    if (Math.random() < 0.3) fx.coins(player.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 3, (Math.random() - 0.5) * 6)), 2);
    if (g.stateT > 4 && input.start()) { newGame(g.seedCode); setState('title'); }
  } else {
    target = playStep(dt) || target;
  }
  if (!g.menu) g.ambient = g.ambient.filter((a) => !a.update(dt));
  tomatoes.update(dt, g.world, fx, (pos) => {
    const e = earthlings.hit(pos);
    if (!e) return false;
    earthlings.poof(e, fx);
    g.addXp(2);
    g.stats.chased++;
    return true;
  });
  // les terriens vivent sur l'étage du duo
  if (g.world && !g.seq && player.level !== earthlings.level) earthlings.setLevel(g.world, player.level);
  earthlings.update(g.menu ? 0 : dt, g);

  // caméra : suit vite à l'horizontale, avec un peu de retard à la verticale pendant les séquences
  if (g.state === 'play' && !g.seq && g.coop && players[1].active) target = player.mid().add(players[1].mid()).multiplyScalar(0.5);
  const [tA, tB] = framing(target);
  const kH = g.seq ? 7 : 9, kV = g.seq ? 4.5 : 9, eh = 1 - Math.exp(-kH * dt), ev = 1 - Math.exp(-kV * dt);
  for (const [f, t] of [[g.focus, tA], [g.focusB, tB]]) { f.x += (t.x - f.x) * eh; f.z += (t.z - f.z) * eh; f.y += (t.y - f.y) * ev; }
  if (!g.split) g.focusB.copy(g.focus);
  g.shake *= Math.exp(-dt * 7);
  const amp = g.shake > 0.4 ? g.shake : 0;
  const shake = { x: Math.round((Math.random() * 2 - 1) * amp), y: Math.round((Math.random() * 2 - 1) * amp) };
  cam.update(dt, g.state === 'play' && !g.menu);
  for (const p of players) p.camFacing = cam.yaw;
  pipe.aim(g.focus, cam.yaw, cam.view, shake, 0);

  // trou de visibilité : autour du joueur de chaque vue, ou de la cabine quand elle voyage
  g.hole += (g.holeR - g.hole) * Math.min(1, dt * 8);
  const holeFor = (pos, view) => { const hp = pipe.project(pos, view); return { x: hp.x, y: hp.y, z: hp.z, r: (g.hole / pipe.pxs) * pipe.ss }; };
  const actorA = g.seq?.holeActor?.()?.pos || (g.split ? players[0].mid() : g.coop && players[1].active ? g.focus.clone() : player.mid());
  // le niveau 0 reste invisible tant qu'on ne s'y rend pas
  g.world.showSecret = player.level === -1 || g.seq?.to === -1 || g.seq?.L?.k === -1;
  g.world.update(dt, g.t, g.focus, holeFor(actorA, 0));
  const top = g.world.levels[LEVELS - 1];
  if (top.rocket) setRocketPieces(top.rocket, g.pieces);

  for (const p of players) {
    p.m.root.visible = p.active && p.visible;
    if (!p.active) { p.bangMesh.visible = false; p.fallShadow.visible = false; p.gear.rain.visible = false; continue; }
    if (!g.menu) p.animate(dt);
    p.sync(fx, dt);
  }
  fx.update(g.menu ? 0 : dt);
  pipe.skyU.uTime.value = g.t;
  // Gargantua se dévoile en montant vers le dernier étage, et s'efface au-delà, vers Funkotron
  const lv = g.focus.y / GAP;
  pipe.skyU.uBH.value = THREE.MathUtils.smoothstep(lv, LEVELS - 1.8, LEVELS - 1) * (1 - THREE.MathUtils.smoothstep(lv, LEVELS - 0.7, LEVELS - 0.1));
  const P = g.world.pal;
  pipe.skyU.uTop.value.copy(P.skyTop); pipe.skyU.uBot.value.copy(P.skyBot);
  pipe.skyU.uNeb1.value.copy(P.neb1); pipe.skyU.uNeb2.value.copy(P.neb2);
  // sons : musique selon l'étage, boucles des pouvoirs
  sound.playMusic(g.state === 'title' || g.state === 'intro' || g.state === 'credits' ? 'titre' : g.state === 'over' ? null : musicForLevel(Math.round(lv)));
  const live = g.state === 'play' && !g.menu;
  const any = (k, extra = () => true) => active().some((p) => p.control && p.effects[k] > 0 && extra(p));
  sound.loop('patins', live && any('rocket', (p) => Math.hypot(p.vx, p.vz) > 0.5));
  sound.loop('ailes', live && any('wings'));
  sound.loop('pluie', live && any('rain'));

  pipe.renderView(scene, 0);
  if (g.split) {
    pipe.aim(g.focusB, cam.yaw, cam.view, shake, 1);
    g.world.setHole(holeFor(players[1].mid(), 1));
    pipe.renderView(scene, 1);
  }
  pipe.present(g.split);
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
  g, player, players, pipe, input, earthlings,
  get world() { return g.world; },
  step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) step(dt); },
  press(code) { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); },
};
if (DEBUG) console.log('Funkotron Remix — test : 0-9 / Page ↑↓ étage, G chute, T ascenseur, I îlot secret, U fusée, R tous les morceaux, J Earl, P cadeaux, O billets, Y carte, K couleurs MD');
