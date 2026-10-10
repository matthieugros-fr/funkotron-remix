// Interface en police bitmap 5 × 7 maison, dessinée en gros pixels : menu titre, compteurs,
// sac de cadeaux, carte, boîte aux lettres, cartons de niveau.
import { easeOutBounce, easeInBack } from './util.js';
import { PRESENT, WRAPS } from './catalog.js';
import { WRAP_CANVAS } from './pickups.js';
import { SIZE } from './config.js';
import { T, toCell } from './gen.js';

const RAW = {
  A: '0E 11 11 1F 11 11 11', B: '1E 11 11 1E 11 11 1E', C: '0E 11 10 10 10 11 0E', D: '1E 11 11 11 11 11 1E',
  E: '1F 10 10 1E 10 10 1F', F: '1F 10 10 1E 10 10 10', G: '0E 11 10 17 11 11 0F', H: '11 11 11 1F 11 11 11',
  I: '0E 04 04 04 04 04 0E', J: '07 02 02 02 02 12 0C', K: '11 12 14 18 14 12 11', L: '10 10 10 10 10 10 1F',
  M: '11 1B 15 15 11 11 11', N: '11 19 15 13 11 11 11', O: '0E 11 11 11 11 11 0E', P: '1E 11 11 1E 10 10 10',
  Q: '0E 11 11 11 15 12 0D', R: '1E 11 11 1E 14 12 11', S: '0F 10 10 0E 01 01 1E', T: '1F 04 04 04 04 04 04',
  U: '11 11 11 11 11 11 0E', V: '11 11 11 11 11 0A 04', W: '11 11 11 15 15 15 0A', X: '11 11 0A 04 0A 11 11',
  Y: '11 11 0A 04 04 04 04', Z: '1F 01 02 04 08 10 1F',
  0: '0E 11 13 15 19 11 0E', 1: '04 0C 04 04 04 04 0E', 2: '0E 11 01 02 04 08 1F', 3: '1F 02 04 02 01 11 0E',
  4: '02 06 0A 12 1F 02 02', 5: '1F 10 1E 01 01 11 0E', 6: '06 08 10 1E 11 11 0E', 7: '1F 01 02 04 08 08 08',
  8: '0E 11 11 0E 11 11 0E', 9: '0E 11 11 0F 01 02 0C',
  '!': '04 04 04 04 04 00 04', '?': '0E 11 01 02 04 00 04', '.': '00 00 00 00 00 0C 0C', ',': '00 00 00 00 0C 04 08',
  ':': '00 0C 0C 00 0C 0C 00', '-': '00 00 00 1F 00 00 00', "'": '04 04 08 00 00 00 00', '/': '01 02 02 04 08 08 10',
  '$': '04 0F 14 0E 05 1E 04', '+': '00 04 04 1F 04 04 00', '(': '02 04 08 08 08 04 02', ')': '08 04 02 02 02 04 08',
  '>': '08 04 02 01 02 04 08', '<': '02 04 08 10 08 04 02', '=': '00 00 1F 00 1F 00 00',
  'É': '02 04 1F 10 1E 10 1F', 'È': '08 04 1F 10 1E 10 1F', 'À': '08 04 0E 11 1F 11 11', 'Ç': '0E 11 10 10 11 0E 04',
  'Â': '04 0A 0E 11 1F 11 11', 'Ê': '04 0A 1F 10 1E 10 1F', 'Î': '04 0A 00 0E 04 04 0E', 'Ô': '04 0A 0E 11 11 11 0E',
  'Û': '04 0A 11 11 11 11 0E', 'Ë': '0A 00 1F 10 1E 10 1F', '%': '18 19 02 04 08 13 03', 'Ï': '0A 00 0E 04 04 04 0E', 'Ù': '08 04 11 11 11 11 0E',
  ' ': '00 00 00 00 00 00 00',
};
const GLYPH = {};
for (const [k, v] of Object.entries(RAW)) GLYPH[k] = v.split(' ').map((h) => parseInt(h, 16));

