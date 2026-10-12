import './setup.js';
import * as THREE from 'three';
import { GAP, LEVELS } from './config.js';
import { Pipeline } from './render.js';
import { CameraControl } from './camera.js';
import { makeAssets } from './assets.js';
import { World } from './world.js';
import { Player, noEffects } from './player.js';
import { FX } from './fx.js';
import { Hud } from './hud.js';
import { input } from './input.js';
import { cellX } from './gen.js';
import { PRESENTS, PRESENT, PIECES, FOOD, RANKS, PERK, CHALLENGES, EARTHLINGS, rankOf } from './catalog.js';
import { Earthlings } from './earthlings.js';
import { Bag, GiftPop } from './presents.js';
import { Tomatoes, Delivery } from './projectiles.js';
import { FallSeq, UnfallSeq, ElevatorSeq, DoorSeq, BummerSeq, EndingSeq, levelTitle } from './sequences.js';
import { setRocketPieces } from './specials.js';
import { easeInCubic, easeOutBack } from './util.js';
import { sound, musicForLevel } from './audio.js';
import { BPM } from './groove.js';
import { MODES } from './render.js';
import { LIQUIDS } from './biomes.js';
import { Surprises, RECORDS } from './surprises.js';
import { IntroCine } from './cine.js';
import { rollPresent } from './catalog.js';
import { settings, saveSettings, tipSeen, markTip, hasSave, clearSave, saveGame, loadGame, carnet, note, checkpointInfo, clearCheckpoint } from './save.js';
import { edgeU } from './edges.js';
import { banter } from './banter.js';
import { preloadTerriens } from './terrien3d.js';

