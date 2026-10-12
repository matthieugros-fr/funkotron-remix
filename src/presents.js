// Le sac de cadeaux : ce qu'on possède, les emballages déjà reconnus, et ce que fait chaque cadeau.
import * as THREE from 'three';
import { PRESENTS, PRESENT, RANKS, rankOf } from './catalog.js';
import { GAP, SIZE, BLOCK } from './config.js';
import { T, cellX, toCell } from './gen.js';
import { mulberry } from './rng.js';
import { sound } from './audio.js';
import { presentModel } from './pickups.js';
import { topOf } from './terrain3d.js';
import { buildToeJam, buildEarl } from './toejam3d.js';

// En coop, chacun a son sac ; les papiers cadeaux et ce qu'on a reconnu sont communs (« share »).
export class Bag {
  constructor(seed, share = null) {
    this.items = new Map();          // type -> nombre
    if (share) this.shared = share.shared;
    else { this.shared = { known: new Set(), wrapOf: null }; this.shuffle(seed); }
  }

  get known() { return this.shared.known; }       // types dont on a déjà ouvert un exemplaire
  set known(v) { this.shared.known = v; }
  get wrapOf() { return this.shared.wrapOf; }
  set wrapOf(v) { this.shared.wrapOf = v; }

  // Chaque partie attribue les papiers cadeaux au hasard ; le Randomiseur recommence.
  shuffle(seed) {
    const r = mulberry(seed), idx = PRESENTS.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    this.wrapOf = Object.fromEntries(PRESENTS.map((p, i) => [p.id, idx[i]]));
  }

  add(type, n = 1) { this.items.set(type, (this.items.get(type) || 0) + n); }
  take(type) {
    const n = this.items.get(type) || 0;
    if (n <= 1) this.items.delete(type); else this.items.set(type, n - 1);
  }
  list() { return PRESENTS.filter((p) => this.items.has(p.id)).map((p) => ({ type: p.id, count: this.items.get(p.id) })); }
  label(type) { return this.known.has(type) ? PRESENT[type].name : '???'; }
}

