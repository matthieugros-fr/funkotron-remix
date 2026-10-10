// La musique du jeu, jouée par un petit orchestre synthétisé en direct (Web Audio) : batterie, basse,
// accompagnement, mélodie. Chaque morceau a son tempo, sa gamme, sa grille d'accords et ses instruments ;
// la mélodie est composée une fois pour toutes à partir d'une graine. Forme sur 16 mesures : 8 sans
// mélodie, 8 avec ; toutes les 32 mesures, un break de deux mesures (batterie et basse seules).
// Si un fichier public/music/<nom>.mp3 existe (ACE Music), il passe devant (voir audio.js).
import { mulberry } from './rng.js';

const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixo: [0, 2, 4, 5, 7, 9, 10],
};

export const SONGS = {
  // l'intro : funk qui démarre pied au plancher, cuivres dès la deuxième mesure
  intro: { bpm: 114, swing: 0.1, root: 40, scale: 'dorian', prog: [0, 0, 3, 3, 0, 0, 4, 3], drums: 'funk', bass: 'slap', comp: 'clav', lead: 'brass', seed: 7, mix: 0.95, leadAt: 2, noIntro: true },
  // titre : hip-hop funk, Rhodes, basse slappée, « talk box »
  titre: { bpm: 94, swing: 0.16, root: 40, scale: 'dorian', prog: [0, 0, 3, 3], drums: 'boombap', bass: 'slap', comp: 'rhodes', lead: 'talk', seed: 11, mix: 1 },
  // premiers étages : G-funk nonchalant, nappe, basse qui glisse, sifflement
  'etages-1': { bpm: 92, swing: 0.14, root: 43, scale: 'minor', prog: [0, 0, 3, 3, 0, 0, 5, 4], drums: 'boombap', bass: 'glide', comp: 'pad', lead: 'whistle', seed: 23, mix: 1 },
  // étages du milieu : funk cuivré, clavinet, basse slappée
  'etages-2': { bpm: 110, swing: 0.12, root: 45, scale: 'dorian', prog: [0, 0, 3, 0, 4, 3, 0, 0], drums: 'funk', bass: 'slap', comp: 'clav', lead: 'brass', seed: 37, mix: 0.95 },
  // plus haut : jazz-funk spatial, vibraphone, contrebasse qui marche
  'etages-3': { bpm: 98, swing: 0.3, root: 38, scale: 'dorian', prog: [0, 0, 3, 3, 1, 4, 0, 0], drums: 'swing', bass: 'walk', comp: 'rhodes', lead: 'vibes', seed: 41, mix: 1 },
  // vers le trou noir : funk sombre, orgue, sub-basse, peu de batterie
  'etages-4': { bpm: 84, swing: 0.1, root: 36, scale: 'minor', prog: [0, 5, 3, 4], drums: 'sparse', bass: 'sub', comp: 'organ', lead: 'synth', seed: 53, mix: 1 },
  // le niveau secret : disco funk au bord du jacuzzi
  jam: { bpm: 116, swing: 0.05, root: 40, scale: 'dorian', prog: [0, 3, 0, 3], drums: 'disco', bass: 'pump', comp: 'clav', lead: 'brass', seed: 67, mix: 0.9 },
};

// accord (en midi) bâti sur un degré de la gamme : fondamentale, tierce, quinte, septième
function chord(song, deg, octave) {
  const sc = SCALES[song.scale], at = (k) => song.root + octave + sc[k % 7] + 12 * Math.floor(k / 7);
  return [at(deg), at(deg + 2), at(deg + 4), at(deg + 6)];
}