const GROOVE_AFTER = 7; // secondes sans toucher aux commandes avant que ça groove

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FIXED = (params.get('graine') || 'FUNK91').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6) || 'FUNK91';
const codeToSeed = (code) => (parseInt(code, 36) % 2147483647) || 1991;
const randomCode = () => Array.from({ length: 6 }, () => '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 34)]).join('');

preloadTerriens();
const pipe = new Pipeline(document.getElementById('game'), document.getElementById('hud'));
pipe.setMode(settings.quality);
const scene = new THREE.Scene();
const assets = makeAssets();
const players = [new Player(scene, assets, 'toejam'), new Player(scene, assets, 'earl')];
const player = players[0];
const fx = new FX(scene);
const hud = new Hud(document.getElementById('hud'));
const cam = new CameraControl(document.getElementById('game'), input);
const tomatoes = new Tomatoes(scene);
const earthlings = new Earthlings(scene);
const surprises = new Surprises(scene);

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

// Où un point du monde (sur l'étage `level`) apparaît sur l'interface : selon l'écran partagé, zéro, une ou deux positions.
g.spots = (pos, level) => {
  const apart = g.split && players[0].level !== players[1].level;
  const views = g.split ? (apart ? [0, 1].filter((i) => players[i].level === level) : [0, 1]) : active().some((p) => p.level === level) ? [0] : [];
  return pipe.spots(pos, g.split, views);
};
// Un coup qui porte : l'image se fige un instant et la caméra resserre d'un cran.
g.punch = (stop = 0.07, zoom = 0.05) => { g.stopT = Math.max(g.stopT || 0, stop); g.zoomK = Math.max(g.zoomK || 0, zoom); };
g.banter = (p, ev, o) => banter(g, p, ev, o);
g.speak = (id) => sound.line(id);
const NAME = { toejam: 'TOEJAM', earl: 'EARL' };
const RED = { fill: '#ff4a5c', line: '#1a1033' };
// les avantages du rang (voir RANKS)
g.has = (k) => g.rank >= PERK[k];
g.priceOf = (t) => (g.has('discount') ? Math.max(1, Math.round(PRESENT[t].price * 0.7)) : PRESENT[t].price);
g.carnet = carnet;
// le carnet garde la trace des exploits
function noteProgress() {
  if (!g.world) return;
  note((c) => {
    c.bestLevel = Math.max(c.bestLevel, ...active().map((p) => Math.min(25, p.level + 1)));
    c.bestRank = Math.max(c.bestRank, g.rank);
    c.records = Math.max(c.records, g.records || 0);
  });
}
// un terrien vient de repérer quelqu'un : il pousse un « ! », et la cible a parfois son mot à dire
g.onCharge = (e, p) => banter(g, p, 'chase', { extra: e.type, chance: 0.45 });

g.iris = (v, r) => {
  if (!v) { pipe.blitU.uIris.value.z = -1; return; }
  const p = pipe.project(v);
  pipe.blitU.uIris.value.set(p.x / pipe.ss, p.y / pipe.ss, r);
};

function resetPlayer(p, level, x, z, on) {
  p.place(level, x, z);
  Object.assign(p, { active: on, visible: on, control: false, anim: 'idle', bang: false, shadowOverride: null, vx: 0, vz: 0, kx: 0, kz: 0, invuln: 0, health: 100, ko: 0, revive: 0, findT: 0 });
  p.effects = noEffects();
  p.m.root.visible = on;
}

// Nouvelle partie : nouveau monde (même graine = même monde), compteurs à zéro.
function newGame(code) {
  if (g.world) g.world.dispose();
  if (g.endRocket) { scene.remove(g.endRocket); g.endRocket = null; }
  g.seedCode = code;
  const seed = codeToSeed(code);
  g.bag = new Bag(seed + 5);
  // un sac par joueur (emballages et cadeaux reconnus en commun), et ses tomates
  players[0].bag = g.bag; players[1].bag = new Bag(0, g.bag);
  for (const p of players) p.tomatoes = 0;
  g.world = new World(scene, seed, assets, g.bag);
  const s = g.world.levels[0].data.start, x = cellX(s.i), z = cellX(s.j);
  resetPlayer(player, 0, x, z, true);
  const e = g.world.nearestLand(0, x + 1.3, z);
  resetPlayer(players[1], 0, e.x, e.z, g.coop);
  earthlings.clear();
  Object.assign(g, { xp: 0, rank: 0, bucks: 0, lives: g.challenge?.id === 'vie' ? 1 : 3, pieces: new Set(), seq: null, ambient: [], menu: null, prompt: null, cardShown: false, lastLevel: 0, split: null,
    maxLv: 1, won: false, cpLevel: null, score: 0 });
  g.stats = { time: 0, falls: 0, presents: 0, chased: 0, eaten: 0 };
  tomatoes.clear();
  for (const d of g.decoys || []) d.remove();
  g.decoys = [];
  surprises.clear();
  g.records = 0;
  g.focus.copy(player.mid()); g.focusB.copy(g.focus);
}

// Le score : tout ce qu'on a fait, multiplié par le défi choisi.
function score() {
  const base = g.xp * 10 + g.bucks * 5 + g.pieces.size * 400 + (g.maxLv || 1) * 150 + (g.records || 0) * 300 + (g.won ? 3000 + Math.max(0, 2400 - g.stats.time) * 2 : 0);
  return Math.round(base * (g.challenge?.mult || 1));
}
function noteScore() {
  g.score = score();
  const key = g.challenge?.name || (g.seedCode === FIXED ? 'MONDE FIXE' : 'SANS DÉFI');
  g.bestScore = Math.max(g.score, carnet.scores[key] || 0);
  note((c) => { c.scores[key] = g.bestScore; });
}
function gameOver(why) {
  for (const p of active()) { p.control = false; p.anim = 'splat'; p.squash = 1; p.ko = 0; }
  noteProgress();
  noteScore();
  g.overWhy = why || null;
  g.lastTime = g.stats.time;
  // le point de reprise n'est proposé que s'il appartient à cette partie-ci (et pas quand le temps est écoulé)
  const cp = checkpointInfo();
  g.cpOffer = cp && cp.seed === g.seedCode && cp.coop === g.coop && g.challenge?.id !== 'vie' && !why ? cp.level : null;
  setState('over');
  clearSave();
  sound.playMusic(null);
  sound.jingle('game-over');
}
g.loseLife = (who = player) => {
  g.lives -= 1;
  who.health = g.lives <= 0 ? 0 : 100;
  if (g.lives <= 0) gameOver();
  else g.seq = new BummerSeq(g, who);
};
g.teleport = (who = player) => { g.seq = new DoorSeq(g, who); };
// Le terrien surprise : un terrien hostile de l'étage sort du paquet, à quelques pas, et il a vu qui l'a ouvert.
g.surpriseEarthling = (who = player) => {
  const k = who.level, d = g.world.levels[k].data;
  const pool = Object.entries(EARTHLINGS).filter(([, e]) => !e.friendly && e.from <= Math.max(0, k));
  let x = Math.random() * pool.reduce((s, [, e]) => s + e.weight, 0), type = pool[0][0];
  for (const [id, e] of pool) { x -= e.weight; if (x <= 0) { type = id; break; } }
  const spot = g.world.spotNear(k, who.pos.x, who.pos.z, 3, 5), item = { type, x: spot.x, z: spot.z, gone: false };
  d.earthlings.push(item);
  if (earthlings.levels.has(k)) for (const e of earthlings.spawnItem(g.world, k, item)) { e.cool = 1.2; fx.dust(e.pos, 18, ['#ffffff', '#d9d9e6', '#b9b0de']); }
  sound.play('poof');
  setTimeout(() => hud.toast(`${EARTHLINGS[type].name} SORT DU PAQUET.`, 2.6), 700);
};
g.finish = () => {
  setState('credits'); sound.playMusic('funkotron'); clearSave(); clearCheckpoint();
  g.won = true;
  noteProgress();
  noteScore();
  note((c) => { c.wins++; c.bestTime = c.bestTime ? Math.min(c.bestTime, g.stats.time) : g.stats.time; });
};

// Expérience : explorer, ouvrir des cadeaux, trouver des morceaux, chasser des terriens.
g.addXp = (n) => {
  const before = rankOf(g.xp);
  g.xp += n;
  const after = rankOf(g.xp);
  if (after > before) {
    g.rank = after;
    for (const p of active()) { p.health = 100; p.emote('joie', 2); }
    active()[Math.floor(Math.random() * active().length)].say('funky', true);
    const R = RANKS[after];
    hud.showCard(`${R.name} !`, R.perk ? `PROMOTION ! BONUS : ${R.perk}` : `${g.coop ? 'VOUS ÊTES' : 'TU ES'} MAINTENANT : ${R.name}`, true);
    sound.play('promotion');
    if (before < PERK.wrap && after >= PERK.wrap) revealWrap();
    noteProgress();
  }
};
g.damage = (n, who = player) => {
  if (g.state !== 'play' || g.seq || who.ko > 0) return;
  who.health = Math.min(100, who.health - n * (who.kind === 'earl' && n > 0 ? 0.75 : 1));
  if (who.health <= 0) {
    // en coop, on tombe K.O. : le copain a quelques secondes pour venir nous relever
    const mate = players.find((q) => q !== who && q.active && q.level === who.level && (q.control || q.hiT > 0) && !(q.ko > 0));
    if (g.coop && mate) { knockOut(who, mate); return; }
    if (g.lives > 1) hud.showCard('ÉPUISÉ', 'MOINS UNE VIE.');
    g.loseLife(who);
  }
};
const KO_TIME = 7, REVIVE = 1.5;
function knockOut(p, mate) {
  Object.assign(p, { ko: KO_TIME, revive: 0, health: 0, control: false, anim: 'splat', squash: 1, vx: 0, vz: 0 });
  sound.play('splat'); g.shake = 2; g.punch(0.1, 0.05);
  hud.showCard('K.O. !', `${NAME[p.kind]} EST À TERRE. ${NAME[mate.kind]}, VIENS LE RELEVER !`, true);
  banter(g, mate, 'ko', { force: true });
  tip('relever', 'RESTE À CÔTÉ DE TON COPAIN À TERRE POUR LE RELEVER.');
}
// les copains K.O. : on les relève en restant à côté, sinon ils perdent une vie
function updateKO(dt) {
  for (const p of active()) {
    if (!(p.ko > 0)) continue;
    p.anim = 'splat';
    const mate = players.find((q) => q !== p && q.active);
    const near = mate && mate.control && mate.level === p.level && Math.hypot(mate.pos.x - p.pos.x, mate.pos.z - p.pos.z) < 1.3;
    p.revive = near ? p.revive + dt : Math.max(0, p.revive - dt * 0.5);
    p.ko -= dt;
    g.gauges.push({ pos: p.pos.clone().setY(p.pos.y + 1.3), level: p.level, k: p.revive / REVIVE, color: '#62d672', label: near ? 'DEBOUT...' : `K.O. ${Math.ceil(p.ko)}` });
    if (near && Math.random() < dt * 10) fx.sparkle(p.pos.clone().setY(p.pos.y + 0.6), '#9affa8', 1, 0.4);
    if (p.revive >= REVIVE) {
      Object.assign(p, { ko: 0, health: 40, control: true, invuln: 2, anim: 'idle' });
      sound.play('highfive');
      fx.sparkle(p.mid(), '#9affa8', 24, 0.9);
      hud.toast('DEBOUT ! AUCUNE VIE PERDUE.');
      banter(g, p, 'revived', { force: true });
    } else if (p.ko <= 0) {
      p.ko = 0;
      if (g.lives > 1) hud.showCard('ÉPUISÉ', 'MOINS UNE VIE.');
      g.loseLife(p);
      return true;
    }
  }
  return false;
}
// le rang POINDEXTER révèle un emballage (de préférence l'un de ceux qu'on a dans le sac)
function revealWrap() {
  const unknown = (list) => list.filter((t) => !g.bag.known.has(t));
  const inBags = unknown([...players[0].bag.list(), ...players[1].bag.list()].map((it) => it.type));
  const pool = inBags.length ? inBags : unknown(PRESENTS.map((p) => p.id));
  if (!pool.length) return;
  const t = pool[Math.floor(Math.random() * pool.length)];
  g.bag.known.add(t);
  setTimeout(() => hud.toast(`EMBALLAGE RÉVÉLÉ : ${PRESENT[t].name}.`, 3.5), 3600);
}
// Un terrien touche un joueur : énergie, bourrade, et parfois un effet.
g.hurt = (e, nx, nz, who = player) => {
  if (who.invuln > 0 || who.effects.wings > 0) return;
  who.invuln = 1.3;
  who.kick(nx * e.def.knock * 0.7, nz * e.def.knock * 0.7);
  sound.play(e.def.sound, { vol: 0.8 });
  // et il se moque
  setTimeout(() => sound.cry(e.type, 'rire'), 350);
  if (e.type === 'cupid') {
    who.effects.love = 6;
    sound.play('coeur');
    hud.toast('AMOUREUX ! LES COMMANDES SONT INVERSÉES.');
    return;
  }
  if (!who.say('aie', true)) sound.play('aie');
  who.emote('aie', 1);
  g.shake = 2.6;
  g.punch(0.13, 0.07);
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

// Où est un point, vu de la caméra actuelle (« EN HAUT À GAUCHE »…).
const DIRS = ['À DROITE', 'EN HAUT À DROITE', 'EN HAUT', 'EN HAUT À GAUCHE', 'À GAUCHE', 'EN BAS À GAUCHE', 'EN BAS', 'EN BAS À DROITE'];
function screenDir(from, x, z) {
  const { right, up } = pipe.axes(cam.yaw), dx = x - from.x, dz = z - from.z;
  const a = Math.atan2(dx * up.x + dz * up.z, dx * right.x + dz * right.z);
  return DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}
// Le sage connaît les secrets de l'étage : disques d'or, trésors, trou secret, surprises.
function sageHint(p) {
  const d = g.world.levels[p.level].data, out = [];
  const add = (x, z, text) => out.push({ x, z, text: text(screenDir(p.pos, x, z), Math.max(1, Math.round(Math.hypot(x - p.pos.x, z - p.pos.z)))) });
  for (const s of d.surprises || []) {
    if (s.done) continue;
    if (s.kind === 'record') add(s.x, s.z, (dir, n) => `UN DISQUE D'OR BRILLE ${dir}, À ${n} PAS.`);
    else if (s.kind === 'treasure') add(s.x, s.z, (dir, n) => `UNE CROIX DANS LE SABLE, ${dir}, À ${n} PAS.`);
    else if (s.kind === 'disco') add(s.x, s.z, (dir, n) => `ÇA DANSE ${dir}, À ${n} PAS.`);
    else if (s.kind === 'portals') add(s.a.x, s.a.z, (dir, n) => `UN PORTAIL ${dir}, À ${n} PAS. IL MÈNE AILLEURS.`);
    else if (s.kind === 'geyser') add(s.x, s.z, (dir, n) => `UN GEYSER ${dir}, À ${n} PAS. MONTE DESSUS.`);
  }
  if (d.secretHole) add(cellX(d.secretHole.i), cellX(d.secretHole.j), (dir) => `UN TROU ÉTRANGE, ${dir}. IL Y A UN ÉTAGE EN DESSOUS.`);
  if (!out.length) return null;
  const h = out[Math.floor(Math.random() * out.length)];
  (d.hints ||= []).push({ x: h.x, z: h.z });
  return h.text + ' (SUR LA CARTE)';
}

// Le sage en costume de carotte révèle ce que cache un emballage et un secret de l'étage, puis repart méditer.
function consultSage(sage, p) {
  sound.play('sage');
  sound.cry('wiseman', 'sage');
  const unknown = [...players[0].bag.list(), ...players[1].bag.list()].filter((it) => !g.bag.known.has(it.type));
  const hint = sageHint(p);
  if (unknown.length) {
    const t = unknown[Math.floor(Math.random() * unknown.length)].type;
    g.bag.known.add(t);
    hud.showCard('LE SAGE A PARLÉ', `CE PAPIER-LÀ, C'EST : ${PRESENT[t].name}.`);
    if (hint) hud.showCard('ET AUSSI...', hint);
  } else hud.showCard('LE SAGE', hint || (Math.random() < 0.5 ? "IL PARAÎT QU'IL Y A UN ÉTAGE SOUS LE PREMIER." : 'REVIENS AVEC UN MYSTÈRE.'));
  setTimeout(() => earthlings.poof(sage, fx), 1600);
}

function highFive(a, b) {
  for (const [p, q] of [[a, b], [b, a]]) { p.hiT = 0.75; p.control = false; p.faceDir(q.pos.x - p.pos.x, q.pos.z - p.pos.z); p.emote('joie', 1.5); }
  // personne n'y perd : chacun garde au moins ce qu'il avait, le plus faible remonte
  const h = Math.min(100, (a.health + b.health) / 2 + 10);
  a.health = Math.max(a.health, h); b.health = Math.max(b.health, h);
  sound.play('highfive');
  (Math.random() < 0.5 ? a : b).say('yo', true);
  fx.sparkle(a.mid().add(b.mid()).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.6, 0)), '#ffe680', 26, 0.8);
  hud.toast('HIGH FIVE ! ÉNERGIE PARTAGÉE.');
  banter(g, Math.random() < 0.5 ? a : b, 'reunion', { force: true });
}