const INK = { fill: '#ffd23f', line: '#1a1033', shadow: '#ff4a5c' };
const WHITE = { fill: '#ffffff', line: '#1a1033' };
const DIM = { fill: '#b9b0de', line: '#1a1033' };
const GOLD = { fill: '#ffd23f', line: '#1a1033' };
const EFFECT_NAMES = { rocket: 'PATINS', wings: 'AILES', spring: 'RESSORTS', hitops: 'BASKETS', rain: 'PLUIE', love: 'AMOUREUX' };
import { RANKS } from './catalog.js';
const MAP_COL = { [T.GRASS]: '#4fae45', [T.SAND]: '#e2c07c', [T.ROAD]: '#676c82', [T.WATER]: '#3a8fe8', [T.ICE]: '#cfeaff' };

export class Hud {
  constructor(canvas) {
    this.c = canvas;
    this.x = canvas.getContext('2d');
    this.card = null;
    this.hint = 0;
    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.width = this.mapCanvas.height = SIZE;
  }

  width(s, sc) { return s.length * 6 * sc - sc; }

  glyph(ch, x, y, sc, color) {
    const g = GLYPH[ch] || GLYPH['?'], c = this.x;
    c.fillStyle = color;
    for (let r = 0; r < 7; r++) for (let k = 0; k < 5; k++) if (g[r] & (16 >> k)) c.fillRect(x + k * sc, y + r * sc, sc, sc);
  }