// la mélodie : quatre phrases de deux mesures, notes de l'accord sur les temps forts, conjointes ailleurs
function compose(song) {
  const r = mulberry(song.seed), sc = SCALES[song.scale], phrases = [];
  const density = { talk: 0.35, whistle: 0.28, brass: 0.32, vibes: 0.42, synth: 0.3 }[song.lead] ?? 0.3;
  let k = 7 + 4; // index dans la gamme (deux octaves au-dessus de la tonique)
  for (let ph = 0; ph < 4; ph++) {
    const notes = [];
    for (let st = 0; st < 32; st++) {
      const strong = st % 8 === 0, onset = strong ? r() < 0.75 : r() < density * (st % 2 ? 0.6 : 1.2);
      if (!onset) continue;
      if (strong) k = 7 + [0, 2, 4][Math.floor(r() * 3)] + (r() < 0.3 ? 7 : 0);
      else k += [-2, -1, -1, 1, 1, 2, 3][Math.floor(r() * 7)];
      k = Math.max(5, Math.min(18, k));
      notes.push({ st, k });
    }
    // chaque note dure jusqu'à la suivante (au plus une mesure)
    notes.forEach((n, i) => { n.len = Math.min(16, (notes[i + 1]?.st ?? 32) - n.st); });
    phrases.push(notes);
  }
  // la quatrième phrase répond à la première : même début, fin vers la tonique
  phrases[3] = phrases[0].map((n, i, a) => ({ ...n, k: i >= a.length - 2 ? 7 : n.k }));
  return phrases.map((p) => p.map((n) => ({ ...n, midi: song.root + 24 + sc[n.k % 7] + 12 * (Math.floor(n.k / 7) - 1) })));
}

const DRUMS = {
  funk: { kick: [[0, 6, 10], [0, 3, 6, 10, 14]], snare: { 4: 1, 12: 1, 7: 0.2, 9: 0.18, 15: 0.25 }, hats: 16, open: [14] },
  boombap: { kick: [[0, 7, 10], [0, 3, 10, 11]], snare: { 4: 1, 12: 1, 15: 0.2 }, hats: 8, open: [] },
  swing: { kick: [[0, 10], [0, 7]], snare: { 12: 0.35, 14: 0.15 }, ride: [0, 6, 8, 14], hats: 0, open: [] },
  sparse: { kick: [[0, 11], [0, 3, 11]], snare: { 8: 1 }, hats: 4, open: [] },
  disco: { kick: [[0, 4, 8, 12], [0, 4, 8, 12]], snare: { 4: 1, 12: 1 }, hats: 16, open: [2, 6, 10, 14] },
};

export class Band {
  constructor(ctx, out, song) {
    this.ctx = ctx; this.out = out; this.song = song;
    this.step16 = 60 / song.bpm / 4;
    this.melody = compose(song);
    const n = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, n, n);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  // joue la double croche n°i à l'instant t
  step(i, t) {
    const S = this.song, s = i % 16, bar = Math.floor(i / 16), ab = bar % 2;
    if (s % 2) t += this.step16 * S.swing;
    const leadAt = S.leadAt ?? 8, brk = bar % 32 >= 30, withLead = bar % 16 >= leadAt && !brk, intro = !S.noIntro && bar < 2;
    const deg = S.prog[bar % S.prog.length], next = S.prog[(bar + 1) % S.prog.length];
    const D = DRUMS[S.drums];
    // batterie
    if (!intro || s >= 8) {
      if (D.kick[ab].includes(s)) this.kick(t, s === 0 ? 1 : 0.85);
      if (D.snare[s]) this.snare(t, D.snare[s], S.drums === 'swing');
      if (D.hats && s % (16 / D.hats) === 0) this.hat(t, s % 4 === 2 ? 0.8 : s % 4 === 0 ? 0.55 : 0.35, false);
      if (D.open.includes(s) && (S.drums === 'disco' || ab)) this.hat(t, 0.8, true);
      if (D.ride?.includes(s)) this.ride(t, s % 8 === 0 ? 0.7 : 0.5);
      if (brk && s >= 8 && s % 2 === 0) this.tom(t, 1 - (s - 8) / 16, 0.6);
      if (bar % 8 === 0 && s === 0 && bar > 0) this.crash(t);
    }
    // basse
    const root = chord(S, deg, -12)[0];
    this.bassLine(t, s, root, chord(S, next, -12)[0], deg);
    if (brk || intro) return;
    // accompagnement
    const ch = chord(S, deg, 12);
    this.compPart(t, s, ch, bar);
    // mélodie
    if (withLead) {
      const ph = this.melody[Math.floor((bar % 16 - leadAt) / 2) % 4], st = ((bar - leadAt) % 2) * 16 + s;
      for (const n of ph) if (n.st === st) this.lead(t, hz(n.midi), n.len * this.step16 * 0.95, n.st % 8 === 0 ? 1 : 0.8);
    }
  }