function onPickup(p, who) {
  const pos = new THREE.Vector3(p.item.x, who.pos.y, p.item.z);
  if (p.kind === 'present' || p.kind === 'piece') who.findT = 0;
  if (p.kind === 'present') {
    who.bag.add(p.item.type);
    sound.play('cadeau_ramasse');
    who.emote('surprise', 0.8);
    tip('sac', g.coop ? 'ESPACE (TOEJAM) OU ENTRÉE (EARL) : OUVRIR LE SAC.' : 'ESPACE : OUVRIR LE SAC DE CADEAUX.');
    if (Math.random() < 0.6) who.say('cadeau');
    banter(g, who, 'present', { chance: 0.4 });
    fx.sparkle(pos, '#ff8ad8', 10, 0.6);
    hud.toast(`UN CADEAU : ${g.bag.label(p.item.type)}`);
  } else if (p.kind === 'buck') {
    g.bucks += 1;
    // les billets ramassés à la suite montent d'un cran chacun
    g.buckN = g.t - (g.buckT ?? -9) < 1.6 ? Math.min(12, (g.buckN || 0) + 1) : 0;
    g.buckT = g.t;
    sound.play('billet', { vary: 0.02, rate: 1 + g.buckN * 0.06 });
    who.emote('content', 0.6);
    fx.coins(pos, 4);
    // la série : tous les trois billets d'affilée, un billet en prime
    const n = g.buckN + 1, bonus = n % 3 === 0;
    if (bonus) { g.bucks += 1; sound.play('billet', { vary: 0, rate: 1.6, vol: 0.6 }); }
    hud.float(bonus ? `+2 SÉRIE X${n}` : n > 1 ? `+1 X${n}` : '+1', pos.clone().setY(pos.y + 1.1), who.level, bonus ? { fill: '#3affc0', line: '#1a1033' } : undefined);
    hud.bounceBucks();
  } else if (p.kind === 'food') {
    const f0 = FOOD[p.item.type], f = { ...f0, heal: f0.heal > 0 && g.has('food') ? Math.round(f0.heal * 1.2) : f0.heal };
    // un mauvais repas fait mal, mais ne tue pas
    who.health = f.heal < 0 ? Math.max(1, who.health + f.heal) : Math.min(100, who.health + f.heal);
    g.stats.eaten++;
    sound.play(f.heal > 0 ? 'manger' : 'beurk');
    who.emote(f.heal > 0 ? 'joie' : 'beurk', 1.4);
    who.say(f.heal > 0 ? 'miam' : 'beurk', f.heal <= 0);
    banter(g, who, f.heal > 0 ? 'miam' : 'beurk', { chance: f.heal > 0 ? 0.35 : 0.8 });
    hud.float(f.heal > 0 ? `+${f.heal}` : `${f.heal}`, pos.clone().setY(pos.y + 1.1), who.level, f.heal > 0 ? { fill: '#62d672', line: '#1a1033' } : { fill: '#ff4a5c', line: '#1a1033' });
    hud.toast(f.heal > 0 ? `${f.name} : +${f.heal}` : `${f.name}. BEURK. ${f.heal}`);
  } else if (p.kind === 'piece') {
    g.pieces.add(p.item.index);
    sound.play('morceau');
    sound.jingle('morceau');
    for (const q of active()) q.emote('joie', 2.5);
    setTimeout(() => active()[Math.floor(Math.random() * active().length)].say('morceau', true), 700);
    banter(g, who, 'piece', { force: true, chance: 0.6 });
    const n = g.pieces.size;
    g.addXp(20);
    hud.showCard(`MORCEAU ${n}/10`, n === 10 ? 'VAISSEAU COMPLET ! LA FUSÉE ATTEND TOUT EN HAUT.' : PIECES[p.item.index]);
    fx.sparkle(pos, '#ffe680', 30, 1.2);
    g.shake = 2;
  }
}

