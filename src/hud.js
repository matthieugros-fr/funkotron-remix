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
  '%': '18 19 02 04 08 13 03', ' ': '00 00 00 00 00 00 00',
};
// les capitales accentuées : la lettre entière, l'accent posé au-dessus (deux rangées), la cédille en dessous
const ACUTE = [0x02, 0x04], GRAVE = [0x08, 0x04], CIRC = [0x04, 0x0a], DIAER = [0x00, 0x0a];
const ACCENTS = { 'É': ['E', ACUTE], 'È': ['E', GRAVE], 'Ê': ['E', CIRC], 'Ë': ['E', DIAER], 'À': ['A', GRAVE], 'Â': ['A', CIRC],
  'Î': ['I', CIRC], 'Ï': ['I', DIAER], 'Ô': ['O', CIRC], 'Û': ['U', CIRC], 'Ù': ['U', GRAVE] };
const GLYPH = {};
for (const [k, v] of Object.entries(RAW)) GLYPH[k] = { r0: 0, rows: v.split(' ').map((h) => parseInt(h, 16)) };
for (const [k, [base, acc]] of Object.entries(ACCENTS)) GLYPH[k] = { r0: -2, rows: [...acc, ...GLYPH[base].rows] };
GLYPH['Ç'] = { r0: 0, rows: [...GLYPH.C.rows, 0x04, 0x08] };