  bassLine(t, s, root, nextRoot, deg) {
    const S = this.song, L = this.step16;
    switch (S.bass) {
      case 'slap': {
        const pat = [[0, 0, 2, 1], [3, 12, 1, 0.8], [6, 10, 1, 0.8], [7, 12, 1, 0.9], [10, 0, 2, 1], [12, 7, 1, 0.8], [14, 5, 1, 0.75], [15, 3, 1, 0.7]];
        for (const [st, semi, len, v] of pat) if (st === s) this.bass(t, hz(root + semi), len * L * 0.9, v, semi >= 10);
        break;
      }
      case 'glide':
        if (s === 0) this.glideBass(t, hz(root), hz(root), 6 * L, 1);
        if (s === 8) this.glideBass(t, hz(root + 7), hz(root), 4 * L, 0.85);
        if (s === 14) this.glideBass(t, hz(root), hz(nextRoot), 2 * L, 0.8);
        break;
      case 'walk': {
        const sc = SCALES[S.scale], tones = [0, sc[2], sc[4], sc[deg % 2 ? 5 : 6] ?? 10];
        if (s % 4 === 0) this.bass(t, hz(root + (s === 12 ? nextRoot - root - 1 : tones[s / 4])), 3.6 * L, 0.8, false, true);
        break;
      }
      case 'sub':
        if (s === 0) this.sub(t, hz(root), 12 * L, 1);
        if (s === 11) this.sub(t, hz(root), 4 * L, 0.7);
        if (s === 14 && Math.random() < 0.5) this.bass(t, hz(root + 12), L, 0.5, true);
        break;
      case 'pump':
        if (s % 2 === 0) this.bass(t, hz(root + (s % 4 === 2 ? 12 : 0)), L * 1.6, s % 4 === 0 ? 1 : 0.8, s % 4 === 2);
        break;
    }
  }

  compPart(t, s, ch, bar) {
    const S = this.song, L = this.step16;
    switch (S.comp) {
      case 'clav': if ({ 2: 1, 3: 1, 6: 1, 9: 1, 11: 1, 14: 1 }[s]) this.clav(t, ch, s % 4 === 2 ? 0.8 : 0.55); break;
      case 'rhodes': if (s === 0 || s === 6 || (s === 11 && bar % 2)) this.rhodes(t, ch, s === 0 ? 5.5 * L : 4 * L, s === 0 ? 0.9 : 0.6); break;
      case 'pad': if (s === 0) this.pad(t, ch, 16 * L); if (s === 6 || s === 14) this.rhodes(t, ch.slice(1), 1.5 * L, 0.35); break;
      case 'organ': if (s === 0) this.organ(t, ch, 15 * L, 0.5); if (s === 4 || s === 12) this.organ(t, ch, 1.6 * L, 0.35); break;
      case 'vibes': if (s % 2 === 0) this.vibes(t, hz(ch[(s / 2) % 4] + 12), 3 * L, 0.5); break;
    }
  }

  // --- instruments ---------------------------------------------------------------------------------------------
  env(g, t, peak, a, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  osc(type, f, t, end, dest, det = 0) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = f; o.detune.value = det;
    o.connect(dest); o.start(t); o.stop(end);
    return o;
  }

  noiseSrc(t, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.start(t, Math.random() * 0.5, dur);
    return src;
  }

  filt(type, f, q = 1) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  gain() { return this.ctx.createGain(); }

