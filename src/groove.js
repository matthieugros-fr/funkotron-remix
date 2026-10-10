// Le groove du désœuvrement : un funk synthétisé en direct (batterie, basse slappée, guitare wah, cuivres),
// en mi mineur, joué quand plus personne ne touche aux commandes. Les danses se calent sur ses temps.
// Tout est fabriqué par Web Audio : marche aussi dans un OfflineAudioContext (pour les tests).

export const BPM = 108;
const S16 = 60 / BPM / 4;   // une double croche
const SWING = 0.14;         // les doubles croches impaires traînent un peu
const E1 = 41.2;
const hz = (base, semis) => base * 2 ** (semis / 12);

// motifs sur 16 pas ; deux mesures qui alternent (A, B), cuivres à la 4e mesure
const KICK = [[0, 6, 10], [0, 3, 6, 10, 14]];
const SNARE = { 4: 1, 12: 1, 7: 0.22, 9: 0.18, 15: 0.25 };
const BASS = [
  [[0, 0, 2, 1], [3, 12, 1, 0.8], [4, 0, 1, 0.6], [6, 10, 1, 0.8], [7, 12, 1, 0.9], [10, 0, 2, 1], [12, 3, 1, 0.8], [13, 5, 1, 0.8], [14, 7, 2, 0.9]],
  [[0, 0, 2, 1], [3, 12, 1, 0.8], [6, 0, 1, 0.7], [7, 10, 1, 0.8], [8, 12, 1, 0.9], [10, 7, 1, 0.8], [11, 5, 1, 0.7], [12, 3, 2, 0.9], [14, 2, 1, 0.7], [15, -2, 1, 0.7]],
];
const CLAV = { 2: 0.7, 3: 0.45, 6: 0.8, 9: 0.6, 11: 0.75, 14: 0.6 };
const CHORD = [164.81, 196.0, 246.94, 293.66, 369.99]; // mi mineur 9
const HORNS = [329.63, 392.0, 493.88, 587.33];

export class Groove {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = out;
    const n = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, n, n);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  // joue la double croche n°i (depuis le début) à l'instant t
  step(i, t) {
    const s = i % 16, bar = Math.floor(i / 16), ab = bar % 2;
    if (s % 2) t += S16 * SWING;
    if (KICK[ab].includes(s)) this.kick(t, s === 0 ? 1 : 0.85);
    if (SNARE[s]) this.snare(t, SNARE[s]);
    const open = ab === 1 && s === 14;
    this.hat(t, open ? 0.9 : s % 4 === 2 ? 0.8 : s % 2 ? 0.35 : 0.55, open);
    for (const [st, semis, len, v] of BASS[ab]) if (st === s) this.bass(t, hz(E1, semis), len * S16 * 0.92, v, semis >= 10);
    if (CLAV[s]) this.clav(t, CLAV[s]);
    if (bar % 4 === 3 && (s === 12 || s === 14)) this.horns(t, s === 14 ? 1 : 0.8);
    if (bar % 8 === 0 && s === 0 && bar > 0) this.crash(t);
  }

  env(g, t, peak, a, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  noiseSrc(t, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.start(t, Math.random() * 0.5, dur);
    return src;
  }

  kick(t, v) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    this.env(g, t, v, 0.003, 0.38);
    o.connect(g).connect(this.out);
    o.start(t); o.stop(t + 0.45);
    const c = this.noiseSrc(t, 0.02), f = this.ctx.createBiquadFilter(), cg = this.ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 3000;
    this.env(cg, t, 0.25 * v, 0.001, 0.015);
    c.connect(f).connect(cg).connect(this.out);
  }

  snare(t, v) {
    const n = this.noiseSrc(t, 0.25), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
    this.env(g, t, 0.75 * v, 0.002, v > 0.5 ? 0.17 : 0.07);
    n.connect(f).connect(g).connect(this.out);
    const o = this.ctx.createOscillator(), og = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    this.env(og, t, 0.45 * v, 0.002, 0.08);
    o.connect(og).connect(this.out);
    o.start(t); o.stop(t + 0.12);
  }

  hat(t, v, open) {
    const n = this.noiseSrc(t, open ? 0.3 : 0.06), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 7500;
    this.env(g, t, 0.22 * v, 0.001, open ? 0.24 : 0.035);
    n.connect(f).connect(g).connect(this.out);
  }

  bass(t, freq, dur, v, pop) {
    const g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 8;
    f.frequency.setValueAtTime(pop ? 3200 : 2000, t);
    f.frequency.exponentialRampToValueAtTime(pop ? 700 : 320, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55 * v, t + 0.006);
    g.gain.setTargetAtTime(0.32 * v, t + 0.03, 0.08);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.025);
    for (const [type, mul] of [['sawtooth', 1], ['square', 0.5]]) {
      const o = this.ctx.createOscillator();
      o.type = type; o.frequency.value = freq * mul;
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.15);
    }
    f.connect(g).connect(this.out);
  }

  // guitare « chicken scratch » : accord étouffé, filtre wah qui balaie au rythme de la mesure
  clav(t, v) {
    const f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    const ph = (t * BPM) / 60 / 2;
    f.type = 'bandpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(700 + 1500 * (0.5 + 0.5 * Math.sin(ph * Math.PI * 2)), t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.09);
    this.env(g, t, 0.12 * v, 0.002, 0.09);
    for (const fr of CHORD) {
      const o = this.ctx.createOscillator();
      o.type = 'square'; o.frequency.value = fr * (1 + (Math.random() - 0.5) * 0.004);
      o.connect(f);
      o.start(t); o.stop(t + 0.12);
    }
    f.connect(g).connect(this.out);
  }

  horns(t, v) {
    const f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.03);
    f.frequency.exponentialRampToValueAtTime(1400, t + 0.16);
    this.env(g, t, 0.2 * v, 0.012, 0.2);
    for (const fr of HORNS) for (const det of [-0.006, 0.006]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = fr * (1 + det);
      o.connect(f);
      o.start(t); o.stop(t + 0.3);
    }
    f.connect(g).connect(this.out);
  }

  crash(t) {
    const n = this.noiseSrc(t, 1.4), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 5000;
    this.env(g, t, 0.18, 0.002, 1.3);
    n.connect(f).connect(g).connect(this.out);
  }
}

export const STEP = S16;