const INK = { fill: '#ffd23f', line: '#1a1033', shadow: '#ff4a5c' };
const WHITE = { fill: '#ffffff', line: '#1a1033' };
const DIM = { fill: '#b9b0de', line: '#1a1033' };
const GOLD = { fill: '#ffd23f', line: '#1a1033' };
const RED = { fill: '#ff4a5c', line: '#1a1033' };
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
    g.rows.forEach((bits, r) => { for (let k = 0; k < 5; k++) if (bits & (16 >> k)) c.fillRect(x + k * sc, y + (g.r0 + r) * sc, sc, sc); });
  }

  letter(ch, x, y, sc, ink = INK) {
    x = Math.round(x); y = Math.round(y);
    if (ink.shadow) this.glyph(ch, x + sc, y + sc, sc, ink.shadow);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) this.glyph(ch, x + dx, y + dy, sc, ink.line);
    this.glyph(ch, x, y, sc, ink.fill);
  }

  text(s, x, y, sc = 1, ink = INK) { for (let i = 0; i < s.length; i++) this.letter(s[i], x + i * 6 * sc, y, sc, ink); }
  center(s, y, sc = 1, ink = INK) { this.text(s, Math.floor((this.c.width - this.width(s, sc)) / 2), y, sc, ink); }
  // coupe un texte en lignes qui tiennent dans maxW
  wrap(s, maxW, sc = 1) {
    const lines = [''];
    for (const w of s.split(' ')) {
      const cur = lines[lines.length - 1], test = cur ? cur + ' ' + w : w;
      if (cur && this.width(test, sc) > maxW) lines.push(w); else lines[lines.length - 1] = test;
    }
    return lines;
  }
  // centré, sur plusieurs lignes si besoin (autour de cx) ; renvoie le nombre de lignes
  centerWrap(s, y, sc = 1, ink = INK, maxW = this.c.width - 12, cx = this.c.width / 2) {
    const lines = this.wrap(s, maxW, sc);
    lines.forEach((l, i) => this.text(l, Math.floor(cx - this.width(l, sc) / 2), y + i * 10 * sc, sc, ink));
    return lines.length;
  }
  right(s, y, sc = 1, ink = INK, margin = 6) { this.text(s, this.c.width - this.width(s, sc) - margin, y, sc, ink); }

  // urgent : passe devant la file (promotion, cadeau ouvert, K.O.…) ; le carton en cours repasse après
  showCard(title, sub = '', urgent = false) {
    const k = { title, sub, t: 0 };
    if (urgent && this.card && this.card.title !== title) {
      this.queue ||= [];
      if (this.card.t < 1.6) this.queue.unshift({ ...this.card, t: 0 });
      this.card = k;
      return;
    }
    if (this.card && this.card.t < 2.2) {
      this.queue ||= [];
      if (!this.queue.some((q) => q.title === title) && this.card.title !== title) this.queue.push(k);
      if (this.queue.length > 3) this.queue.shift();
    } else this.card = k;
  }
  toast(text, t = 2.2) { this.msg = { text, t }; }
  // petit texte qui s'élève d'un point du monde (« +1 », « SPLAT ! »…)
  float(text, pos, level, ink = GOLD, dur = 0.9) { (this.floats ||= []).push({ text, pos: pos.clone(), level, ink, dur, t: 0 }); }
  // bulle au-dessus d'un personnage
  bubble(who, text, dur = 2.6) { (this.bubbles ||= new Map()).set(who, { text, t: 0, dur }); }
  bounceBucks() { this.bump = 1; }
  // sous-titres de l'intro : qui parle (tj, earl, ou null pour le narrateur), texte qui s'écrit lettre à lettre
  subtitle(who, text) { this.sub = text ? { who, text, t: 0 } : null; }

  drawCine(dt, g) {
    const W = this.c.width, H = this.c.height, c = this.x, bar = Math.round(H * 0.11);
    c.fillStyle = '#000000'; c.fillRect(0, 0, W, bar); c.fillRect(0, H - bar, W, bar);
    const s = this.sub;
    if (s && s.t > 2.2 + s.text.length / 18) this.sub = null;
    if (s && this.sub) {
      s.t += dt;
      const name = s.who === 'tj' ? 'TOEJAM : ' : s.who === 'earl' ? 'EARL : ' : '';
      // une ou deux lignes selon la place ; le texte s'écrit lettre à lettre
      const words = s.text.split(' '), lines = [''];
      for (const w of words) {
        const cur = lines[lines.length - 1], test = cur ? cur + ' ' + w : w;
        if (this.width((lines.length === 1 ? name : '') + test, 1) > W - 16 && cur) lines.push(w); else lines[lines.length - 1] = test;
      }
      let shown = Math.floor(s.t * 45);
      const ink = name ? WHITE : { fill: '#c8c8e8', line: '#000000' }, y0 = H - bar + Math.floor((bar - (lines.length * 10 - 3)) / 2);
      lines.forEach((ln, i) => {
        const pre = i === 0 ? name : '', x = Math.floor((W - this.width(pre + ln, 1)) / 2), y = y0 + i * 10;
        if (pre) this.text(pre, x, y, 1, { fill: s.who === 'tj' ? '#ff6a7a' : '#ff9a2e', line: '#000000' });
        this.text(ln.slice(0, Math.max(0, shown)), x + this.width(pre, 1), y, 1, ink);
        shown -= ln.length + 1;
      });
    }
    this.drawCard(dt);
    if (g.flash > 0) { c.fillStyle = `rgba(255,255,255,${Math.min(1, g.flash)})`; c.fillRect(0, 0, W, H); g.flash -= dt * 1.6; }
    if (Math.floor(g.t * 2) % 2 === 0 && g.stateT > 1.5) this.right('ENTRÉE : PASSER', Math.floor((bar - 7) / 2), 1, DIM);
  }

  panel(w, h, dy = 0) {
    const c = this.x, x = Math.floor((this.c.width - w) / 2), y = Math.floor((this.c.height - h) / 2) + dy;
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
    // en écran partagé, la carte se pose dans la moitié du premier joueur, pas sur la ligne de coupe
    const sp = this.g?.split, off = sp ? Math.round((-sp.x * W) / 4) : 0;
    const w = this.width(k.title, sc), x0 = Math.floor((W - w) / 2 + off), yT = Math.floor(this.c.height * 0.2);
    for (let i = 0; i < k.title.length; i++) {
      const tin = (k.t - i * 0.04) / 0.6, tout = (k.t - 2.2 - i * 0.03) / 0.42;
      if (tin <= 0 || tout >= 1) continue;
      let y = yT - (1 - easeOutBounce(tin)) * (yT + 40);
      if (tout > 0) y = yT - easeInBack(tout) * (yT + 50);
      this.letter(k.title[i], x0 + i * 6 * sc, y, sc);
    }
    if (k.sub && k.t > 0.6 && k.t < 2.4) this.centerWrap(k.sub, yT + 8 * sc + 4, 1, WHITE, sp ? W / 2 - 12 : W - 12, W / 2 + off);
    if (k.t > 3.3) this.card = this.queue?.shift() || null;
  }

  drawTitle(g) {
    const W = this.c.width, H = this.c.height;
    const sc = Math.max(2, Math.min(4, Math.floor((W - 16) / 56)));
    const word = 'FUNKOTRON', x0 = Math.floor((W - this.width(word, sc)) / 2), y0 = Math.floor(H * 0.12);
    for (let i = 0; i < word.length; i++) this.letter(word[i], x0 + i * 6 * sc, y0 + Math.round(Math.sin(g.t * 3 + i * 0.7) * 2), sc);
    this.center('REMIX', y0 + 8 * sc + 4, Math.max(1, sc - 2), { fill: '#ff4a5c', line: '#1a1033', shadow: '#ffd23f' });
    if (g.menu === 'reglages') { this.drawOptions(g, 'RÉGLAGES', Math.floor(H * 0.12)); return; }
    if (g.menu === 'carnet') { this.drawCarnet(g); return; }
    // le menu remonte s'il a beaucoup de lignes, pour ne pas mordre sur la légende du bas
    const opts = g.titleOpts, my = Math.floor(Math.min(H * 0.54, H - 64 - opts.length * 12));
    opts.forEach((o, i) => {
      const sel = g.menuSel === i;
      this.center((sel ? '> ' : '  ') + o + (sel ? ' <' : '  '), my + i * 12, 1, sel ? GOLD : DIM);
    });
    const ty = my + opts.length * 12 + 4;
    if (opts[g.menuSel]?.startsWith('DÉFI')) this.center('< > : LE DÉFI (MONDE ALÉATOIRE)', ty, 1, { fill: '#3affc0', line: '#1a1033' });
    else this.center(g.coop ? '< 2 JOUEURS : TOEJAM ET EARL >' : '< 1 JOUEUR : TOEJAM >', ty, 1, g.coop ? { fill: '#ff9a2e', line: '#1a1033' } : DIM);
    if (g.coop) this.center('TOEJAM : ZQSD ESPACE F   EARL : FLÈCHES ENTRÉE MAJ DROITE', ty + 12, 1, DIM);
    if (Math.floor(g.t * 2) % 2 === 0) this.center('ENTRÉE : CHOISIR', ty + 26, 1, WHITE);
    if (g.coop) this.center('EARL : PLUS LENT, MAIS PLUS COSTAUD', H - 24, 1, DIM);
    this.center(g.coop ? 'A/E CAMÉRA   C CARTE   ÉCHAP PAUSE' : 'ZQSD BOUGER  A/E CAMÉRA  ESPACE CADEAUX  C CARTE', H - 12, 1, DIM);
  }

  // Pause et réglages : une ligne par réglage, valeur à droite, flèches autour de la ligne choisie.
  drawOptions(g, title, dy = 0) {
    const rows = g.optRows || [], w = 220;
    const { x, y } = this.panel(w, 30 + rows.length * 13, dy);
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
    // ce que le sage a indiqué
    if (blink) for (const h of d.hints || []) { mc.fillStyle = '#7affff'; mc.fillRect(toCell(h.x) - 1, toCell(h.z), 3, 1); mc.fillRect(toCell(h.x), toCell(h.z) - 1, 1, 3); }
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

  // Tout ce qui flotte au-dessus du monde : bulles, « ! » des terriens qui vont charger, jauges, « +1 ».
  drawWorld(dt, g) {
    if (!g.spots) return;
    const c = this.x, live = !g.menu;
    // les terriens sur le point de charger
    for (const e of g.earthlings?.list || []) {
      if (!(e.warnT > 0) || !e.shown || e.dancing || e.pauseT > 0) continue;
      const h = e.def.flies ? 2.5 : e.type === 'mole' ? 0.9 : 1.75;
      for (const s of g.spots(e.pos.clone().setY(e.pos.y + h), e.level)) {
        const j = Math.round(Math.sin(g.t * 40) * 1);
        this.letter('!', s.x - 4 + j, Math.max(3, s.y - 16), 2, { fill: '#ff2a3a', line: '#ffffff' });
      }
    }
    // la boussole : une flèche qui tourne autour du joueur, vers ce qu'il cherche
    for (const cp of g.compass || []) {
      const a = g.pipe.toHud(cp.p.pos.clone().setY(cp.p.pos.y + 0.6), cp.view), b = g.pipe.toHud(cp.to, cp.view);
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      const r = 22 + Math.sin(g.t * 6) * 2, cx = a.x + ux * r, cy = a.y + uy * r;
      c.fillStyle = '#1a1033';
      c.beginPath(); c.moveTo(cx + ux * 7, cy + uy * 7); c.lineTo(cx - uy * 5 - ux * 2, cy + ux * 5 - uy * 2); c.lineTo(cx + uy * 5 - ux * 2, cy - ux * 5 - uy * 2); c.closePath(); c.fill();
      c.fillStyle = { piece: '#ffd23f', elevator: '#5affff', rocket: '#ff8ad8' }[cp.kind];
      c.beginPath(); c.moveTo(cx + ux * 5, cy + uy * 5); c.lineTo(cx - uy * 3.5 - ux, cy + ux * 3.5 - uy); c.lineTo(cx + uy * 3.5 - ux, cy - ux * 3.5 - uy); c.closePath(); c.fill();
    }
    // bulles des personnages
    for (const [who, b] of this.bubbles || []) {
      if (live) b.t += dt;
      if (b.t > b.dur || !who.active || !who.visible) { this.bubbles.delete(who); continue; }
      const words = b.text.split(' '), lines = [''];
      for (const w of words) { const cur = lines[lines.length - 1]; if (cur && (cur + ' ' + w).length > 24) lines.push(w); else lines[lines.length - 1] = cur ? cur + ' ' + w : w; }
      const pop = Math.min(1, b.t / 0.12), out = b.t > b.dur - 0.2;
      for (const s of g.spots(who.pos.clone().setY(who.pos.y + (who.H || 1.2) + 0.45), who.level)) {
        const w = Math.max(...lines.map((l) => this.width(l, 1))) + 8, h = lines.length * 9 + 4;
        const x = Math.round(s.x - w / 2), y = Math.round(s.y - h - 5 - (1 - pop) * 4);
        if (out && Math.floor(b.t * 20) % 2) continue;
        c.fillStyle = '#1a1033'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
        c.fillStyle = '#ffffff'; c.fillRect(x, y, w, h);
        c.fillStyle = '#1a1033'; c.fillRect(Math.round(s.x) - 3, y + h, 6, 2); c.fillRect(Math.round(s.x) - 2, y + h + 2, 4, 2); c.fillRect(Math.round(s.x) - 1, y + h + 4, 2, 1);
        c.fillStyle = '#ffffff'; c.fillRect(Math.round(s.x) - 2, y + h, 4, 2); c.fillRect(Math.round(s.x) - 1, y + h + 2, 2, 1);
        const ink = { fill: who.kind === 'earl' ? '#c0501a' : '#c01a3a', line: '#ffffff' };
        lines.forEach((l, i) => this.text(l, Math.round(s.x - this.width(l, 1) / 2), y + 3 + i * 9, 1, ink));
      }
    }
    // jauges (le trésor qu'on creuse…)
    for (const ga of g.gauges || []) {
      for (const s of g.spots(ga.pos, ga.level)) {
        const w = 26, x = Math.round(s.x - w / 2), y = Math.round(s.y);
        c.fillStyle = '#1a1033'; c.fillRect(x - 1, y - 1, w + 2, 5);
        c.fillStyle = ga.color || '#ffd23f'; c.fillRect(x, y, Math.ceil(w * Math.min(1, ga.k)), 3);
        if (ga.label) this.text(ga.label, Math.round(s.x - this.width(ga.label, 1) / 2), y - 10, 1, WHITE);
      }
    }
    // « +1 » et compagnie
    this.floats = (this.floats || []).filter((f) => {
      if (live) f.t += dt;
      if (f.t > f.dur) return false;
      const k = f.t / f.dur;
      for (const s of g.spots(f.pos, f.level)) {
        const y = s.y - 6 - k * 16;
        if (k < 0.75 || Math.floor(f.t * 20) % 2) this.text(f.text, Math.round(s.x - this.width(f.text, 1) / 2), Math.round(y), 1, f.ink);
      }
      return true;
    });
  }

  // Le carnet : les records de toutes les parties.
  drawCarnet(g) {
    const k = g.carnet, min = (s) => `${Math.floor(s / 60)} MIN ${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const rows = [
      ['PARTIES COMMENCÉES', `${k.games}`], ['RETOURS SUR FUNKOTRON', `${k.wins}`], ['ÉTAGE LE PLUS HAUT', `${k.bestLevel || '-'}`],
      ['MEILLEUR RANG', RANKS[k.bestRank || 0].name], ["DISQUES D'OR (MAX)", `${k.records}/7`], ['RETOUR LE PLUS RAPIDE', k.bestTime ? min(k.bestTime) : '-'],
    ];
    for (const [id, sc] of Object.entries(k.scores || {})) rows.push([`SCORE ${id}`, `${sc}`]);
    const w = 260, { x, y } = this.panel(w, 34 + rows.length * 12, 20);
    this.text('LE CARNET', x + 8, y + 7, 1, GOLD);
    rows.forEach(([a, b], i) => {
      this.text(a, x + 10, y + 22 + i * 12, 1, WHITE);
      this.text(b, x + w - this.width(b, 1) - 10, y + 22 + i * 12, 1, GOLD);
    });
    this.center('ENTRÉE : FERMER', y + 34 + rows.length * 12 + 4, 1, DIM);
  }

  // Le carton des commandes, à la toute première partie.
  drawControls(g) {
    const rows = g.coop
      ? [['', 'TOEJAM', 'EARL'], ['MARCHER', 'ZQSD', 'FLÈCHES'], ['SAC, SAGE, BOÎTE', 'ESPACE', 'ENTRÉE'], ['TOMATE', 'F', 'MAJ DROITE'], ['PSST (DISCRET)', 'MAJ GAUCHE', 'ALT DROITE']]
      : [['MARCHER', 'ZQSD OU FLÈCHES'], ['SAC, SAGE, BOÎTE', 'ESPACE'], ['TOMATE', 'F'], ['PSST (DISCRET)', 'MAJ'], ['CAMÉRA', 'A / E'], ['CARTE', 'C'], ['PAUSE', 'ÉCHAP']];
    if (g.coop) rows.push(['CAMÉRA', 'A / E', ''], ['CARTE / PAUSE', 'C / ÉCHAP', '']);
    const w = g.coop ? 300 : 236, { x, y } = this.panel(w, 40 + rows.length * 12);
    this.text('COMMANDES', x + 8, y + 7, 1, GOLD);
    rows.forEach((r, i) => {
      const ry = y + 22 + i * 12;
      this.text(r[0], x + 10, ry, 1, i === 0 && g.coop ? DIM : WHITE);
      if (g.coop) { this.text(r[1], x + 136, ry, 1, i === 0 ? { fill: '#ff6a7a', line: '#1a1033' } : GOLD); this.text(r[2], x + 216, ry, 1, i === 0 ? { fill: '#ff9a2e', line: '#1a1033' } : GOLD); }
      else this.text(r[1], x + 128, ry, 1, GOLD);
    });
    if (Math.floor(g.t * 2) % 2 === 0) this.center('ENTRÉE : EN AVANT LE FUNK', y + 30 + rows.length * 12, 1, WHITE);
  }

  drawPlay(dt, g) {
    const W = this.c.width, H = this.c.height, [p1, p2] = g.players;
    const lvl = p1.level === 25 ? 'FUNKOTRON' : `NIVEAU ${p1.level + 1}`;
    this.text(lvl, 6, 6, 1, WHITE);
    const ship = `VAISSEAU ${g.pieces.size}/10`;
    this.text(ship, 6, 17, 1, g.pieces.size ? GOLD : DIM);
    if (g.records) this.text(`DISQUES ${g.records}/7`, 6 + this.width(ship, 1) + 10, 17, 1, GOLD);
    // le compteur de billets saute à chaque billet
    this.bump = Math.max(0, (this.bump || 0) - dt * 4);
    this.right(`$${g.bucks}`, 6 - Math.round(Math.sin(this.bump * Math.PI) * 4), 1, this.bump > 0.5 ? WHITE : GOLD);
    for (let i = 0; i < Math.min(g.lives, 6); i++) this.head(W - 14 - i * 11, 18);
    // énergie de chacun
    this.bar(W - 67, 30, 60, p1.health);
    if (g.coop && p2.active) {
      this.x.fillStyle = '#ff9a2e'; this.x.fillRect(W - 77, 39, 7, 7); this.x.fillStyle = '#1a1033'; this.x.fillRect(W - 76, 41, 5, 2);
      this.bar(W - 67, 39, 60, p2.health);
    }
    this.text(RANKS[g.rank].name, 6, 28, 1, { fill: '#ff8ad8', line: '#1a1033' });
    // contre la montre
    if (g.challenge?.time) {
      const left = Math.max(0, g.challenge.time - g.stats.time), tx = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
      this.center(tx, 6, 1, left < 60 && Math.floor(g.t * 4) % 2 ? RED : WHITE);
    }
    // la jauge de funk, sur la piste de disco
    const disco = g.players.find((p) => p.active && p.onDisco && !p.onDisco.funkDone)?.onDisco;
    if (disco) {
      const bw = 90, bx = Math.floor((W - bw) / 2), by = H - 44, c = this.x, b = g.beat ? g.beat() : 0, pulse = 1 - (b - Math.floor(b));
      this.text('FUNK', bx - 30, by - 1, 1, { fill: '#ff5fd2', line: '#1a1033' });
      c.fillStyle = '#1a1033'; c.fillRect(bx - 1, by - 1, bw + 2, 7);
      c.fillStyle = '#ff5fd2'; c.fillRect(bx, by, Math.ceil(bw * Math.min(1, disco.funk || 0)), 5);
      // le temps : un carré qui s'allume sur chaque temps
      c.fillStyle = pulse > 0.8 ? '#ffffff' : pulse > 0.6 ? '#ffd23f' : '#3a3060';
      c.fillRect(bx + bw + 5, by - 1, 7, 7);
    }
    if (p1.sneaking) this.text('PSST...', 6, 39, 1, DIM);
    if (g.coop && p2.sneaking) this.right('PSST...', 50, 1, DIM);
    if (g.coop && p2.active && p2.level !== p1.level) this.right(`EARL : NIVEAU ${p2.level + 1}`, g.coop && p2.sneaking ? 61 : 50, 1, { fill: '#ff9a2e', line: '#1a1033' });
    let ey = this.effects(g, p1, 6, H - 14, false);
    if (g.coop && p2.active) this.effects(g, p2, 0, H - 14, true);
    if (p1.tomatoes > 0) this.text(`TOMATES ${p1.tomatoes} (F)`, 6, ey, 1, { fill: '#ff6a5a', line: '#1a1033' });
    if (g.coop && p2.active && p2.tomatoes > 0) this.right(`TOMATES ${p2.tomatoes} (MAJ D)`, H - 25, 1, { fill: '#ff6a5a', line: '#1a1033' });
    const live = g.state === 'play';
    if (!g.menu && live) this.drawWorld(dt, g);
    if (this.msg && (this.msg.t -= dt) > 0 && live && !g.menu) this.centerWrap(this.msg.text, this.card ? Math.floor(H * 0.2) + 38 + (this.card.sub && this.wrap(this.card.sub, W - 12).length > 1 ? 10 : 0) : 52, 1, GOLD);
    if (!g.menu) {
      if (g.prompt) this.centerWrap(g.prompt, this.wrap(g.prompt, W - 12).length > 1 ? H - 36 : H - 26, 1, GOLD);
      else if (this.hint > 0) {
        this.hint -= dt;
        if (this.hint < 7) this.center('TROUVE LES 10 MORCEAUX DU VAISSEAU !', H - 26, 1, WHITE);
      }
      this.drawCard(dt);
    }
    this.g = g;
    if (g.menu === 'bag') {
      const owner = g.menuOwner || g.player, bag = owner.bag || g.bag, key = g.coop && owner === g.players[1] ? 'ENTRÉE' : 'ESPACE';
      this.list(g.coop ? (owner === g.players[1] ? "CADEAUX D'EARL" : 'CADEAUX DE TOEJAM') : 'CADEAUX', bag.list().map((it) => it.type), g.bagSel, (t) => g.bag.label(t),
        (t) => `X${bag.items.get(t)}`, () => DIM, g.coop ? `${key} : OUVRIR   DROITE : DONNER   ÉCHAP : FERMER` : `${key} : OUVRIR   ÉCHAP : FERMER`);
    } else if (g.menu === 'shop') {
      this.list('BOÎTE AUX LETTRES', g.shop, g.shopSel, (t) => g.bag.label(t),
        (t) => `$${g.priceOf(t)}`, (t) => (g.bucks >= g.priceOf(t) ? WHITE : DIM), `${g.coop && g.menuOwner === g.players[1] ? 'ENTRÉE' : 'ESPACE'} : COMMANDER   ÉCHAP : FERMER`);
    } else if (g.menu === 'map') this.drawMap(g);
    else if (g.menu === 'pause') this.drawOptions(g, 'PAUSE');
    else if (g.menu === 'controls') this.drawControls(g);
    if (g.state === 'over') {
      const big = Math.max(2, Math.min(4, Math.floor(W / 110))), y0 = Math.floor(H * 0.3);
      this.center('GAME OVER', y0, big);
      if (g.overWhy) this.center(g.overWhy, y0 + 8 * big + 6, 1, WHITE);
      const n = this.centerWrap(`SCORE : ${g.score}${g.challenge ? `   DÉFI ${g.challenge.name} X${g.challenge.mult}` : ''}`, y0 + 8 * big + 20, 1, GOLD);
      if (g.bestScore && g.bestScore === g.score) this.center('NOUVEAU RECORD !', y0 + 8 * big + 22 + n * 10, 1, { fill: '#3affc0', line: '#1a1033' });
      if (g.stateT > 1.5) {
        const yo = Math.floor(H * 0.62);
        if (Math.floor(g.t * 2) % 2 === 0) this.center('ENTRÉE : RECOMMENCER', yo, 1, WHITE);
        if (g.cpOffer != null) this.center(`R : REPRENDRE AU NIVEAU ${g.cpOffer + 1} (3 VIES)`, yo + 14, 1, GOLD);
        this.center('ÉCHAP : RETOUR AU TITRE', yo + (g.cpOffer != null ? 28 : 14), 1, DIM);
      }
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
      `CADEAUX OUVERTS : ${s.presents}`, `TERRIENS CHASSÉS : ${s.chased}`, `REPAS : ${s.eaten}`, `BILLETS EN POCHE : ${g.bucks}`,
      `SCORE : ${g.score}`, ...(g.challenge ? [`DÉFI : ${g.challenge.name} X${g.challenge.mult}`] : []), '',
      'FUNKOTRON REMIX', "D'APRÈS TOEJAM ET EARL (1991)", 'CODE ET 3D : CLAUDE', 'IDÉES ET DIRECTION : MATTHIEU',
      'VOIX ET BRUITAGES : ELEVENLABS', '', 'MUSIQUE',
      'GALACTIC FANDANGO, BACK TO COOL', 'ET CHROME ZONE : SHANE IVERS', 'SILVERMANSOUND.COM (CC BY 4.0)',
      'FUNKY CHIPTUNE : ERIC MATYAS', 'SOUNDIMAGE.ORG (CC BY 3.0)', 'DAWN OF DERANGEMENTS ET',
      "THERE'S NO RUSH : MEGA PIXEL MUSIC LAB", '(CC BY 4.0, OGA-BY 4.0)', 'FUNKOTRON : YUBATAKE,',
      'OPENGAMEART.ORG (CC BY 4.0)', 'JINGLES ET GROOVE SYNTHÉTISÉS', '', 'MERCI POUR LE FUNK.',
    ];
    // le générique défile une fois sur un panneau sombre, puis « FIN »
    const top = 14 + 9 * sc + 8, c = this.x, pw = Math.min(W - 16, 300);
    c.fillStyle = 'rgba(16,12,46,0.78)'; c.fillRect(Math.floor((W - pw) / 2), top - 4, pw, H - 20 - top + 4);
    const end = lines.length * 11 + (H - 20 - top) / 2, off = Math.min(T * 16, end + (H - 20 - top) / 2 - 20);
    lines.forEach((l, i) => { const y = Math.round(H - 20 + i * 11 - off); if (y > top && y < H - 24) this.center(l, y, 1, i < 2 ? GOLD : WHITE); });
    if (T * 16 > end + (H - 20 - top) / 2) this.center('FIN', Math.floor((top + H - 20) / 2) + 40, 2, GOLD);
    if (T > 4 && Math.floor(g.t * 2) % 2 === 0) this.center('ENTRÉE : RETOUR AU TITRE', H - 12, 1, GOLD);
    this.drawCard(dt);
  }

  draw(dt, g) {
    this.x.clearRect(0, 0, this.c.width, this.c.height);
    if (g.state === 'credits') { this.drawCredits(dt, g); return; }
    if (g.state === 'cine') { this.drawCine(dt, g); return; }
    if (g.state === 'title' || (g.state === 'intro' && g.stateT < 0.6 && !g.afterCine)) { this.drawTitle(g); return; }
    if (g.state === 'intro') return;
    this.drawPlay(dt, g);
  }
}