// Ouvre un cadeau : renvoie ce que le jeu doit faire (effet minuté, action immédiate).
export function openPresent(g, type, who = g.player) {
  const p = PRESENT[type], first = !g.bag.known.has(type);
  g.bag.known.add(type);
  (who.bag || g.bag).take(type);
  g.hud.showCard(p.name + (first ? ' !' : ''), first ? p.sub : '', true);
  sound.play('cadeau_ouvre');
  who.emote?.(type === 'bummer' ? 'colere' : type === 'earthling' ? 'peur' : 'surprise', 1.2);
  if (type === 'bummer' || type === 'earthling') setTimeout(() => who.say?.('piege', true), 500);
  const extra = { bummer: 'bummer', life: 'vie', jackpot: 'jackpot', sundae: 'manger' }[type];
  if (extra) setTimeout(() => sound.play(extra), 450);
  const pl = who, e = who.effects;
  switch (type) {
    case 'rocket': case 'wings': case 'spring': case 'hitops': case 'rain':
    case 'innertube': case 'slingshot': case 'rosebush': case 'unfall':
      e[type] = p.dur;
      if (type === 'rocket') { pl.vx = 0; pl.vz = 0; }
      if (type === 'slingshot') g.tip?.('lancepierre', g.coop && who === g.players[1] ? 'LANCE-PIERRE : MAJ DROITE, CAILLOUX À VOLONTÉ.' : 'LANCE-PIERRE : F, CAILLOUX À VOLONTÉ.');
      break;
    case 'decoy': {
      // un seul leurre par joueur : le nouveau remplace l'ancien
      for (const d of g.decoys || []) if (d.owner === who) d.remove();
      g.decoys = (g.decoys || []).filter((d) => d.alive);
      g.decoys.push(new Decoy(g, who, p.dur));
      e.decoy = p.dur;
      break;
    }
    case 'promotion':
      // l'annonce du rang passe après celle du cadeau
      setTimeout(() => {
        const next = RANKS[rankOf(g.xp) + 1];
        if (next) g.addXp(next.xp - g.xp);
        else g.hud.toast("DÉJÀ FUNK LORD. AU-DESSUS, IL N'Y A QUE LE CIEL.", 3);
      }, 900);
      break;
    case 'earthling': g.surpriseEarthling?.(who); break;
    case 'sundae':
      who.health = 100;
      g.hud.float('+100', pl.pos.clone().setY(pl.pos.y + 1.9), pl.level, { fill: '#62d672', line: '#1a1033' });
      break;
    case 'tomatoes': who.tomatoes = (who.tomatoes || 0) + 10; break;
    case 'bummer': g.loseLife(who); break;
    case 'random':
      g.bag.shuffle(Math.floor(Math.random() * 1e9));
      g.bag.known.clear();
      g.world.refreshWraps(g.bag);
      break;
    case 'door': g.teleport(who); break;
    case 'jackpot': {
      const n = 5 + Math.floor(Math.random() * 6);
      g.bucks += n;
      g.fx.coins(pl.pos, n * 2);
      break;
    }
    case 'life':
      // en défi « une seule vie », la vie en plus se change en billets
      if (g.challenge?.id === 'vie') { g.bucks += 5; g.hud.toast('UNE SEULE VIE, C\'EST LA RÈGLE. 5 BILLETS À LA PLACE.', 3); }
      else g.lives += 1;
      break;
    case 'telescope': g.world.revealAll(pl.level); break;
    case 'telephone': {
      // on t'indique quelques cases de la carte : l'ascenseur, le morceau du vaisseau, puis au hasard
      const d = g.world.levels[pl.level].data, B = BLOCK, want = [];
      const blockOf = (x, z) => [Math.floor(toCell(x) / B), Math.floor(toCell(z) / B)];
      if (d.elevator) want.push(blockOf(cellX(d.elevator.i), cellX(d.elevator.j)));
      if (d.piece && !d.piece.taken) want.push(blockOf(d.piece.x, d.piece.z));
      for (let k = 0; k < 40 && want.length < 7; k++) want.push([Math.floor(Math.random() * (SIZE / B)), Math.floor(Math.random() * (SIZE / B))]);
      for (const [bi, bj] of want) g.world.revealBlock(d, bi, bj);
      sound.play('boite');
      setTimeout(() => g.hud.toast('LA CARTE (M) EN SAIT PLUS.', 3), 900);
      break;
    }
    case 'boombox':
      // tous les terriens des environs dansent (comme sur la piste de disco)
      for (const en of g.earthlings?.list || []) {
        if (en.level === pl.level && !en.def.friendly && Math.hypot(en.pos.x - pl.pos.x, en.pos.z - pl.pos.z) < 12) en.danceT = 10;
      }
      sound.play('promotion');
      break;
    case 'rootbeer':
      who.health = Math.min(100, who.health + 40);
      g.hud.float('+40', pl.pos.clone().setY(pl.pos.y + 1.9), pl.level, { fill: '#62d672', line: '#1a1033' });
      break;
    case 'extrabuck': g.bucks += 1; g.fx.coins(pl.pos, 2); break;
    case 'togetherness': {
      // en duo, le copain arrive aussitôt ; seul, on garde au moins l'équilibre un moment
      const mate = g.players?.find((q) => q !== who && q.active);
      if (mate) g.bringTogether?.(who, mate);
      else { e.unfall = Math.max(e.unfall || 0, 30); g.hud.toast("PERSONNE AVEC QUI ÊTRE ENSEMBLE. TU NE TOMBERAS PAS, AU MOINS.", 3.5); }
      break;
    }
    case 'schoolbook': case 'tomrain': e[type] = p.dur; break;
  }
}

