// Interface en police bitmap 5 × 7 maison, dessinée à la résolution du jeu.
import { easeOutBounce, easeInBack, clamp } from './util.js';

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
  'É': '02 04 1F 10 1E 10 1F', 'È': '08 04 1F 10 1E 10 1F', 'À': '08 04 0E 11 1F 11 11', 'Ç': '0E 11 10 10 11 0E 04',
  ' ': '00 00 00 00 00 00 00',
};
const GLYPH = {};
for (const [k, v] of Object.entries(RAW)) GLYPH[k] = v.split(' ').map((h) => parseInt(h, 16));

const INK = { fill: '#ffd23f', line: '#1a1033', shadow: '#ff4a5c' };

export class Hud {
  constructor(canvas) {
    this.c = canvas;
    this.x = canvas.getContext('2d');
    this.card = null;
    this.hint = 0;
  }

  width(s, sc) { return s.length * 6 * sc - sc; }

  glyph(ch, x, y, sc, color) {
    const g = GLYPH[ch] || GLYPH['?'], c = this.x;
    c.fillStyle = color;
    for (let r = 0; r < 7; r++) for (let k = 0; k < 5; k++) if (g[r] & (16 >> k)) c.fillRect(x + k * sc, y + r * sc, sc, sc);
  }

  // Lettre avec contour d'un pixel et ombre portée décalée.
  letter(ch, x, y, sc, ink = INK) {
    x = Math.round(x); y = Math.round(y);
    if (ink.shadow) this.glyph(ch, x + sc, y + sc, sc, ink.shadow);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) this.glyph(ch, x + dx, y + dy, sc, ink.line);
    this.glyph(ch, x, y, sc, ink.fill);
  }

  text(s, x, y, sc, ink = INK) { for (let i = 0; i < s.length; i++) this.letter(s[i], x + i * 6 * sc, y, sc, ink); }
  center(s, y, sc, ink) { this.text(s, Math.floor((this.c.width - this.width(s, sc)) / 2), y, sc, ink); }

  showCard(title, sub = '') { this.card = { title, sub, t: 0 }; }
  toast(text) { this.msg = { text, t: 2 }; }

  // Carton de niveau : les lettres tombent une à une en rebondissant, restent, puis s'envolent.
  drawCard(dt) {
    const k = this.card;
    if (!k) return;
    k.t += dt;
    const sc = Math.max(2, Math.min(4, Math.floor(this.c.width / 110)));
    const w = this.width(k.title, sc), x0 = Math.floor((this.c.width - w) / 2), yT = Math.floor(this.c.height * 0.2);
    for (let i = 0; i < k.title.length; i++) {
      const tin = (k.t - i * 0.045) / 0.6, tout = (k.t - 1.9 - i * 0.035) / 0.42;
      if (tin <= 0) continue;
      let y = yT - (1 - easeOutBounce(tin)) * (yT + 40);
      if (tout > 0) y = yT - easeInBack(tout) * (yT + 50);
      if (tout >= 1) continue;
      this.letter(k.title[i], x0 + i * 6 * sc, y, sc);
    }
    if (k.sub) {
      const a = clamp((k.t - 0.6) / 0.2) * (1 - clamp((k.t - 2.0) / 0.2));
      if (a > 0.5) this.center(k.sub, yT + 9 * sc, 1, { fill: '#ffffff', line: '#1a1033' });
    }
    if (k.t > 3) this.card = null;
  }

  draw(dt, g) {
    const c = this.x, W = this.c.width, H = this.c.height;
    c.clearRect(0, 0, W, H);
    if (g.state === 'title' || g.state === 'intro') {
      if (g.state === 'intro' && g.stateT > 0.6) return;
      const sc = Math.max(2, Math.min(4, Math.floor((W - 16) / 56)));
      const word = 'FUNKOTRON', w = this.width(word, sc), x0 = Math.floor((W - w) / 2), y0 = Math.floor(H * 0.16);
      for (let i = 0; i < word.length; i++) {
        const wob = Math.round(Math.sin(g.t * 3 + i * 0.7) * 2);
        this.letter(word[i], x0 + i * 6 * sc, y0 + wob, sc);
      }
      this.center('REMIX', y0 + 8 * sc + 4, Math.max(1, sc - 2), { fill: '#ff4a5c', line: '#1a1033', shadow: '#ffd23f' });
      if (Math.floor(g.t * 2) % 2 === 0) this.center('APPUIE SUR ENTRÉE', Math.floor(H * 0.7), 1, { fill: '#ffffff', line: '#1a1033' });
      this.center('ZQSD OU FLÈCHES : MARCHER   A / E : TOURNER', H - 14, 1, { fill: '#b9b0de', line: '#1a1033' });
      return;
    }
    this.text(`NIVEAU ${g.player.level + 1}`, 6, 6, 1, { fill: '#ffffff', line: '#1a1033' });
    if (this.msg && (this.msg.t -= dt) > 0) this.text(this.msg.text, W - this.width(this.msg.text, 1) - 6, 6, 1, { fill: '#ffd23f', line: '#1a1033' });
    if (this.hint > 0) {
      this.hint -= dt;
      if (this.hint < 7) this.center("TROUVE L'ASCENSEUR. ÉVITE LE VIDE... OU PAS.", H - 14, 1, { fill: '#ffffff', line: '#1a1033' });
    }
    this.drawCard(dt);
  }
}