  letter(ch, x, y, sc, ink = INK) {
    x = Math.round(x); y = Math.round(y);
    if (ink.shadow) this.glyph(ch, x + sc, y + sc, sc, ink.shadow);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) this.glyph(ch, x + dx, y + dy, sc, ink.line);
    this.glyph(ch, x, y, sc, ink.fill);
  }

  text(s, x, y, sc = 1, ink = INK) { for (let i = 0; i < s.length; i++) this.letter(s[i], x + i * 6 * sc, y, sc, ink); }
  center(s, y, sc = 1, ink = INK) { this.text(s, Math.floor((this.c.width - this.width(s, sc)) / 2), y, sc, ink); }
  right(s, y, sc = 1, ink = INK, margin = 6) { this.text(s, this.c.width - this.width(s, sc) - margin, y, sc, ink); }

  showCard(title, sub = '') { this.card = { title, sub, t: 0 }; }
  toast(text, t = 2.2) { this.msg = { text, t }; }

  panel(w, h) {
    const c = this.x, x = Math.floor((this.c.width - w) / 2), y = Math.floor((this.c.height - h) / 2);
    c.fillStyle = 'rgba(16,12,46,0.92)'; c.fillRect(x, y, w, h);
    c.fillStyle = '#ff5fd2'; c.fillRect(x, y, w, 1); c.fillRect(x, y + h - 1, w, 1); c.fillRect(x, y, 1, h); c.fillRect(x + w - 1, y, 1, h);
    c.fillStyle = '#ffd23f'; c.fillRect(x + 2, y + 2, w - 4, 1);
    return { x, y };
  }

  wrapIcon(wrap, x, y, s = 10) {
    const c = this.x;
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#1a1033'; c.fillRect(x - 1, y - 1, s + 2, s + 2);
    c.drawImage(WRAP_CANVAS[wrap], 0, 0, 16, 16, x, y, s, s);
    c.fillStyle = WRAPS[wrap].ribbon;
    c.fillRect(x + Math.floor(s / 2) - 1, y, 2, s); c.fillRect(x, y + Math.floor(s / 2) - 1, s, 2);
  }

  head(x, y) {
    const c = this.x;
    c.fillStyle = '#1a1033'; c.fillRect(x - 1, y, 9, 8); c.fillRect(x, y - 1, 7, 10);
    c.fillStyle = '#e8334a'; c.fillRect(x, y, 7, 8);
    c.fillStyle = '#2f6fe4'; c.fillRect(x, y, 7, 2);
    c.fillStyle = '#ffffff'; c.fillRect(x + 1, y + 3, 2, 2); c.fillRect(x + 4, y + 3, 2, 2);
  }

  // Carton : les lettres tombent une à une en rebondissant, restent, puis s'envolent.
  drawCard(dt) {
    const k = this.card;
    if (!k) return;
    k.t += dt;
    const W = this.c.width;
    const sc = Math.max(1, Math.min(4, Math.floor(W / 110), Math.floor((W - 12) / (k.title.length * 6))));
    const w = this.width(k.title, sc), x0 = Math.floor((W - w) / 2), yT = Math.floor(this.c.height * 0.2);
    for (let i = 0; i < k.title.length; i++) {
      const tin = (k.t - i * 0.04) / 0.6, tout = (k.t - 2.2 - i * 0.03) / 0.42;
      if (tin <= 0 || tout >= 1) continue;
      let y = yT - (1 - easeOutBounce(tin)) * (yT + 40);
      if (tout > 0) y = yT - easeInBack(tout) * (yT + 50);
      this.letter(k.title[i], x0 + i * 6 * sc, y, sc);
    }
    if (k.sub && k.t > 0.6 && k.t < 2.4) this.center(k.sub, yT + 8 * sc + 4, 1, WHITE);
    if (k.t > 3.3) this.card = null;
  }

  drawTitle(g) {
    const W = this.c.width, H = this.c.height;
    const sc = Math.max(2, Math.min(4, Math.floor((W - 16) / 56)));
    const word = 'FUNKOTRON', x0 = Math.floor((W - this.width(word, sc)) / 2), y0 = Math.floor(H * 0.12);
    for (let i = 0; i < word.length; i++) this.letter(word[i], x0 + i * 6 * sc, y0 + Math.round(Math.sin(g.t * 3 + i * 0.7) * 2), sc);
    this.center('REMIX', y0 + 8 * sc + 4, Math.max(1, sc - 2), { fill: '#ff4a5c', line: '#1a1033', shadow: '#ffd23f' });
    if (g.menu === 'reglages') { this.drawOptions(g, 'RÉGLAGES'); return; }
    const opts = g.titleOpts, my = Math.floor(H * 0.54);
    opts.forEach((o, i) => {
      const sel = g.menuSel === i;
      this.center((sel ? '> ' : '  ') + o + (sel ? ' <' : '  '), my + i * 12, 1, sel ? GOLD : DIM);
    });
    const ty = my + opts.length * 12 + 4;
    this.center(g.coop ? '< 2 JOUEURS : TOEJAM ET EARL >' : '< 1 JOUEUR : TOEJAM >', ty, 1, g.coop ? { fill: '#ff9a2e', line: '#1a1033' } : DIM);
    if (g.coop) this.center('TOEJAM : ZQSD ESPACE F   EARL : FLÈCHES ENTRÉE MAJ DROITE', ty + 12, 1, DIM);
    if (Math.floor(g.t * 2) % 2 === 0) this.center('ENTRÉE : CHOISIR', ty + 26, 1, WHITE);
    this.center('ZQSD MARCHER  A/E TOURNER  ESPACE CADEAUX  C CARTE', H - 12, 1, DIM);
  }

  // Pause et réglages : une ligne par réglage, valeur à droite, flèches autour de la ligne choisie.
  drawOptions(g, title) {
    const rows = g.optRows || [], w = 220;
    const { x, y } = this.panel(w, 30 + rows.length * 13);
    this.text(title, x + 8, y + 7, 1, GOLD);
    rows.forEach((r, i) => {
      const ry = y + 22 + i * 13, on = i === g.optSel;
      if (on) { this.x.fillStyle = 'rgba(255,95,210,0.35)'; this.x.fillRect(x + 4, ry - 2, w - 8, 12); }
      this.text(r.label, x + 10, ry, 1, on ? GOLD : WHITE);
      if (r.value !== undefined) {
        const v = on ? `< ${r.value} >` : r.value;
        this.text(v, x + w - this.width(v, 1) - 10, ry, 1, on ? GOLD : DIM);
      }
    });
    this.center('FLÈCHES : CHOISIR ET RÉGLER   ÉCHAP : FERMER', y + 30 + rows.length * 13 + 4, 1, DIM);
  }

  list(title, rows, sel, label, valueOf, valueInk, footer) {
    const n = Math.max(1, rows.length), w = 214;
    const { x, y } = this.panel(w, 34 + n * 13);
    this.text(title, x + 8, y + 7, 1, GOLD);
    const money = `$${this.g.bucks}`;
    this.text(money, x + w - this.width(money, 1) - 8, y + 7, 1, WHITE);
    if (!rows.length) this.text('LE SAC EST VIDE.', x + 8, y + 22, 1, DIM);
    rows.forEach((type, i) => {
      const ry = y + 22 + i * 13, on = i === sel;
      if (on) { this.x.fillStyle = 'rgba(255,95,210,0.35)'; this.x.fillRect(x + 4, ry - 2, w - 8, 12); }
      this.wrapIcon(this.g.bag.wrapOf[type], x + 8, ry - 1, 9);
      this.text(label(type), x + 22, ry, 1, on ? GOLD : WHITE);
      const v = valueOf(type);
      this.text(v, x + w - this.width(v, 1) - 8, ry, 1, valueInk(type));
    });
    this.center(footer, y + 34 + n * 13 + 4, 1, DIM);
  }

  drawMap(g) {
    const d = g.world.levels[g.player.level].data, m = this.mapCanvas, mc = m.getContext('2d');
    mc.clearRect(0, 0, SIZE, SIZE);
    const blink = Math.floor(g.t * 4) % 2 === 0;
    for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
      const t = d.type[i][j];
      if (!t || !d.seen[i * SIZE + j]) continue;
      mc.fillStyle = t === T.GRASS ? d.biome?.ground[0] || MAP_COL[t] : t === T.SAND ? d.biome?.shore[0] || MAP_COL[t] : t === T.WATER && d.biome?.liquid === 'lava' ? '#ff6a1a' : MAP_COL[t];
      mc.fillRect(i, j, 1, 1);
    }
    const dot = (x, z, col) => { const i = toCell(x), j = toCell(z); if (d.seen[i * SIZE + j]) { mc.fillStyle = col; mc.fillRect(i, j, 1, 1); } };
    for (const p of d.presents) if (!p.taken) dot(p.x, p.z, '#ff8ad8');
    if (d.mailbox) dot(d.mailbox.x, d.mailbox.z, '#6fa0ff');
    if (d.elevator && d.seen[d.elevator.i * SIZE + d.elevator.j]) { mc.fillStyle = '#ffd23f'; mc.fillRect(d.elevator.i - 1, d.elevator.j - 1, 3, 3); }
    if (d.piece && !d.piece.taken && blink) dot(d.piece.x, d.piece.z, '#ffffff');
    if (blink) { mc.fillStyle = '#ff2a3a'; mc.fillRect(toCell(g.player.pos.x), toCell(g.player.pos.z), 1, 1); }
    if (blink && g.coop && g.players[1].active && g.players[1].level === g.player.level) { mc.fillStyle = '#ff9a2e'; mc.fillRect(toCell(g.players[1].pos.x), toCell(g.players[1].pos.z), 1, 1); }

    const W = this.c.width, H = this.c.height, cs = Math.max(2, Math.floor((H - 52) / SIZE)), S = SIZE * cs;
    const pw = Math.min(W - 8, S + 60);
    const { x, y } = this.panel(pw, S + 46);
    this.text(`NIVEAU ${g.player.level + 1}`, x + 8, y + 7, 1, GOLD);
    const pc = `VAISSEAU ${g.pieces.size}/10`;
    this.text(pc, x + pw - this.width(pc, 1) - 8, y + 7, 1, WHITE);
    const c = this.x, cx = Math.floor(W / 2), cy = y + 20 + S / 2;
    c.save();
    c.beginPath(); c.rect(x + 2, y + 18, pw - 4, S + 10); c.clip();
    c.imageSmoothingEnabled = false;
    c.translate(cx, cy); c.rotate(g.cam.yaw);
    c.globalAlpha = 0.35; c.fillStyle = '#3a3588'; c.fillRect(-S / 2, -S / 2, S, S); c.globalAlpha = 1;
    c.drawImage(m, -S / 2, -S / 2, S, S);
    c.restore();
    this.center(`GRAINE ${g.seedCode}   C : FERMER`, y + S + 32, 1, DIM);
  }

  bar(x, y, w, v) {
    const c = this.x, hp = Math.max(0, v) / 100;
    c.fillStyle = '#1a1033'; c.fillRect(x - 1, y, w + 2, 6);
    c.fillStyle = hp > 0.5 ? '#62d672' : hp > 0.25 ? '#ffd23f' : Math.floor(performance.now() / 160) % 2 ? '#ff4a5c' : '#a81c33';
    c.fillRect(x, y + 1, Math.ceil(w * hp), 4);
  }

  effects(g, p, x0, ey, alignRight) {
    const W = this.c.width;
    for (const [k, v] of Object.entries(p.effects)) {
      if (!(v > 0)) continue;
      const dur = PRESENT[k]?.dur || 6, name = EFFECT_NAMES[k], tw = this.width(name, 1) + 47;
      const x = alignRight ? W - 6 - tw : x0;
      this.text(name, x, ey, 1, WHITE);
      const bx = x + this.width(name, 1) + 5;
      this.x.fillStyle = '#1a1033'; this.x.fillRect(bx - 1, ey + 1, 42, 5);
      this.x.fillStyle = v < 3 && Math.floor(g.t * 6) % 2 ? '#ff4a5c' : '#ffd23f';
      this.x.fillRect(bx, ey + 2, Math.ceil((40 * v) / dur), 3);
      ey -= 11;
    }
    return ey;
  }

  drawPlay(dt, g) {
    const W = this.c.width, H = this.c.height, [p1, p2] = g.players;
    const lvl = p1.level === 25 ? 'FUNKOTRON' : `NIVEAU ${p1.level + 1}`;
    this.text(lvl, 6, 6, 1, WHITE);
    const ship = `VAISSEAU ${g.pieces.size}/10`;
    this.text(ship, 6, 17, 1, g.pieces.size ? GOLD : DIM);
    if (g.records) this.text(`DISQUES ${g.records}/7`, 6 + this.width(ship, 1) + 10, 17, 1, GOLD);
    this.right(`$${g.bucks}`, 6, 1, GOLD);
    for (let i = 0; i < Math.min(g.lives, 6); i++) this.head(W - 14 - i * 11, 18);
    // énergie de chacun
    this.bar(W - 67, 30, 60, p1.health);
    if (g.coop && p2.active) {
      this.x.fillStyle = '#ff9a2e'; this.x.fillRect(W - 77, 39, 7, 7); this.x.fillStyle = '#1a1033'; this.x.fillRect(W - 76, 41, 5, 2);
      this.bar(W - 67, 39, 60, p2.health);
    }
    this.text(RANKS[g.rank].name, 6, 28, 1, { fill: '#ff8ad8', line: '#1a1033' });
    if (p1.sneaking) this.text('PSST...', 6, 39, 1, DIM);
    if (g.coop && p2.sneaking) this.right('PSST...', 50, 1, DIM);
    if (g.coop && p2.active && p2.level !== p1.level) this.right(`EARL : NIVEAU ${p2.level + 1}`, g.coop && p2.sneaking ? 61 : 50, 1, { fill: '#ff9a2e', line: '#1a1033' });
    let ey = this.effects(g, p1, 6, H - 14, false);
    if (g.coop && p2.active) this.effects(g, p2, 0, H - 14, true);
    if (g.tomatoes > 0) this.text(`TOMATES ${g.tomatoes} (F)`, 6, ey, 1, { fill: '#ff6a5a', line: '#1a1033' });
    if (this.msg && (this.msg.t -= dt) > 0) this.center(this.msg.text, 52, 1, GOLD);
    if (!g.menu) {
      if (g.prompt) this.center(g.prompt, H - 26, 1, GOLD);
      else if (this.hint > 0) {
        this.hint -= dt;
        if (this.hint < 7) this.center('TROUVE LES 10 MORCEAUX DU VAISSEAU !', H - 26, 1, WHITE);
      }
      this.drawCard(dt);
    }
    this.g = g;
    if (g.menu === 'bag') {
      this.list('CADEAUX', g.bag.list().map((it) => it.type), g.bagSel, (t) => g.bag.label(t),
        (t) => `X${g.bag.items.get(t)}`, () => DIM, 'ESPACE : OUVRIR   ÉCHAP : FERMER');
    } else if (g.menu === 'shop') {
      this.list('BOÎTE AUX LETTRES', g.shop, g.shopSel, (t) => g.bag.label(t),
        (t) => `$${PRESENT[t].price}`, (t) => (g.bucks >= PRESENT[t].price ? WHITE : DIM), 'ESPACE : COMMANDER   ÉCHAP : FERMER');
    } else if (g.menu === 'map') this.drawMap(g);
    else if (g.menu === 'pause') this.drawOptions(g, 'PAUSE');
    if (g.state === 'over') {
      this.center('GAME OVER', Math.floor(H * 0.4), Math.max(2, Math.min(4, Math.floor(W / 110))));
      if (g.stateT > 1.5 && Math.floor(g.t * 2) % 2 === 0) this.center('ENTRÉE : RECOMMENCER', Math.floor(H * 0.62), 1, WHITE);
    }
  }

  // Le générique, sur Funkotron.
  drawCredits(dt, g) {
    const W = this.c.width, H = this.c.height, T = g.stateT;
    const sc = Math.max(2, Math.min(3, Math.floor(W / 140)));
    const word = 'FUNKOTRON !', x0 = Math.floor((W - this.width(word, sc)) / 2);
    for (let i = 0; i < word.length; i++) this.letter(word[i], x0 + i * 6 * sc, 14 + Math.round(Math.sin(g.t * 4 + i * 0.6) * 3), sc);
    const s = g.stats, min = Math.floor(s.time / 60), sec = String(Math.floor(s.time % 60)).padStart(2, '0');
    const lines = [
      g.coop ? 'TOEJAM ET EARL SONT RENTRÉS À LA MAISON.' : 'TOEJAM EST RENTRÉ À LA MAISON.', '',
      `TEMPS : ${min} MIN ${sec}`, `RANG : ${RANKS[g.rank].name}`, `CHUTES : ${s.falls}`,
      `CADEAUX OUVERTS : ${s.presents}`, `TERRIENS CHASSÉS : ${s.chased}`, `REPAS : ${s.eaten}`, `BILLETS EN POCHE : ${g.bucks}`, '',
      'FUNKOTRON REMIX', "D'APRÈS TOEJAM ET EARL (1991)", 'CODE ET 3D : CLAUDE', 'IDÉES ET DIRECTION : MATTHIEU',
      'BRUITAGES : ELEVENLABS', 'MUSIQUES : ACE MUSIC', '', 'MERCI POUR LE FUNK.',
    ];
    // le générique défile en boucle sous le titre
    const top = 14 + 9 * sc + 8, span = lines.length * 11 + (H - top);
    const off = (T * 16) % span;
    lines.forEach((l, i) => { const y = Math.round(H - 20 + i * 11 - off); if (y > top && y < H - 20) this.center(l, y, 1, i < 2 ? GOLD : WHITE); });
    if (T > 4 && Math.floor(g.t * 2) % 2 === 0) this.center('ENTRÉE : RETOUR AU TITRE', H - 12, 1, GOLD);
    this.drawCard(dt);
  }

  draw(dt, g) {
    this.x.clearRect(0, 0, this.c.width, this.c.height);
    if (g.state === 'credits') { this.drawCredits(dt, g); return; }
    if (g.state === 'title' || (g.state === 'intro' && g.stateT < 0.6)) { this.drawTitle(g); return; }
    if (g.state === 'intro') return;
    this.drawPlay(dt, g);
  }
}