// --- pause et réglages ----------------------------------------------------------------------------------------
const pct = (v) => `${Math.round(v * 100)}%`;
function optionRows(inGame) {
  return [
    inGame && { id: 'resume', label: 'REPRENDRE' },
    { id: 'music', label: 'MUSIQUE', value: pct(settings.music) },
    { id: 'sfx', label: 'BRUITAGES', value: pct(settings.sfx) },
    { id: 'voices', label: 'VOIX', value: settings.voices ? 'OUI' : 'NON' },
    { id: 'quality', label: 'IMAGE', value: MODES[pipe.mode].name },
    inGame && { id: 'controls', label: 'COMMANDES' },
    inGame && { id: 'save', label: 'SAUVEGARDER' },
    inGame && { id: 'quit', label: "QUITTER (LA PARTIE EST GARDÉE)" },
    !inGame && { id: 'back', label: 'RETOUR' },
  ].filter(Boolean);
}

function optionsInput(inGame) {
  g.optRows = optionRows(inGame);
  const n = g.optRows.length;
  const up = input.hit('ArrowUp', 'KeyW'), down = input.hit('ArrowDown', 'KeyS');
  const left = input.hit('ArrowLeft', 'KeyA'), right = input.hit('ArrowRight', 'KeyD');
  const ok = input.hit('Space', 'Enter', 'NumpadEnter') || input.padHit(0) || input.padHit(0, 1);
  const close = input.hit('Escape', 'Backspace') || input.padHit(1) || input.padHit(1, 1) || input.padHit(9);
  if (up) g.optSel = (g.optSel - 1 + n) % n;
  if (down) g.optSel = (g.optSel + 1) % n;
  if (up || down) sound.play('menu_curseur');
  const row = g.optRows[g.optSel], slider = row.id === 'music' || row.id === 'sfx', dir = right || (ok && !slider) ? 1 : left ? -1 : 0;
  if (close || (ok && (row.id === 'resume' || row.id === 'back'))) { g.menu = null; sound.play('menu_ouvre', { rate: 0.8 }); return; }
  if (dir) {
    if (row.id === 'music' || row.id === 'sfx') settings[row.id] = Math.round(Math.min(1, Math.max(0, settings[row.id] + dir * 0.1)) * 10) / 10;
    else if (row.id === 'voices') settings.voices = !settings.voices;
    else if (row.id === 'quality') { pipe.setMode(pipe.mode + dir); settings.quality = pipe.mode; }
    else if (ok && row.id === 'save') { saveGame(g, players); hud.toast('PARTIE SAUVEGARDÉE.'); g.menu = null; }
    else if (ok && row.id === 'controls') { g.menu = 'controls'; g.controlsFrom = 'pause'; sound.play('menu_ouvre'); return; }
    else if (ok && row.id === 'quit') {
      saveGame(g, players);
      g.menu = null;
      for (const p of players) p.control = false;
      sound.groove(false);
      g.titleOpts = titleOptions();
      g.menuSel = 0;
      setState('title');
      return;
    }
    saveSettings();
    sound.setVolumes();
    sound.play('menu_curseur', { rate: 1.2 });
  }
  g.optRows = optionRows(inGame);
}

g.challengeSel = -1;
const defiLabel = () => (g.challengeSel < 0 ? 'DÉFI : AUCUN' : `DÉFI : ${CHALLENGES[g.challengeSel].name} X${CHALLENGES[g.challengeSel].mult}`);
const titleOptions = () => [...(hasSave() ? ['CONTINUER'] : []), 'MONDE FIXE', 'MONDE ALÉATOIRE', defiLabel(), 'CARNET', 'RÉGLAGES'];
function cycleChallenge(d) {
  const n = CHALLENGES.length + 1;
  g.challengeSel = ((g.challengeSel + 1 + d + n) % n) - 1;
  g.titleOpts = titleOptions();
  sound.play('menu_curseur', { rate: 1.2 });
}
// Reprend une partie enregistrée : la sauvegarde normale, ou le point de reprise (avec trois vies).
function resume(slot) {
  const s = loadGame(g, {
    newGame: (seed, coop) => {
      g.coop = coop;
      const p2 = players[1];
      p2.active = p2.visible = coop; p2.m.root.visible = coop;
      newGame(seed);
    },
    place: (i, ps) => {
      const p = players[i];
      if (!p.active) return;
      // jamais dans le vide (sauvegardé en plein vol, par exemple) : au pire, la terre ferme la plus proche
      const lv = g.world.levels[ps.level] ? ps.level : 0, n = g.world.type(lv, ps.x, ps.z) ? ps : g.world.nearestLand(lv, ps.x, ps.z);
      p.place(lv, n.x, n.z); p.health = ps.health;
    },
    restore: (i, ps, oldTomatoes) => {
      const p = players[i];
      if (ps.items) p.bag.items = new Map(ps.items);
      p.tomatoes = ps.tomatoes ?? oldTomatoes;
    },
  }, slot);
  if (!s) return false;
  g.challenge = CHALLENGES.find((c) => c.id === s.challenge) || null;
  // la reprise ne rembobine pas le temps de jeu (chrono du défi, bonus de temps)
  if (slot === 'checkpoint') { g.lives = 3; g.stats.time = Math.max(g.stats.time, g.lastTime || 0); }
  g.lastLevel = player.level; g.focus.copy(player.mid()); g.focusB.copy(g.focus);
  for (const p of players) p.seenLv = p.level;
  setState('intro');
  return true;
}

// --- astuces : la première fois que la situation se présente, une ligne d'explication ------------------------
g.tips = [];
g.tip = (id, text) => tip(id, text);
g.earthlings = earthlings;
g.rollPresent = () => rollPresent(Math.random);
function tip(id, text) {
  if (tipSeen(id) || g.tips.some((t) => t.id === id)) return;
  g.tips.push({ id, text });
}