  kick(t, v) {
    const o = this.ctx.createOscillator(), g = this.gain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    this.env(g, t, v, 0.003, 0.36);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + 0.42);
  }

  snare(t, v, rim) {
    const n = this.noiseSrc(t, 0.25), f = this.filt('bandpass', rim ? 3200 : 1900, rim ? 3 : 0.7), g = this.gain();
    this.env(g, t, (rim ? 0.4 : 0.7) * v, 0.002, rim ? 0.05 : v > 0.5 ? 0.17 : 0.07);
    n.connect(f).connect(g).connect(this.out);
    if (rim) return;
    const og = this.gain(), o = this.osc('triangle', 190, t, t + 0.12, og);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    this.env(og, t, 0.4 * v, 0.002, 0.08);
    og.connect(this.out);
  }

  hat(t, v, open) {
    const n = this.noiseSrc(t, open ? 0.3 : 0.06), f = this.filt('highpass', 7500), g = this.gain();
    this.env(g, t, 0.2 * v, 0.001, open ? 0.22 : 0.035);
    n.connect(f).connect(g).connect(this.out);
  }

  ride(t, v) {
    const n = this.noiseSrc(t, 0.5), f = this.filt('bandpass', 6000, 2), g = this.gain();
    this.env(g, t, 0.16 * v, 0.002, 0.35);
    n.connect(f).connect(g).connect(this.out);
  }

  tom(t, k, v) {
    const g = this.gain(), o = this.osc('sine', 90 + 90 * k, t, t + 0.3, g);
    o.frequency.exponentialRampToValueAtTime(60 + 60 * k, t + 0.2);
    this.env(g, t, 0.6 * v, 0.003, 0.25);
    g.connect(this.out);
  }

  crash(t) {
    const n = this.noiseSrc(t, 1.4), f = this.filt('highpass', 5000), g = this.gain();
    this.env(g, t, 0.15, 0.002, 1.3);
    n.connect(f).connect(g).connect(this.out);
  }

  bass(t, f, dur, v, pop, round) {
    const g = this.gain(), lp = this.filt('lowpass', 2000, round ? 1 : 8);
    lp.frequency.setValueAtTime(pop ? 3200 : round ? 900 : 2000, t);
    lp.frequency.exponentialRampToValueAtTime(pop ? 700 : round ? 400 : 320, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.006);
    g.gain.setTargetAtTime(0.3 * v, t + 0.03, 0.08);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.025);
    this.osc(round ? 'triangle' : 'sawtooth', f, t, t + dur + 0.15, lp);
    this.osc(round ? 'sine' : 'square', f * (round ? 1 : 0.5), t, t + dur + 0.15, lp);
    lp.connect(g).connect(this.out);
  }

  // basse « Moog » qui glisse vers la note suivante
  glideBass(t, f0, f1, dur, v) {
    const g = this.gain(), lp = this.filt('lowpass', 700, 4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45 * v, t + 0.02);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
    for (const [type, det] of [['sawtooth', -6], ['sine', 0]]) {
      const o = this.osc(type, f0, t, t + dur + 0.3, lp, det);
      o.frequency.setValueAtTime(f0, t + dur * 0.7);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    }
    lp.connect(g).connect(this.out);
  }

  sub(t, f, dur, v) {
    const g = this.gain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6 * v, t + 0.03);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.1);
    this.osc('sine', f, t, t + dur + 0.5, g);
    const g2 = this.gain(); g2.gain.value = 0.15; this.osc('triangle', f * 2, t, t + dur + 0.5, g2); g2.connect(g);
    g.connect(this.out);
  }

  clav(t, ch, v) {
    const f = this.filt('bandpass', 700 + 1500 * (0.5 + 0.5 * Math.sin(t * Math.PI * this.song.bpm / 120)), 5), g = this.gain();
    f.frequency.exponentialRampToValueAtTime(500, t + 0.09);
    this.env(g, t, 0.1 * v, 0.002, 0.09);
    for (const m of ch) this.osc('square', hz(m), t, t + 0.12, f, (Math.random() - 0.5) * 6);
    f.connect(g).connect(this.out);
  }

  // piano électrique : un peu de cloche (modulation de fréquence), trémolo
  rhodes(t, ch, dur, v) {
    const g = this.gain(), trem = this.ctx.createOscillator(), tg = this.gain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07 * v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.025 * v, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    trem.frequency.value = 5; tg.gain.value = 0.015 * v; trem.connect(tg).connect(g.gain); trem.start(t); trem.stop(t + dur + 0.4);
    for (const m of ch) {
      const car = this.osc('sine', hz(m), t, t + dur + 0.4, g);
      const mod = this.ctx.createOscillator(), mg = this.gain();
      mod.frequency.value = hz(m) * 2; mg.gain.setValueAtTime(hz(m) * 1.2, t); mg.gain.exponentialRampToValueAtTime(hz(m) * 0.05, t + 0.3);
      mod.connect(mg).connect(car.frequency); mod.start(t); mod.stop(t + dur + 0.4);
    }
    g.connect(this.out);
  }

  pad(t, ch, dur) {
    const g = this.gain(), lp = this.filt('lowpass', 1200, 0.7);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
    for (const m of ch) for (const det of [-9, 9]) this.osc('sawtooth', hz(m), t, t + dur * 1.1, lp, det);
    lp.connect(g).connect(this.out);
  }

  organ(t, ch, dur, v) {
    const g = this.gain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03 * v, t + 0.02);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
    for (const m of ch) for (const [mul, a] of [[0.5, 0.6], [1, 1], [2, 0.5], [3, 0.25]]) {
      const ga = this.gain(); ga.gain.value = a;
      this.osc('sine', hz(m) * mul, t, t + dur + 0.4, ga);
      ga.connect(g);
    }
    g.connect(this.out);
  }

  vibes(t, f, dur, v) {
    const g = this.gain(), trem = this.ctx.createOscillator(), tg = this.gain();
    this.env(g, t, 0.09 * v, 0.003, dur);
    trem.frequency.value = 6; tg.gain.value = 0.03 * v; trem.connect(tg).connect(g.gain); trem.start(t); trem.stop(t + dur + 0.1);
    this.osc('sine', f, t, t + dur + 0.1, g);
    const g4 = this.gain(); g4.gain.value = 0.2; this.osc('sine', f * 4, t, t + dur * 0.3, g4); g4.connect(g);
    g.connect(this.out);
  }

  lead(t, f, dur, v) {
    const S = this.song, g = this.gain();
    const vib = this.ctx.createOscillator(), vg = this.gain();
    vib.frequency.value = 5.5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(dur, 0.35));
    vib.connect(vg); vib.start(t); vib.stop(t + dur + 0.2);
    const play = (type, freq, dest, det = 0) => { const o = this.osc(type, freq, t, t + dur + 0.2, dest, det); vg.connect(o.frequency); return o; };
    g.gain.setValueAtTime(0.0001, t);
    switch (S.lead) {
      case 'whistle':
        g.gain.exponentialRampToValueAtTime(0.06 * v, t + 0.04);
        play('sine', f * 2, g);
        break;
      case 'brass': {
        const lp = this.filt('lowpass', 600, 2);
        lp.frequency.setValueAtTime(600, t); lp.frequency.exponentialRampToValueAtTime(3000, t + 0.04); lp.frequency.exponentialRampToValueAtTime(1600, t + 0.2);
        g.gain.exponentialRampToValueAtTime(0.07 * v, t + 0.02);
        play('sawtooth', f, lp, -7); play('sawtooth', f, lp, 7);
        lp.connect(g);
        break;
      }
      case 'vibes':
        this.vibes(t, f, Math.max(0.4, dur), v * 1.4);
        return;
      case 'talk': {
        // « talk box » : une scie filtrée par deux formants qui bougent comme une bouche
        const a = this.filt('bandpass', 700, 6), b = this.filt('bandpass', 1300, 8);
        a.frequency.setValueAtTime(400, t); a.frequency.linearRampToValueAtTime(800, t + Math.min(dur, 0.25));
        b.frequency.setValueAtTime(900, t); b.frequency.linearRampToValueAtTime(1500, t + Math.min(dur, 0.25));
        g.gain.exponentialRampToValueAtTime(0.18 * v, t + 0.03);
        play('sawtooth', f, a); play('sawtooth', f, b);
        a.connect(g); b.connect(g);
        break;
      }
      default: {
        const lp = this.filt('lowpass', 1800, 3);
        g.gain.exponentialRampToValueAtTime(0.06 * v, t + 0.03);
        play('square', f, lp, -5); play('sawtooth', f, lp, 5);
        lp.connect(g);
      }
    }
    g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
    g.connect(this.out);
  }
}