// Ouvrir un cadeau, en scène : le paquet jaillit au-dessus de la tête, tourne, éclate en étincelles, puis l'effet.
export class GiftPop {
  constructor(g, type, who) {
    this.g = g; this.type = type; this.who = who; this.t = 0;
    const L = g.world.levels[who.level];
    this.m = presentModel(L.mats, g.bag.wrapOf[type]);
    this.m.scale.setScalar(0.6);
    g.scene.add(this.m);
    who.control = false; who.anim = 'idle'; who.invuln = Math.max(who.invuln, 0.8);
    who.emote?.('surprise', 1);
    sound.play('cadeau_ramasse', { rate: 1.3 });
    this.place(0);
  }
  place(k) {
    const w = this.who, h = (w.H || 1.2) + 0.15 + Math.sin(Math.min(1, k) * Math.PI * 0.5) * 0.7;
    this.m.position.set(w.pos.x, w.pos.y + h, w.pos.z);
    this.m.rotation.y = k * 9;
    this.m.scale.setScalar(0.6 + 0.35 * Math.sin(Math.min(1, k) * Math.PI));
  }
  update(dt) {
    this.t += dt;
    const T = 0.5, k = this.t / T;
    this.place(k);
    if (k < 1) return false;
    const g = this.g, w = this.who;
    g.scene.remove(this.m);
    this.m.traverse((o) => o.geometry?.dispose());
    g.fx.sparkle(this.m.position.clone(), '#ffe680', 22, 0.9);
    g.fx.sparkle(this.m.position.clone(), '#ff8ad8', 12, 0.7);
    g.punch?.(0.12, 0.05);
    w.control = true;
    openPresent(g, this.type, w);
    return true;
  }
}

// Le leurre : un ToeJam (ou un Earl) en carton, planté au sol ; les terriens n'ont d'yeux que pour lui.
const cardboard = new THREE.MeshLambertMaterial({ color: '#b98a52' });
export class Decoy {
  constructor(g, who, life) {
    this.g = g; this.owner = who; this.level = who.level; this.life = life; this.t = 0; this.hitT = 0;
    this.decoy = true; this.alive = true; this.vx = 0; this.vz = 0; this.H = who.H;
    // un pas devant soi, sur la terre ferme (sinon à ses pieds)
    const w = g.world, h = who.heading;
    let x = who.pos.x + Math.sin(h) * 0.9, z = who.pos.z + Math.cos(h) * 0.9, ty = w.type(who.level, x, z);
    if (!ty || ty === T.WATER) { x = who.pos.x; z = who.pos.z; ty = w.type(who.level, x, z); }
    this.pos = new THREE.Vector3(x, who.level * GAP + topOf(ty), z);
    // la silhouette du héros, aplatie comme une planche, sur son chevalet
    const m = (this.model = who.kind === 'earl' ? buildEarl() : buildToeJam());
    m.root.scale.set(1, 1, 0.12);
    m.stars.visible = false;
    const grp = (this.grp = new THREE.Group());
    grp.add(m.root);
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.05), cardboard);
    brace.position.set(0, 0.42, -0.22); brace.rotation.x = -0.45;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.5), cardboard);
    base.position.set(0, 0.02, -0.08);
    grp.add(brace, base);
    grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    grp.position.copy(this.pos);
    grp.rotation.y = h;
    grp.scale.set(1, 0.01, 1);
    g.scene.add(grp);
    g.fx.dust(this.pos, 12, ['#d8b07a', '#b98a52', '#ffffff']);
    sound.play('poof', { rate: 1.3 });
  }

  // un terrien lui tombe dessus : le carton vacille
  hit() {
    if (this.hitT > 0.2) return;
    this.hitT = 0.7;
    this.g.fx.dust(this.pos, 8, ['#d8b07a', '#b98a52']);
    this.g.hud.float('PAF !', this.pos.clone().setY(this.pos.y + 1.7), this.level, { fill: '#d8b07a', line: '#1a1033' }, 0.7);
  }

  // renvoie vrai quand il a disparu
  update(dt) {
    if (!this.alive) return true;
    this.t += dt; this.life -= dt; this.hitT = Math.max(0, this.hitT - dt);
    const grow = Math.min(1, this.t / 0.25), shrink = Math.min(1, Math.max(0, this.life / 0.3));
    this.grp.scale.set(1, Math.max(0.01, grow * shrink), 1);
    this.grp.rotation.x = Math.sin(this.t * 30) * this.hitT * 0.35;
    if (this.life <= 0) {
      this.g.fx.dust(this.pos, 14, ['#d8b07a', '#b98a52', '#ffffff']);
      sound.play('poof', { vol: 0.7 });
      this.remove();
      return true;
    }
    return false;
  }

  remove() {
    if (!this.alive) return;
    this.alive = false;
    this.g.scene.remove(this.grp);
    this.grp.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); // les matières sont partagées : on les garde
    if (this.owner.effects) this.owner.effects.decoy = 0;
  }
}