function menuInput() {
  if (g.menu === 'pause') { optionsInput(true); return; }
  const up = input.hit('ArrowUp', 'KeyW'), down = input.hit('ArrowDown', 'KeyS');
  const close = input.hit('Escape', 'Backspace') || input.padHit(1) || input.padHit(1, 1);
  const ok = input.hit('Space', 'Enter', 'NumpadEnter') || input.padHit(0) || input.padHit(0, 1);
  if (up || down) sound.play('menu_curseur');
  if (close) sound.play('menu_ouvre', { rate: 0.8 });
  if (g.menu === 'map') { if (close || ok || input.hit('KeyC') || input.padHit(3)) g.menu = null; return; }
  if (g.menu === 'controls') {
    if (close || ok) { g.menu = g.controlsFrom === 'pause' ? 'pause' : null; g.controlsFrom = null; markTip('commandes'); markTip('marcher'); }
    return;
  }
  if (g.menu === 'bag') {
    const list = (g.menuOwner || player).bag.list(), n = list.length;
    if (close || !n) { if (close || ok) g.menu = null; return; }
    if (up) g.bagSel = (g.bagSel - 1 + n) % n;
    if (down) g.bagSel = (g.bagSel + 1) % n;
    g.bagSel = Math.min(g.bagSel, n - 1);
    if (ok) { g.menu = null; g.ambient.push(new GiftPop(g, list[g.bagSel].type, g.menuOwner || player)); g.addXp(3); g.stats.presents++; }
    // en coop : flèche droite (ou D) pour donner le cadeau au copain tout proche
    else if (g.coop && input.hit('ArrowRight', 'KeyD')) {
      const owner = g.menuOwner || player, mate = players.find((q) => q !== owner && q.active);
      if (mate && mate.level === owner.level && !(mate.ko > 0) && Math.hypot(mate.pos.x - owner.pos.x, mate.pos.z - owner.pos.z) < 1.6) {
        const t = list[g.bagSel].type;
        owner.bag.take(t); mate.bag.add(t);
        sound.play('cadeau_ramasse'); mate.emote('joie', 1.2);
        hud.toast(g.bag.known.has(t) ? `${PRESENT[t].name} : DONNÉ À ${NAME[mate.kind]}.` : `UN CADEAU MYSTÈRE POUR ${NAME[mate.kind]}.`);
        banter(g, mate, 'gift', { force: true, chance: 0.7 });
        if (!owner.bag.list().length) g.menu = null;
      } else hud.toast(`APPROCHE-TOI ${mate?.kind === 'earl' ? "D'EARL" : 'DE TOEJAM'} POUR LUI DONNER.`);
    }
    return;
  }
  if (g.menu === 'shop') {
    const n = g.shop.length;
    if (close) { g.menu = null; return; }
    if (up) g.shopSel = (g.shopSel - 1 + n) % n;
    if (down) g.shopSel = (g.shopSel + 1) % n;
    if (ok) {
      const t = g.shop[g.shopSel], price = g.priceOf(t);
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
  hud.showCard(levelTitle(k), g.world.levelName(k));
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
  if (input.hit('KeyP')) for (const p of PRESENTS) player.bag.add(p.id);
  if (input.hit('KeyO')) g.bucks += 10;
  if (input.hit('KeyY')) g.world.levels[player.level].data.seen.fill(1);
  if (g.state !== 'over' && input.hit('KeyR')) for (let i = 0; i < 10; i++) g.pieces.add(i);
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
  // H : comme si on n'avait rien touché depuis longtemps (le duo danse)
  if (input.hit('KeyH')) input.forceIdle(60);
}

// La jauge de funk : sur la piste, appuyer en rythme la remplit (danser sans rien faire aussi, doucement).
// Pleine : tout l'étage danse douze secondes, et la piste crache des billets et un cadeau.
g.beat = () => sound.beats() ?? (g.t * BPM) / 60;
function funkStep(s, p, hit, dt) {
  tip('funk', g.coop ? 'SUR LA PISTE : LA TOUCHE DU SAC EN RYTHME REMPLIT LA JAUGE DE FUNK !' : 'SUR LA PISTE : ESPACE EN RYTHME POUR REMPLIR LA JAUGE DE FUNK !');
  s.funk = s.funk || 0;
  if (p.grooving) s.funk += dt * 0.012;
  if (hit) {
    const b = g.beat(), off = Math.abs(b - Math.round(b)), head = p.pos.clone().setY(p.pos.y + 1.9);
    // un seul appui par temps compte
    const beat = Math.round(b), again = beat === s.lastBeat;
    if (off < 0.15 && !again) {
      s.lastBeat = beat;
      s.streak = (s.streak || 0) + 1;
      const perfect = off < 0.07, bonus = s.streak % 4 === 0;
      s.funk += (perfect ? 0.05 : 0.03) + (bonus ? 0.04 : 0);
      hud.float(bonus ? `SÉRIE X${s.streak} !` : perfect ? 'PARFAIT !' : 'FUNKY !', head, p.level, perfect || bonus ? { fill: '#3affc0', line: '#1a1033' } : undefined, 0.6);
      sound.play('menu_curseur', { rate: 1 + s.funk * 0.8, vary: 0 });
      p.emote('joie', 0.4);
    } else {
      s.streak = 0;
      s.funk = Math.max(0, s.funk - 0.08);
      hud.float('RATÉ', head, p.level, { fill: '#b9b0de', line: '#1a1033' }, 0.5);
    }
  }
  if (s.funk < 1) return;
  s.funk = 1; s.funkDone = true;
  for (const e of earthlings.list) if (e.level === p.level && !e.def.friendly) e.danceT = 12;
  // le cadeau tombe à l'écart du danseur, pour qu'on le voie ; les billets autour de la piste
  const here = active().filter((q) => q.level === p.level).map((q) => q.pos);
  const gift = g.world.scatter(p.level, s.x, s.z, 1, { minR: 1, gap: 1.4, avoid: here });
  g.world.addPresent(p.level, gift[0].x, gift[0].z, g.rollPresent());
  for (const n of g.world.scatter(p.level, s.x, s.z, 6, { minR: 0.8, gap: 0.7, avoid: [...here, ...gift] })) g.world.addBuck(p.level, n.x, n.z);
  hud.showCard('FUNK TOTAL !', "TOUT L'ÉTAGE DANSE. DOUZE SECONDES, PAS UNE DE PLUS.", true);
  sound.play('jackpot'); sound.jingle('morceau');
  fx.coins(new THREE.Vector3(s.x, p.pos.y + 0.5, s.z), 30);
  g.punch(0.15, 0.06);
  g.addXp(10);
  banter(g, p, 'funk', { force: true });
}

// Le terrien hostile le plus proche, à portée de tomate (ou de lance-pierre, qui porte plus loin), pas dans le dos.
const AIM_RANGE = 8, SLING_RANGE = 12;
function aimFor(p, range = AIM_RANGE) {
  const fx0 = Math.sin(p.heading), fz0 = Math.cos(p.heading);
  let best = null, bd = range;
  for (const e of earthlings.list) {
    if (e.def.friendly || e.level !== p.level || (e.type === 'mole' && !(e.upT > 0))) continue;
    const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d < bd && (dx * fx0 + dz * fz0) / (d || 1) > -0.2) { bd = d; best = e; }
  }
  return best;
}

// Une image de jeu : renvoie le point que la caméra doit suivre (ou null pour le duo).
function playStep(dt) {
  if (g.menu) { menuInput(); return null; }
  g.prompt = null;
  g.stats.time += dt;
  for (const p of active()) for (const k in p.effects) p.effects[k] = Math.max(0, p.effects[k] - dt);
  if (g.seq) {
    if (input.hit('Escape') || input.padHit(9)) g.pauseAfterSeq = true;
    if (g.seq.update(dt)) {
      g.seq = null;
      if (g.pauseAfterSeq && g.state === 'play') { g.pauseAfterSeq = false; g.menu = 'pause'; g.optSel = 0; g.optRows = optionRows(true); }
    }
    else return g.seq.focus();
    return null;
  }
  if (updateKO(dt)) return null;
  for (const e of earthlings.list) e.aimed = false;
  for (const [i, p] of active().entries()) {
    p.sneakK = g.has('sneak') ? 0.65 : 0.45;
    if (!p.control) continue;
    if (g.has('regen')) p.health = Math.min(100, p.health + 2 * dt);
    const L = g.world.levels[p.level];
    const A = g.coop ? COOP[i] : SOLO;
    const ev = p.update(dt, g.world, fx, input.move(A.move), cam.yaw, p.effects, A.sneak.some((c) => input.isDown(c)));
    if (p.effects.rain > 0) g.damage(2.5 * dt, p);
    // la lave brûle
    const liq = p.liquid;
    if (p.inWater && liq?.burn) {
      g.damage(liq.burn * dt, p);
      if (Math.random() < dt * 20) fx.sparkle(p.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), Math.random() < 0.5 ? '#ff6a1a' : '#ffd23f', 2, 0.4);
      if (!p.burning) { p.burning = true; p.emote('aie', 1.5); p.say('aie', true); tip('lave', 'LA LAVE, ÇA BRÛLE ! VITE, SORS DE LÀ.'); }
    } else p.burning = false;
    if (ev?.fall) {
      // l'anti-chute rattrape tout, sauf le trou secret : on y saute exprès
      g.seq = p.effects.unfall > 0 && !g.world.isHole(p.level, p.pos.x, p.pos.z) ? new UnfallSeq(g, p) : new FallSeq(g, p);
      return null;
    }
    if (ev?.elevator) { g.seq = new ElevatorSeq(g, p); return null; }
    for (const pick of g.world.collect(p.level, p.pos)) onPickup(pick, p);
    // un étage où personne n'avait encore mis les pieds (le tout premier ne compte pas)
    if (!L.data.visited) {
      L.data.visited = true;
      if (p.level !== 0 && !L.data.seen.some((v) => v)) { g.addXp(10); hud.float('+10 POINTS', p.pos.clone().setY(p.pos.y + 2.2), p.level, undefined, 1.6); }
    }
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
    const bagHit = input.hit(...A.bag) || input.padHit(0, A.pad);
    // sur la piste de disco, la touche du sac sert à danser en rythme
    const disco = p.onDisco && !p.onDisco.funkDone ? p.onDisco : null;
    if (disco) funkStep(disco, p, bagHit, dt);
    if (bagHit && !disco) {
      if (nearRocket && g.pieces.size === 10) { g.seq = new EndingSeq(g, L); return null; }
      if (nearRocket) { hud.toast(`IL MANQUE ${10 - g.pieces.size} MORCEAU${10 - g.pieces.size > 1 ? 'X' : ''}. LA FUSÉE ATTENDRA.`); return null; }
      if (sage) consultSage(sage, p);
      else if (mb) { g.menuOwner = p; openShop(); }
      // le sac s'ouvre même vide : on y lit ses points et ses billets
      else { g.menu = 'bag'; g.menuOwner = p; g.bagSel = 0; sound.play('menu_ouvre'); return null; }
    }
    // la cible de la prochaine tomate porte un anneau jaune ; le lance-pierre tire des cailloux sans compter
    const sling = p.effects.slingshot > 0;
    const aim = sling || p.tomatoes > 0 ? aimFor(p, sling ? SLING_RANGE : AIM_RANGE) : null;
    if (aim) aim.aimed = true;
    if ((input.hit(...A.tomato) || input.padHit(2, A.pad)) && (sling || p.tomatoes > 0)) {
      if (sling) tomatoes.throw(p, aim?.pos || null, 'rock');
      else { p.tomatoes--; tomatoes.throw(p, aim?.pos || null); }
    }
  }
  // la boussole : vers le morceau de l'étage (ou l'ascenseur), après un moment sans rien trouver
  g.compass = [];
  for (const [i, p] of active().entries()) {
    if (!p.control) continue;
    p.findT = (p.findT || 0) + dt;
    if (!(g.has('radar') || p.findT > 25)) continue;
    const d = g.world.levels[p.level].data;
    let to = null, kind = 'piece';
    if (d.piece && !d.piece.taken) to = d.piece;
    else if (d.rocket) { to = d.rocket; kind = 'rocket'; }
    else if (d.elevator) { to = { x: cellX(d.elevator.i), z: cellX(d.elevator.j) }; kind = 'elevator'; }
    if (to && Math.hypot(to.x - p.pos.x, to.z - p.pos.z) > 2.5) {
      g.compass.push({ p, view: g.split ? i : 0, to: new THREE.Vector3(to.x, p.pos.y, to.z), kind });
      tip('boussole', "LA FLÈCHE MONTRE LE MORCEAU DE L'ÉTAGE (OU L'ASCENSEUR).");
    }
  }
  if (input.hit('KeyC') || input.padHit(3) || input.padHit(3, 1)) {
    if (g.challenge?.id === 'carte') hud.toast('DÉFI SANS CARTE : DE MÉMOIRE !');
    else { g.menu = 'map'; sound.play('carte'); }
  }
  // contre la montre : vingt minutes pour rentrer
  if (g.challenge?.time && g.stats.time >= g.challenge.time) { gameOver('LE TEMPS EST ÉCOULÉ.'); return null; }
  if (input.hit('Escape') || input.padHit(9) || input.padHit(9, 1)) { g.menu = 'pause'; g.optSel = 0; g.optRows = optionRows(true); sound.play('menu_ouvre'); return null; }
  // astuces du tutoriel, selon ce qui arrive
  for (const p of active()) {
    const bp = g.world.boothPos(p.level);
    if (bp && Math.hypot(p.pos.x - bp.x, p.pos.z - bp.z) < 5) tip('ascenseur', "L'ASCENSEUR MÈNE À L'ÉTAGE DU DESSUS.");
    if (p.anim === 'teeter') tip('vide', "GARE AU VIDE : ON RETOMBE À L'ÉTAGE DU DESSOUS.");
  }
  if (earthlings.list.some((e) => e.state === 'chase' && !e.def.friendly)) tip('psst', 'MAJ : SUR LA POINTE DES PIEDS, ON TE REMARQUE MOINS.');
  if (players[0].tomatoes > 0) tip('tomates', g.coop ? 'TOMATES : F (TOEJAM), MAJ DROITE (EARL). VISÉE AUTO.' : 'F : LANCER UNE TOMATE (VISÉE AUTOMATIQUE).');
  if (g.coop && players[1].tomatoes > 0) tip('tomates2', 'EARL : MAJ DROITE POUR LANCER UNE TOMATE.');
  if (g.stats.time > 40 && g.challenge?.id !== 'carte') tip('carte', "C : LA CARTE DE L'ÉTAGE.");
  if (g.stats.time > 25) tip('pause', 'ÉCHAP : PAUSE, RÉGLAGES ET SAUVEGARDE.');
  if (!(hud.msg && hud.msg.t > 0) && !hud.card && g.tips.length) { const t = g.tips.shift(); hud.toast(t.text, 4); markTip(t.id); }
  // sauvegarde automatique : à chaque nouvel étage, et toutes les 30 secondes
  g.saveT = (g.saveT || 0) + dt;
  if (g.saveT > 30) { g.saveT = 0; saveGame(g, players); }
  // côte à côte, le duo reprend des forces
  if (g.coop) {
    const [a, b] = players;
    if (a.level === b.level && Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 1.4) {
      for (const p of players) p.health = Math.min(100, p.health + 3 * dt);
      if (Math.random() < 0.04) fx.sparkle(new THREE.Vector3((a.pos.x + b.pos.x) / 2, a.pos.y + 1.6, (a.pos.z + b.pos.z) / 2), '#ff8ad8', 2, 0.4);
    }
  }
  // en arrivant sur un nouvel étage, un mot sur le paysage
  for (const p of active()) {
    if (p.seenLv === undefined) p.seenLv = p.level;
    if (p.level !== p.seenLv && p.control) {
      p.findT = 0;
      if (p.level > p.seenLv) setTimeout(() => banter(g, p, 'biome', { extra: g.world.levels[p.level]?.data.biome?.name, chance: 0.7, force: true }), 1400);
      p.seenLv = p.level;
    }
  }
  g.maxLv = Math.max(g.maxLv || 1, ...active().map((p) => Math.min(25, p.level + 1)));
  if (player.level !== g.lastLevel) {
    g.lastLevel = player.level;
    // tous les cinq étages, un point de reprise (sauf en défi « une seule vie »)
    if (player.level > 0 && player.level % 5 === 0 && player.level > (g.cpLevel ?? -1) && g.challenge?.id !== 'vie') {
      g.cpLevel = player.level;
      saveGame(g, players, 'checkpoint');
      const lv = player.level + 1;
      setTimeout(() => { if (g.state === 'play') hud.toast(`POINT DE REPRISE : NIVEAU ${lv}.`, 3); }, 2500);
    }
    saveGame(g, players);
    noteProgress();
    if (player.level === LEVELS - 1) {
      const miss = 10 - g.pieces.size;
      hud.toast(miss ? `LA FUSÉE EST LÀ. IL MANQUE ${miss} MORCEAU${miss > 1 ? 'X' : ''}.` : 'LA FUSÉE EST PRÊTE. FONCEZ !');
    }
  }
  return null;
}

