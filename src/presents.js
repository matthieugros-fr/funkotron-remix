// Le sac de cadeaux : ce qu'on possède, les emballages déjà reconnus, et ce que fait chaque cadeau.
import { PRESENTS, PRESENT } from './catalog.js';
import { mulberry } from './rng.js';
import { sound } from './audio.js';
import { presentModel } from './pickups.js';

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
  g.hud.showCard(p.name + (first ? ' !' : ''), first ? p.sub : '');
  sound.play('cadeau_ouvre');
  who.emote?.(type === 'bummer' ? 'colere' : 'surprise', 1.2);
  if (type === 'bummer') setTimeout(() => who.say?.('piege', true), 500);
  const extra = { bummer: 'bummer', life: 'vie', jackpot: 'jackpot' }[type];
  if (extra) setTimeout(() => sound.play(extra), 450);
  const pl = who, e = who.effects;
  switch (type) {
    case 'rocket': case 'wings': case 'spring': case 'hitops': case 'rain':
      e[type] = p.dur;
      if (type === 'rocket') { pl.vx = 0; pl.vz = 0; }
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
    case 'life': g.lives += 1; break;
    case 'telescope': g.world.levels[pl.level].data.seen.fill(1); break;
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
