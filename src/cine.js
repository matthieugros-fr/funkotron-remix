// L'intro : en route pour Funkotron, Earl conduit « sans les mains », l'astéroïde, le crash, les dix morceaux
// qui s'éparpillent, la chute sur Terre. Environ 27 secondes, que l'on peut passer (Entrée, Espace, Échap).
// La scène dans l'espace se joue loin des îles, à hauteur du premier étage : rien d'autre à l'écran que le ciel.
import * as THREE from 'three';
import { buildRocket, setRocketPieces } from './specials.js';
import { levelUniforms } from './dither.js';
import { sound } from './audio.js';

const SPACE = new THREE.Vector3(150, 2, -10);
const SPEED = 3.2;           // la fusée avance (les traits d'étoiles font le reste)
const CRASH = 11.4;          // instant du choc
const LAND = 15.0;           // retour sur Terre (niveau 1)
const TITLE = 24.0;          // le titre claque, la musique repart

// Les répliques : instant, qui parle, texte affiché, fichier de voix.
const LINES = [
  { at: 0.6, who: null, text: 'QUELQUE PART DANS LA GALAXIE, EN ROUTE POUR FUNKOTRON...' },
  { at: 2.2, who: 'tj', text: "WESH EARL, T'AS LE PERMIS POUR CE TRUC ?", voice: 'tj_cine1' },
  { at: 5.1, who: 'earl', text: 'LE PERMIS... TÉMA : SANS LES MAINS.', voice: 'earl_cine1' },
  { at: 7.9, who: 'tj', text: 'EARL... EARL ! LE CAILLOU, BALTRINGUE !', voice: 'tj_cine2' },
  { at: 10.7, who: 'earl', text: '... OUPS.', voice: 'earl_cine2' },
  { at: 12.6, who: null, text: 'LA FUSÉE EST EN MILLE MORCEAUX. ENFIN, EN DIX.' },
  { at: 15.6, who: null, text: 'PENDANT CE TEMPS, SUR UNE DRÔLE DE PLANÈTE APPELÉE LA TERRE...' },
  { at: 20.4, who: 'tj', text: 'WOLLAH, FAUT RETROUVER LES DIX MORCEAUX !', voice: 'tj_cine3' },
];
const LAST_COOP = { at: 22.8, who: 'earl', text: 'BIENVENUE SUR TERRE, LE SANG.', voice: 'earl_cine3' };
const LAST_SOLO = { at: 22.8, who: 'earl', text: 'VAS-Y, TOI. MOI... JE FAIS LA SIESTE.', voice: 'earl_cine4' };