// Ciel (dégradé, nébuleuses, trou noir) pour une hauteur donnée, en étages.
function sky(lv) {
  // Gargantua se dévoile en montant vers le dernier étage, et s'efface au-delà, vers Funkotron
  pipe.skyU.uBH.value = THREE.MathUtils.smoothstep(lv, LEVELS - 1.8, LEVELS - 1) * (1 - THREE.MathUtils.smoothstep(lv, LEVELS - 0.7, LEVELS - 0.1));
  const P = g.world.pal;
  pipe.skyU.uTop.value.copy(P.skyTop); pipe.skyU.uBot.value.copy(P.skyBot);
  pipe.skyU.uNeb1.value.copy(P.neb1); pipe.skyU.uNeb2.value.copy(P.neb2);
}

// Visibilité pour une vue : k = étage montré (null : tout ce qui est visible d'habitude).
function showView(k) {
  earthlings.showLevel(k);
  for (const p of players) for (const o of [p.m.root, p.bangMesh, p.fallShadow, p.gear.rain]) o.visible = o.userData.vis && (k === null || p.level === k);
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
  if (a.level !== b.level) {
    // deux étages : en isométrique, l'un peut se trouver pile « derrière » l'autre à l'écran ; on coupe donc
    // à la verticale, et chaque caméra se décale à l'horizontale pour centrer son joueur dans sa moitié
    // ToeJam toujours à gauche, Earl à droite, comme leurs compteurs : les moitiés ne s'échangent plus
    const s = 1, off = (cam.view * (pipe.TW / pipe.TH)) / 4;
    g.split = { x: s, y: 0 };
    return [pa.clone().addScaledVector(right, s * off), pb.clone().addScaledVector(right, -s * off)];
  }
  if (L <= D) return [mid, mid];
  g.split = { x: dr / L, y: du / L };
  return [pa.clone().addScaledVector(d, D / 2 / L), pb.clone().addScaledVector(d, -D / 2 / L)];
}