// --- jingles ---------------------------------------------------------------------------------------------------
export const STINGS = {
  morceau: { notes: [[0, 72], [0.09, 76], [0.18, 79], [0.27, 84], [0.36, 88]], hold: 0.7, type: 'brass' },
  ascenseur: { notes: [[0, 60], [0.08, 64], [0.16, 67], [0.24, 72], [0.32, 76], [0.4, 79], [0.48, 84]], hold: 0.6, type: 'brass' },
  'game-over': { notes: [[0, 67], [0.45, 66], [0.9, 65], [1.35, 64]], hold: 1.2, type: 'trombone' },
};

export function playSting(ctx, out, name) {
  const S = STINGS[name];
  if (!S) return 0;
  const t0 = ctx.currentTime + 0.02;
  S.notes.forEach(([dt, m], i) => {
    const last = i === S.notes.length - 1, t = t0 + dt, dur = last ? S.hold : 0.12;
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(S.type === 'trombone' ? 900 : 2800, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.02); g.gain.setTargetAtTime(0.0001, t + dur, 0.08);
    for (const det of [-8, 8]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det;
      if (S.type === 'trombone' && last) o.frequency.exponentialRampToValueAtTime(hz(m - 3), t + dur);
      o.connect(lp); o.start(t); o.stop(t + dur + 0.4);
    }
    lp.connect(g).connect(out);
  });
  return S.notes[S.notes.length - 1][0] + S.hold;
}