export class IntroCine {
  constructor(g) {
    this.g = g; this.t = 0; this.flags = {}; this.done = false;
    const [tj, earl] = g.players;
    this.tj = tj; this.earl = earl;
    this.lines = [...LINES, g.coop ? LAST_COOP : LAST_SOLO];
    this.END = g.coop ? 26.5 : 28;
    this.home = [tj.pos.clone(), earl.pos.clone()];
    this.homeLevel = tj.level;
    for (const p of g.players) { p.cineOn = true; p.visible = true; p.control = false; p.alt = 0; }
    sound.preloadVoices(this.lines.filter((l) => l.voice).map((l) => l.voice));

    // la fusée, entière, couchée à l'horizontale (le nez vers +x)
    const pad = buildRocket(levelUniforms(THREE));
    setRocketPieces(pad, new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    this.parts = pad.userData.parts;
    const inner = pad.userData.rocket;
    inner.position.set(0, 0, 0);
    this.rocket = new THREE.Group();
    this.rocket.add(inner);
    this.rocket.rotation.z = -Math.PI / 2;
    g.scene.add(this.rocket);

    // l'astéroïde, bosselé, cratérisé
    const geo = new THREE.IcosahedronGeometry(2.2, 1), pos = geo.attributes.position;
    // même point, même bosse : le caillou reste d'un seul bloc
    const bump = (x, y, z) => { const h = Math.sin(Math.round(x * 100) * 12.9898 + Math.round(y * 100) * 78.233 + Math.round(z * 100) * 37.719) * 43758.5453; return 1 + (h - Math.floor(h)) * 0.28; };
    for (let i = 0; i < pos.count; i++) { const k = bump(pos.getX(i), pos.getY(i), pos.getZ(i)); pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k); }
    geo.computeVertexNormals();
    this.rock = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#8a7462', flatShading: true }));
    for (let k = 0; k < 6; k++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.35 + k * 0.05, 8, 6), new THREE.MeshLambertMaterial({ color: '#5a4a3e', flatShading: true }));
      const a = k * 1.7, b = k * 0.9;
      c.position.set(Math.cos(a) * Math.cos(b) * 2.1, Math.sin(b) * 2.1, Math.sin(a) * Math.cos(b) * 2.1);
      c.scale.set(1, 0.4, 1); c.lookAt(0, 0, 0);
      this.rock.add(c);
    }
    this.rock.visible = false;
    g.scene.add(this.rock);

    // traits d'étoiles qui défilent : l'impression de vitesse
    this.N = 50;
    this.lp = new Float32Array(this.N * 6);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(this.lp, 3));
    this.streaks = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#dfe6ff', transparent: true, opacity: 0.8 }));
    this.streaks.frustumCulled = false;
    g.scene.add(this.streaks);
    this.sp = Array.from({ length: this.N }, () => this.newStreak(true));

    g.cam.view = g.cam.viewT = 9; g.cam.yaw = g.cam.yawT = 0.75;
    this.shooting = [];
    this.flying = [];
  }

  newStreak(any) {
    return { x: (any ? Math.random() * 30 : 18) - 12, y: (Math.random() - 0.5) * 12, z: (Math.random() - 0.5) * 14 - 2, len: 0.6 + Math.random() * 2.5, v: 14 + Math.random() * 18 };
  }

  once(k) { if (this.flags[k]) return false; this.flags[k] = true; return true; }
  rocketPos(t) { return SPACE.clone().add(new THREE.Vector3(t * SPEED, Math.sin(t * 2.1) * 0.18, 0)); }

  say(line) {
    this.g.hud.subtitle(line.who, line.text);
    if (line.voice) sound.voice(line.voice);
  }

  skip() {
    if (this.t >= this.END - 0.3) return;
    for (const l of this.lines) this.flags['line' + l.at] = true;
    this.t = this.END;
  }

  update(dt) {
    const g = this.g, t = (this.t += dt), { tj, earl } = this;
    for (const l of this.lines) if (t >= l.at && this.once('line' + l.at)) this.say(l);
    if (t >= this.END) { this.finish(); return g.focus; }

    if (t < LAND) this.space(t, dt);
    else this.earth(t, dt);
    return g.focus;
  }

  // --- dans l'espace -----------------------------------------------------------------------------------------------
  space(t, dt) {
    const g = this.g, { tj, earl } = this;
    if (this.once('music')) sound.playMusic('intro');
    if (this.once('flyby')) sound.play('cine_fusee', { vol: 0.8 });
    const R = this.rocketPos(Math.min(t, CRASH));
    if (t < CRASH) {
      this.rocket.position.copy(R);
      this.rocket.rotation.x = Math.sin(t * 1.3) * 0.08;
      // flamme du réacteur
      for (let k = 0; k < 3; k++) g.fx.spawn(R.x - 0.2, R.y + (Math.random() - 0.5) * 0.4, R.z + (Math.random() - 0.5) * 0.4, -5 - Math.random() * 4, (Math.random() - 0.5), (Math.random() - 0.5), 0.35, ['#ffd23f', '#ff8a3a', '#ff4a5c'][k], 0, 2);
      // le duo debout sur la fusée : ToeJam danse, Earl « conduit »
      const top = 0.55;
      tj.pos.set(R.x + 1.3, R.y + top, R.z + 0.15);
      earl.pos.set(R.x + 2.7, R.y + top, R.z - 0.1);
      for (const p of [tj, earl]) { p.faceDir(1, 0); p.heading = p.headingT; p.ground = p.pos.y; }
      tj.anim = t < 7.8 ? 'dance' : 'teeter';
      earl.anim = t < 5.1 ? 'idle' : t < 9.6 ? 'dance' : 'teeter';
      if (t > 7.8) tj.emote('peur', 0.3);
      if (t > 5.1 && t < 9.6) earl.emote('joie', 0.3);
      g.focus.set(R.x + 1.8, R.y + 0.8, R.z); g.focusB.copy(g.focus);
    }
    // l'astéroïde arrive par la droite
    if (t > 7.0) {
      this.rock.visible = true;
      if (this.once('rock')) sound.play('cine_asteroide');
      if (t > 9.5 && this.once('rock2')) sound.play('cine_asteroide', { rate: 0.8 });
      const k = t - 7.0;
      // il fonce sur la fusée, puis poursuit sa route (plus vite) et sort du cadre
      const after = Math.max(0, t - CRASH);
      this.rock.position.set(this.rocketPos(Math.min(t, CRASH)).x + 14 - Math.min(k, CRASH - 7.0) * 2.5 - after * 7, R.y + 0.4 - after * 0.8, R.z + after * 1.5);
      this.rock.rotation.set(t * 0.4, t * 0.7, 0);
    }
    // le choc
    if (t >= CRASH - 0.1 && this.once('scratch')) { sound.play('cine_scratch'); sound.playMusic(null); }
    if (t >= CRASH && this.once('crash')) this.crash(R);
    if (t >= CRASH) {
      for (const f of this.flying) {
        f.o.position.addScaledVector(f.v, dt);
        f.v.y -= 1.5 * dt;
        f.o.rotation.x += f.w.x * dt; f.o.rotation.y += f.w.y * dt; f.o.rotation.z += f.w.z * dt;
      }
      for (const [p, v] of [[tj, this.vT], [earl, this.vE]]) {
        p.pos.addScaledVector(v, dt); v.y -= 1.2 * dt;
        p.anim = 'fall'; p.heading += dt * 9; p.headingT = p.heading; p.ground = p.pos.y;
      }
      g.focus.lerp(new THREE.Vector3(R.x + 0.5, R.y + 0.2, R.z), Math.min(1, dt * 2)); g.focusB.copy(g.focus);
      g.cam.viewT = 13;
      if (t > LAND - 1.2 && this.once('whistle')) sound.play('cine_sifflet');
    }
    // traits d'étoiles
    const F = g.focus;
    this.sp.forEach((s, i) => {
      s.x -= s.v * dt * (t < CRASH ? 1 : 0.15);
      if (s.x < -16) Object.assign(s, this.newStreak(false));
      this.lp.set([F.x + s.x, F.y + s.y, F.z + s.z, F.x + s.x + s.len, F.y + s.y, F.z + s.z], i * 6);
    });
    this.streaks.geometry.attributes.position.needsUpdate = true;
    this.streaks.visible = true;
  }

  crash(R) {
    const g = this.g;
    sound.play('cine_crash');
    g.flash = 1; g.shake = 9;
    g.hud.showCard('CRAAASH !', '');
    for (let k = 0; k < 4; k++) g.fx.dust(R.clone().add(new THREE.Vector3(3 + Math.random(), Math.random() - 0.5, Math.random() - 0.5)), 24, ['#ffd23f', '#ff8a3a', '#ffffff', '#ff4a5c']);
    // les dix morceaux s'envolent chacun de son côté
    this.parts.forEach((part, i) => {
      if (!part) return;
      g.scene.attach(part);
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.5;
      this.flying.push({ o: part, v: new THREE.Vector3(-2 - Math.random() * 4, Math.sin(a) * 4, Math.cos(a) * 4), w: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8) });
    });
    this.vT = new THREE.Vector3(-3, 3.5, 1.5);
    this.vE = new THREE.Vector3(-1.5, 2.5, -2);
    this.tj.emote('peur', 4); this.earl.emote('surprise', 4);
  }

  // --- sur Terre ---------------------------------------------------------------------------------------------------
  earth(t, dt) {
    const g = this.g, { tj, earl } = this, k = t - LAND;
    if (this.once('cut')) {
      // retour sur l'île : on range l'espace
      for (const o of [this.rocket, this.rock, this.streaks, ...this.flying.map((f) => f.o)]) g.scene.remove(o);
      g.cam.view = g.cam.viewT = 14; g.cam.yaw = g.cam.yawT = 0.55;
      const c = this.home[0].clone().add(new THREE.Vector3(0.6, 1.2, 0));
      g.focus.copy(c); g.focusB.copy(c);
      // dix étoiles filantes : les morceaux qui tombent partout dans les étages
      for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: '#fff3a0' }));
        // elles traversent le ciel de l'image et disparaissent derrière l'île
        const to = c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 22, -6 - Math.random() * 4, -8 - Math.random() * 6));
        const from = to.clone().add(new THREE.Vector3(-8 + Math.random() * 4, 16, 4));
        m.position.copy(from); g.scene.add(m);
        this.shooting.push({ m, from, to, t0: i * 0.18 });
      }
    }
    for (const s of this.shooting) {
      const e = Math.max(0, Math.min(1, (k - s.t0) / 1.4));
      s.m.position.lerpVectors(s.from, s.to, e);
      s.m.visible = e > 0 && e < 1;
      if (s.m.visible) g.fx.spawn(s.m.position.x, s.m.position.y, s.m.position.z, 0, 0, 0, 0.5, '#ffe36b', 0, 0);
    }
    // le duo tombe du ciel et s'écrase au point de départ
    const fallT = 0.9, landT = 2.6;
    [tj, earl].forEach((p, i) => {
      const home = this.home[i], d = landT + i * 0.25;
      if (k < d) {
        const e = Math.max(0, (k - fallT) / (d - fallT));
        p.pos.set(home.x - 2 * (1 - e), home.y + 9 * (1 - e * e), home.z - 1.5 * (1 - e));
        if (Math.random() < 0.5) g.fx.spawn(p.pos.x, p.pos.y + 1.2, p.pos.z, 0, 0, 0, 0.4, '#ffffff', 0, 0);
        p.anim = 'fall'; p.ground = p.pos.y;
        p.visible = k > fallT;
      } else {
        if (this.once('land' + i)) {
          p.pos.copy(home); p.ground = home.y; p.squash = 1;
          g.fx.dust(home, 20); g.shake = 4;
          sound.play(i ? 'splat' : 'cine_atterrissage');
        }
        p.anim = k < d + 1.6 ? 'splat' : k < d + 2.6 ? 'getup' : 'idle';
        p.faceDir(1, 1); p.heading = p.headingT;
      }
    });
    if (k > 5 && k < 7) tj.emote('colere', 0.3);
    // en solo, Earl s'allonge pour sa sieste
    if (!g.coop && t > 24.4) { earl.anim = 'splat'; if (Math.random() < 0.05) g.fx.sparkle(earl.mid().add(new THREE.Vector3(0.3, 0.6, 0)), '#ffffff', 1, 0.2); }
    // la musique repart, le titre claque
    if (t > TITLE && this.once('title')) { sound.playMusic('intro'); g.hud.showCard('FUNKOTRON REMIX', 'TROUVE LES 10 MORCEAUX !'); }
  }

  finish() {
    if (this.done) return;
    const g = this.g;
    for (const o of [this.rocket, this.rock, this.streaks, ...this.flying.map((f) => f.o), ...this.shooting.map((s) => s.m)]) g.scene.remove(o);
    g.players.forEach((p, i) => {
      p.cineOn = false; p.pos.copy(this.home[i]); p.ground = this.home[i].y; p.alt = 0; p.anim = 'idle'; p.squash = 0;
      p.visible = p.active; p.m.mood = null;
    });
    // en solo, Earl s'éclipse pour faire sa sieste
    if (!g.coop) g.fx.dust(this.home[1], 14, ['#ffffff', '#d9d9e6']);
    g.hud.subtitle(null, null);
    g.flash = 0;
    g.cam.view = g.cam.viewT = 19;
    this.done = true;
  }
}