function step(dt) {
  // coup au but : quelques images au ralenti
  if (g.stopT > 0) { g.stopT -= dt; dt *= 0.15; }
  g.zoomK = (g.zoomK || 0) * Math.exp(-dt * 9);
  g.gauges = [];
  g.t += dt; g.stateT += dt;
  if (DEBUG) debugKeys();
  if (input.hit('KeyL')) { hud.toast(pipe.setMode(pipe.mode + 1)); settings.quality = pipe.mode; saveSettings(); }

  let target = player.mid();
  if (g.state === 'title') {
    // la caméra flâne au-dessus du premier étage
    const s = g.world.levels[0].data.start;
    target = new THREE.Vector3(cellX(s.i) + Math.sin(g.t * 0.13) * 4, 0.6, cellX(s.j) + Math.sin(g.t * 0.09) * 3);
    for (const p of players) p.anim = 'idle';
    cam.yawT += dt * 0.12;
    g.titleOpts ||= titleOptions();
    if (g.menu === 'reglages') optionsInput(false);
    else if (g.menu === 'carnet') { if (input.start() || input.hit('Escape', 'Backspace') || input.padHit(1)) { g.menu = null; sound.play('menu_ouvre', { rate: 0.8 }); } }
    else {
      const n = g.titleOpts.length;
      if (input.hit('ArrowUp', 'KeyW')) { g.menuSel = (g.menuSel - 1 + n) % n; sound.play('menu_curseur'); }
      if (input.hit('ArrowDown', 'KeyS')) { g.menuSel = (g.menuSel + 1) % n; sound.play('menu_curseur'); }
      const onDefi = g.titleOpts[g.menuSel]?.startsWith('DÉFI');
      const left = input.hit('ArrowLeft', 'KeyA'), right = input.hit('ArrowRight', 'KeyD');
      if (onDefi && (left || right)) cycleChallenge(left ? -1 : 1);
      else if (left || right) {
        g.coop = !g.coop; sound.play('menu_curseur');
        const p2 = players[1];
        p2.active = p2.visible = g.coop; p2.m.root.visible = g.coop;
      }
      if (input.start()) {
        const opt = g.titleOpts[g.menuSel];
        if (opt === 'RÉGLAGES') { g.menu = 'reglages'; g.optSel = 0; g.optRows = optionRows(false); sound.play('menu_ouvre'); }
        else if (opt === 'CARNET') { g.menu = 'carnet'; sound.play('menu_ouvre'); }
        else if (opt.startsWith('DÉFI')) cycleChallenge(1);
        else if (opt === 'CONTINUER') {
          if (!resume('game')) { g.titleOpts = titleOptions(); g.menuSel = 0; }
        } else {
          // les défis ne valent que pour le monde aléatoire
          g.challenge = opt === 'MONDE ALÉATOIRE' && g.challengeSel >= 0 ? CHALLENGES[g.challengeSel] : null;
          clearCheckpoint();
          newGame(opt === 'MONDE FIXE' ? FIXED : randomCode());
          note((c) => { c.games++; });
          // nouvelle partie : l'intro (le crash), puis on se pose au niveau 1
          g.cine = new IntroCine(g);
          setState('cine');
        }
      }
    }
  } else if (g.state === 'cine') {
    target = g.cine.update(dt);
    if (input.hit('Enter', 'NumpadEnter', 'Space', 'Escape') || input.padHit(0) || input.padHit(9)) g.cine.skip();
    if (g.cine.done) { g.cine = null; g.afterCine = true; setState('intro'); }
  } else if (g.state === 'intro') {
    // la caméra rejoint ToeJam, l'iris se referme sur lui, puis se rouvre
    const T = g.stateT;
    if (T < 0.6) target = g.focus.clone().lerp(player.mid(), Math.min(1, dt * 6));
    if (T >= 0.6 && T < 1.1) g.iris(player.mid(), Math.max(0, (1 - easeInCubic((T - 0.6) / 0.5)) * pipe.TW));
    else if (T >= 1.1 && T < 1.35) g.iris(player.mid(), 0);
    else if (T >= 1.35 && T < 2.1) {
      if (!g.cardShown) { g.cardShown = true; hud.showCard(levelTitle(player.level), g.world.levelName(player.level)); hud.hint = player.level === 0 ? 10 : 0; }
      g.iris(player.mid(), easeOutBack((T - 1.35) / 0.75) * pipe.TW * 0.75);
    } else if (T >= 2.1) {
      g.iris(null);
      for (const p of active()) p.control = true;
      setState('play');
      g.afterCine = false;
      player.say('yo', true);
      // toute première partie : le carton des commandes, le temps de le lire
      if (!tipSeen('commandes')) g.menu = 'controls';
      else tip('marcher', g.coop ? 'TOEJAM : ZQSD   EARL : FLÈCHES   A/E : CAMÉRA' : 'ZQSD : MARCHER   A/E : TOURNER LA CAMÉRA');
    }
  } else if (g.state === 'over') {
    if (g.stateT > 1.5 && g.cpOffer != null && input.hit('KeyR')) { resume('checkpoint'); }
    else if (g.stateT > 1.5 && input.start()) { clearCheckpoint(); newGame(g.seedCode); setState('intro'); }
    else if (g.stateT > 1.5 && (input.hit('Escape', 'Backspace') || input.padHit(1))) {
      newGame(g.seedCode); g.titleOpts = titleOptions(); g.menuSel = 0; setState('title');
    }
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
  // les leurres en carton
  if (!g.menu && g.decoys?.length) g.decoys = g.decoys.filter((d) => !d.update(dt));
  tomatoes.update(g.menu ? 0 : dt, g.world, fx, (pos, t) => {
    // le copain : ça tache, ça bouscule un peu, ça ne fait pas mal
    for (const q of active()) {
      if (q === t.owner || q.level !== t.level || !q.visible) continue;
      if (Math.hypot(q.pos.x - pos.x, q.pos.z - pos.z) < 0.55 && Math.abs(q.pos.y + 0.7 - pos.y) < 0.9) {
        q.kick(t.vx * 0.15, t.vz * 0.15); q.emote('aie', 0.8);
        sound.play('tomate_splat', { vol: 0.8 });
        fx.sparkle(pos, '#e8281f', 8, 0.4);
        hud.float('AÏE !', q.pos.clone().setY(q.pos.y + 1.7), q.level, RED);
        banter(g, q, 'friendly', { force: true, chance: 0.8 });
        return true;
      }
    }
    const e = earthlings.hit(pos);
    if (!e) return false;
    // rang BRO : la tomate éclabousse aussi le voisin
    const hit = [e];
    if (g.has('splat')) {
      const e2 = earthlings.list.find((o) => o !== e && o.level === e.level && !o.def.friendly && (o.type !== 'mole' || o.upT > 0) && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 1.8);
      if (e2) hit.push(e2);
    }
    for (const x of hit) {
      earthlings.poof(x, fx);
      hud.float(t.kind === 'rock' ? 'BING !' : 'SPLAT !', x.pos.clone().setY(x.pos.y + 1.2), x.level, RED, 1);
      g.addXp(2);
      g.stats.chased++;
      // rang RAPMASTER : un billet par terrien chassé
      if (g.has('bounty')) { g.bucks++; hud.float('+1', x.pos.clone().setY(x.pos.y + 1.7), x.level); hud.bounceBucks(); }
    }
    g.punch(0.1, 0.05);
    g.shake = Math.max(g.shake, 1.2);
    if (!e.loot?.length) hud.toast(hit.length > 1 ? 'DEUX POUR LE PRIX D\'UNE !' : `${e.def.name} DÉGUERPIT.`);
    return true;
  });
  // les terriens vivent sur l'étage du duo
  if (g.world && !g.seq) earthlings.sync(g.world, active().map((p) => p.level));
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
  const viewH = cam.view * (1 - g.zoomK);
  pipe.aim(g.focus, cam.yaw, viewH, shake, 0);

  // trou de visibilité : autour du joueur de chaque vue, ou de la cabine quand elle voyage
  g.hole += (g.holeR - g.hole) * Math.min(1, dt * 8);
  const holeFor = (pos, view) => { const hp = pipe.project(pos, view); return { x: hp.x, y: hp.y, z: hp.z, r: (g.hole / pipe.pxs) * pipe.ss }; };
  const actorA = g.seq?.holeActor?.()?.pos || (g.split ? players[0].mid() : g.coop && players[1].active ? g.focus.clone() : player.mid());
  // le niveau 0 reste invisible tant qu'on ne s'y rend pas
  g.world.showSecret = active().some((p) => p.level === -1) || g.seq?.to === -1 || g.seq?.L?.k === -1;
  g.world.update(dt, g.t, g.split ? [g.focus, g.focusB] : [g.focus]);
  g.world.view(g.focus, holeFor(actorA, 0));
  const top = g.world.levels[LEVELS - 1];
  if (top.rocket) setRocketPieces(top.rocket, g.pieces);

  // les surprises de l'étage (disco, geysers, portails, trésors, étoiles filantes, disques d'or)
  for (const p of players) p.onDisco = false;
  if (g.world && g.state === 'play') surprises.update(g.menu ? 0 : dt, g);

  // high five : quand le duo se retrouve après s'être éloigné, on se tape dans la main et on partage l'énergie
  if (g.coop && g.state === 'play' && !g.menu && !g.seq) {
    const [a, b] = players;
    if (a.active && b.active && a.level === b.level) {
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
      if (d > 6) g.apart = true;
      if (g.apart && d < 1.2 && a.control && b.control) { g.apart = false; highFive(a, b); }
    }
  }
  for (const p of active()) if (p.hiT > 0) { p.hiT -= dt; p.anim = 'highfive'; if (p.hiT <= 0) { p.hiT = 0; p.control = true; } }

  // personne ne touche aux commandes : ceux qui attendent sans rien faire se mettent à danser, et le groove monte
  const idle = g.state === 'play' && !g.menu && !g.seq && input.idle() > GROOVE_AFTER;
  const dancers = active().filter((p) => p.control && p.anim === 'idle' && !p.burning && !p.inWater && (idle || p.onDisco));
  sound.groove(dancers.length > 0 || !!g.discoOn);
  if (dancers.length && !g.grooveT) { const d = dancers[Math.floor(Math.random() * dancers.length)]; d.say('funky', true); banter(g, d, 'groove', { chance: 0.5 }); }
  g.grooveT = dancers.length ? (g.grooveT || 0) + dt : 0;
  const beats = sound.beats() ?? (g.grooveT * BPM) / 60;
  for (const p of dancers) { p.anim = 'groove'; p.m.beats = beats; }
  for (const p of players) p.grooving = dancers.includes(p);

  for (const p of players) {
    const on = p.active || p.cineOn;
    p.m.root.visible = on && p.visible;
    if (!on) { p.bangMesh.visible = false; p.fallShadow.visible = false; p.gear.rain.visible = false; continue; }
    if (!g.menu) p.animate(dt);
    p.sync(fx, dt);
  }
  // l'air du biome : neige, feuilles, sable, lucioles, braises…
  if (g.world && g.state !== 'title' && !g.menu) {
    fx.ambient(g.world.levels[player.level]?.data.biome?.particles, g.focus, dt);
    if (g.split) fx.ambient(g.world.levels[players[1].level]?.data.biome?.particles, g.focusB, dt * 0.6);
  }
  fx.update(g.menu ? 0 : dt);
  pipe.skyU.uTime.value = g.t;
  const lv = g.focus.y / GAP;
  sky(lv);
  // sons : musique selon l'étage, boucles des pouvoirs
  if (g.state !== 'cine') sound.playMusic(g.state === 'intro' ? (g.afterCine ? 'intro' : musicForLevel(Math.round(lv))) : g.state === 'title' ? 'titre' : g.state === 'credits' ? 'funkotron' : g.state === 'over' ? null : musicForLevel(Math.round(lv)));
  const live = g.state === 'play' && !g.menu;
  const any = (k, extra = () => true) => active().some((p) => p.control && p.effects[k] > 0 && extra(p));
  sound.loop('patins', live && any('rocket', (p) => Math.hypot(p.vx, p.vz) > 0.5));
  sound.loop('ailes', live && any('wings'));
  sound.loop('pluie', live && any('rain'));

  // les bords du vide s'allument près des joueurs qui marchent
  players.forEach((p, i) => {
    const on = p.active && p.control && g.state === 'play' && p.level >= 1;
    edgeU.uP.value[i].set(p.pos.x, on ? p.ground ?? p.pos.y : -999, p.pos.z);
  });
  // deux étages différents : chaque moitié d'écran ne montre que ce qui est sur le sien
  const apart = g.split && players[0].level !== players[1].level && !g.seq;
  for (const p of players) for (const o of [p.m.root, p.bangMesh, p.fallShadow, p.gear.rain]) o.userData.vis = o.visible;
  showView(apart ? players[0].level : null);
  pipe.renderView(scene, 0);
  if (g.split) {
    pipe.aim(g.focusB, cam.yaw, viewH, shake, 1);
    g.world.view(g.focusB, holeFor(players[1].mid(), 1));
    sky(g.focusB.y / GAP);
    showView(apart ? players[1].level : null);
    pipe.renderView(scene, 1);
    sky(lv);
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
if (DEBUG) console.log('Funkotron Remix — test : 0-9 / Page ↑↓ étage, G chute, T ascenseur, I îlot secret, U fusée, R tous les morceaux, J Earl, H danse, P cadeaux, O billets, Y carte, K couleurs MD');
