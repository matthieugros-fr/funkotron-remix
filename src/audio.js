// Sons du jeu : bruitages (ElevenLabs, public/sfx) et musiques (morceaux sous licence libre, public/music ; crédits dans
// public/music/CREDITS.md).
// - chaque bruitage peut avoir plusieurs prises (nom_1, nom_2…) : on en tire une au hasard,
//   avec une petite variation de hauteur, pour éviter la répétition ;
// - quelques sons tournent en boucle (patins, ailes, pluie, ambiance) ;
// - la musique change en fondu enchaîné selon l'étage ; les jingles passent par-dessus.
// ?muet dans l'adresse coupe tout. Les fichiers absents sont simplement ignorés.

import { Groove, BPM, STEP } from './groove.js';
import { SONGS, Band, playSting } from './music.js';
import { settings } from './save.js';

const MUTED = new URLSearchParams(location.search).has('muet');
const SFX = {
  pas: 2, eclaboussure: 2, pas_eau: 2, surprise: 2, chute: 2, splat: 2, desequilibre: 2, portes: 2, decollage: 2, arrivee: 2,
  cadeau_ramasse: 2, cadeau_ouvre: 2, billet: 2, morceau: 2, patins: 2, ailes: 2, ressort: 2, tomate_lancer: 2, tomate_splat: 2, pluie: 2,
  aie: 1, perceuse: 1, intellos: 1, cupidon: 1, coeur: 1, diable: 1, hamster: 1, cantatrice: 1, sage: 1, poof: 1, manger: 1, beurk: 1, promotion: 1,
  porte: 1, bummer: 1, vie: 1, jackpot: 1, menu_curseur: 1, menu_ouvre: 1, livraison: 1, boite: 1, ambiance: 1, carte: 1,
  highfive: 2, croquemitaine: 2,
  cine_fusee: 1, cine_asteroide: 1, cine_scratch: 1, cine_crash: 1, cine_sifflet: 1, cine_atterrissage: 1, tondeuse: 2, caddie: 2, taupe: 2, poulet: 2, oeuf: 2, perenoel: 2,
};
// voix de ToeJam (tj) et d'Earl (earl), ElevenLabs, deux prises par réplique : public/voix/{tj|earl}_{réplique}_{n}.mp3
const VOICE_LINES = ['yo', 'funky', 'chute', 'aie', 'cadeau', 'miam', 'beurk', 'appel', 'morceau', 'piege'];
const VOICE_TAKES = 2;
const VOLUME = { tondeuse: 0.55, caddie: 0.6, croquemitaine: 0.7, pas: 0.35, pas_eau: 0.4, menu_curseur: 0.5, ambiance: 0.35, patins: 0.45, ailes: 0.5, pluie: 0.45, billet: 0.7 };
// musique de fond selon l'étage (index 0 à 24 ; 25 = Funkotron)
export const musicForLevel = (k) => (k < 0 ? 'jam' : k >= 25 ? 'funkotron' : k < 5 ? 'etages-1' : k < 12 ? 'etages-2' : k < 20 ? 'etages-3' : 'etages-4');
// Morceaux enregistrés : fichier de public/music, boucle [début, fin] en secondes (mesurée sur le morceau ; la fin de
// boucle a été fondue dans ce qui précède son début), volume. Un nom absent d'ici joue l'orchestre synthétisé (music.js).
const TRACKS = {
  titre: { file: 'galactic-fandango', loop: [0, 179] },
  intro: { file: 'back-to-cool', loop: [18.4615, 83.0769] },
  'etages-1': { file: 'back-to-cool', loop: [18.4615, 83.0769] },
  'etages-2': { file: 'funky-chiptune', loop: [0.04, 75] },
  'etages-3': { file: 'dawn-of-derangements', loop: [10.6667, 362.6667] },
  'etages-4': { file: 'chrome-zone', loop: [24.25, 64.25] },
  jam: { file: 'theres-no-rush', loop: [60.75, 149.55] },
  funkotron: { file: 'funkotron-yubatake', loop: [0, 222.1254] },
};
const MUSIC_VOL = 0.75;

class Sound {
  constructor() {
    this.ctx = null; this.buffers = new Map(); this.loops = new Map(); this.music = null; this.musicName = null;
    this.voiceT = {}; this.voiceLast = {};
    if (MUTED) return;
    const unlock = () => { this.init(); this.ctx?.resume(); };
    addEventListener('keydown', unlock);
    addEventListener('pointerdown', unlock);
  }

