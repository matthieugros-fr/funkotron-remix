// Le sac de cadeaux : ce qu'on possède, les emballages déjà reconnus, et ce que fait chaque cadeau.
import { PRESENTS, PRESENT } from './catalog.js';
import { mulberry } from './rng.js';
import { sound } from './audio.js';

export class Bag {
  constructor(seed) {
    this.items = new Map();          // type -> nombre
    this.known = new Set();          // types dont on a déjà ouvert un exemplaire
    this.shuffle(seed);
  }

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
  g.bag.take(type);
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
    case 'tomatoes': g.tomatoes += 10; break;
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