  init() {
    if (this.ctx || MUTED) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain(); this.musicBus.connect(this.master);
    this.setVolumes();
    for (const [name, n] of Object.entries(SFX)) for (let i = 1; i <= n; i++) this.load(`sfx/${name}_${i}.mp3`);
    for (const who of ['tj', 'earl']) for (const l of VOICE_LINES) for (let i = 1; i <= VOICE_TAKES; i++) this.load(`voix/${who}_${l}_${i}.mp3`);
    if (this.wantMusic) this.playMusic(this.wantMusic);
    this.load('sfx/ambiance_1.mp3').then(() => this.loop('ambiance', true));
  }

  async load(path) {
    if (this.buffers.has(path)) return this.buffers.get(path);
    const p = fetch(path).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? this.ctx.decodeAudioData(b) : null)).catch(() => null);
    this.buffers.set(path, p);
    const buf = await p;
    this.buffers.set(path, buf);
    return buf;
  }

  pick(name) {
    const n = SFX[name] || 1, opts = [];
    for (let i = 1; i <= n; i++) { const b = this.buffers.get(`sfx/${name}_${i}.mp3`); if (b && !(b instanceof Promise)) opts.push(b); }
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
  }

  // Joue un bruitage ; vol et rate optionnels. Renvoie la source (ou null).
  play(name, { vol = 1, rate = 1, vary = 0.06 } = {}) {
    if (!this.ctx) return null;
    const buf = this.pick(name);
    if (!buf) return null;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf;
    src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * vary);
    g.gain.value = vol * (VOLUME[name] ?? 0.8);
    src.connect(g).connect(this.sfxBus);
    src.start();
    return src;
  }

  // Répliques de l'intro (public/voix/<nom>.mp3), chargées à l'avance.
  preloadVoices(names) { if (this.ctx) for (const n of names) this.load(`voix/${n}.mp3`); }
  async voice(name) {
    if (!this.ctx || !settings.voices) return;
    const buf = await this.load(`voix/${name}.mp3`);
    if (!buf) return;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf; g.gain.value = 1.1;
    src.connect(g).connect(this.sfxBus);
    src.start();
  }

  // Volumes réglés dans le menu (0 à 1) : musique, bruitages ; les voix suivent les bruitages, ou se taisent.
  setVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicLevel = 0.45 * settings.music;
    this.sfxBus.gain.setTargetAtTime(0.8 * settings.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.gr ? 0.1 * settings.music : this.musicLevel, t, 0.05);
    if (this.gr) this.gr.bus.gain.setTargetAtTime(0.6 * settings.music, t, 0.05);
  }

  // Réplique d'un personnage. Pas plus d'une toutes les 2 s par personnage (sauf `force`), jamais deux fois
  // la même prise de suite. Renvoie true si quelque chose est parti.
  say(kind, line, force = false) {
    if (!this.ctx || !settings.voices) return false;
    const who = kind === 'earl' ? 'earl' : 'tj', now = this.ctx.currentTime;
    if (!force && now - (this.voiceT[who] ?? -9) < 2) return false;
    const takes = [];
    for (let i = 1; i <= VOICE_TAKES; i++) { const b = this.buffers.get(`voix/${who}_${line}_${i}.mp3`); if (b && !(b instanceof Promise)) takes.push(b); }
    if (!takes.length) return false;
    const pool = takes.length > 1 ? takes.filter((b) => b !== this.voiceLast[who + line]) : takes;
    const buf = pool[Math.floor(Math.random() * pool.length)];
    this.voiceLast[who + line] = buf;
    this.voiceT[who] = now;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf;
    src.playbackRate.value = 1 + (Math.random() * 2 - 1) * 0.02;
    g.gain.value = 1;
    src.connect(g).connect(this.sfxBus);
    src.start();
    return true;
  }

  // Active ou coupe un son en boucle, avec un fondu court.
  loop(name, on, vol = 1) {
    if (!this.ctx) return;
    let l = this.loops.get(name);
    if (on && !l) {
      const buf = this.pick(name);
      if (!buf) return;
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = buf; src.loop = true;
      g.gain.value = 0;
      src.connect(g).connect(this.sfxBus);
      src.start();
      l = { src, g };
      this.loops.set(name, l);
    }
    if (!l) return;
    const t = this.ctx.currentTime, target = on ? vol * (VOLUME[name] ?? 0.8) : 0;
    l.g.gain.cancelScheduledValues(t);
    l.g.gain.setTargetAtTime(target, t, 0.08);
    if (!on) {
      this.loops.delete(name);
      setTimeout(() => { try { l.src.stop(); } catch (e) { /* déjà arrêté */ } }, 600);
    }
  }

  // Musique de fond : fondu enchaîné de 2 secondes vers le morceau demandé.
  async playMusic(name) {
    this.wantMusic = name;
    if (!this.ctx || this.musicName === name) return;
    this.musicName = name;
    const tr = TRACKS[name];
    const buf = name ? await this.load(`music/${tr ? tr.file : name}.mp3`) : null;
    if (this.musicName !== name) return;
    const t = this.ctx.currentTime;
    if (this.music) {
      const old = this.music;
      old.g.gain.setTargetAtTime(0, t, 0.6);
      setTimeout(() => old.stop(), 3000);
      this.music = null;
    }
    // pas de fichier : l'orchestre synthétisé joue le morceau
    if (!buf) { if (name && SONGS[name]) this.music = this.startBand(SONGS[name]); return; }
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf; src.loop = true;
    if (tr?.loop && tr.loop[1] <= buf.duration) { src.loopStart = tr.loop[0]; src.loopEnd = tr.loop[1]; }
    g.gain.value = 0;
    g.gain.setTargetAtTime(MUSIC_VOL, t, 0.6);
    src.connect(g).connect(this.musicBus);
    src.start();
    this.music = { g, vol: MUSIC_VOL, stop: () => { try { src.stop(); } catch (e) { /* déjà arrêté */ } } };
  }

  // L'orchestre : compresseur, gain, limiteur (crête mesurée hors ligne autour de 0,9), puis la musique.
  startBand(song) {
    const ctx = this.ctx, t = ctx.currentTime;
    const comp = ctx.createDynamicsCompressor(), bus = ctx.createGain(), lim = ctx.createDynamicsCompressor(), g = ctx.createGain();
    comp.threshold.value = -18; comp.ratio.value = 3;
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001;
    bus.gain.value = 0.7 * song.mix;
    g.gain.value = 0; g.gain.setTargetAtTime(1, t, 0.6);
    comp.connect(bus).connect(lim).connect(g).connect(this.musicBus);
    const band = new Band(ctx, comp, song), start = t + 0.1, step = band.step16;
    let next = 0;
    const tick = () => { while (start + next * step < ctx.currentTime + 0.15) { band.step(next, start + next * step); next++; } };
    tick();
    const timer = setInterval(tick, 30);
    return { g, stop: () => { clearInterval(timer); setTimeout(() => g.disconnect(), 500); } };
  }

  // Le groove du désœuvrement : la musique des étages passe au second plan, le funk monte, plus fort.
  groove(on) {
    if (!this.ctx || !!this.gr === on) return;
    const t = this.ctx.currentTime;
    if (on) {
      // compresseur pour tasser le groove, gain, puis limiteur : fort, sans saturer (crête ≈ 0,8 mesurée hors ligne)
      const bus = this.ctx.createGain(), comp = this.ctx.createDynamicsCompressor(), lim = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.12;
      lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
      bus.gain.value = 0;
      bus.gain.setTargetAtTime(0.6 * settings.music, t, 0.25);
      comp.connect(bus).connect(lim).connect(this.master);
      const gr = (this.gr = { g: new Groove(this.ctx, comp), bus, start: t + 0.1, next: 0 });
      gr.timer = setInterval(() => this.tickGroove(), 25);
      this.tickGroove();
      this.musicBus.gain.setTargetAtTime(0.1 * settings.music, t, 0.4);
    } else {
      const gr = this.gr;
      this.gr = null;
      gr.bus.gain.setTargetAtTime(0, t, 0.15);
      setTimeout(() => { clearInterval(gr.timer); gr.bus.disconnect(); }, 1200);
      this.musicBus.gain.setTargetAtTime(this.musicLevel, t, 0.6);
    }
  }

  tickGroove() {
    const gr = this.gr;
    if (!gr) return;
    while (gr.start + gr.next * STEP < this.ctx.currentTime + 0.12) { gr.g.step(gr.next, gr.start + gr.next * STEP); gr.next++; }
  }

  // temps écoulés depuis le début du groove (null sans son) : les danses se calent dessus
  beats() { return this.gr ? Math.max(0, ((this.ctx.currentTime - this.gr.start) * BPM) / 60) : null; }

  // Jingle : la musique s'efface le temps qu'il passe.
  async jingle(name) {
    if (!this.ctx) return;
    const buf = await this.load(`music/${name}.mp3`);
    if (!buf) {
      // jingle synthétisé, la musique s'efface le temps qu'il passe
      const dur = playSting(this.ctx, this.musicBus, name), t = this.ctx.currentTime;
      if (dur && this.music) { this.music.g.gain.setTargetAtTime(0.2, t, 0.05); this.music.g.gain.setTargetAtTime(this.music.vol ?? 1, t + dur, 0.4); }
      return;
    }
    const t = this.ctx.currentTime, src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.musicBus);
    if (this.music) {
      this.music.g.gain.setTargetAtTime(0.15, t, 0.1);
      this.music.g.gain.setTargetAtTime(this.music.vol ?? 1, t + buf.duration, 0.5);
    }
    src.start();
  }
}

export const sound = new Sound();
