// Les surprises des étages : piste de disco, geysers et îlot au trésor, portails, croix à creuser,
// pluie d'étoiles filantes, disques d'or cachés. Les modèles vivent dans le groupe de leur étage (fondus,
// brouillard et trou de visibilité compris) ; le comportement est mis à jour à chaque image.
import * as THREE from 'three';
import { patchMaterial } from './dither.js';
import { topOf } from './terrain3d.js';
import { toCell } from './gen.js';
import { sound } from './audio.js';

export const RECORDS = 7;

const lam = (U, color, o = {}) => patchMaterial(new THREE.MeshLambertMaterial({ color, ...o }), U, { hole: false });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
const groundY = (d, x, z) => topOf(d.type[toCell(x)]?.[toCell(z)]);

// --- modèles -----------------------------------------------------------------------------------------------------
function discoModel(s, U) {
  const g = new THREE.Group(), tiles = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    const mat = lam(U, '#2a2440', { emissive: '#000000' });
    const t = mesh(new THREE.BoxGeometry(0.94, 0.08, 0.94), mat, a - 1.5, 0.04, b - 1.5);
    t.castShadow = false;
    tiles.push(t); g.add(t);
  }
  const rim = lam(U, '#ffd23f');
  for (const [w, dd, x, z] of [[4.2, 0.1, 0, -2.05], [4.2, 0.1, 0, 2.05], [0.1, 4.2, -2.05, 0], [0.1, 4.2, 2.05, 0]]) g.add(mesh(new THREE.BoxGeometry(w, 0.12, dd), rim, x, 0.06, z));
  // la boule à facettes, au bout de son mât
  const pole = lam(U, '#2a2a3a');
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 6), pole, 2.05, 1.3, -2.05));
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.04, 0.04), pole, 1.45, 2.6, -2.05));
  const ball = mesh(new THREE.IcosahedronGeometry(0.28, 1), lam(U, '#d8dcf0', { flatShading: true, emissive: '#3a3a5a' }), 0.85, 2.3, -2.05);
  g.add(ball);
  g.position.set(s.x, 0, s.z);
  g.userData = { tiles, ball };
  return g;
}

function geyserModel(s, U, d) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.TorusGeometry(0.32, 0.1, 6, 14), lam(U, '#6a6a7a'), 0, 0.05, 0));
  g.children[0].rotation.x = Math.PI / 2;
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.add(mesh(new THREE.IcosahedronGeometry(0.1, 0), lam(U, '#8a8a9a', { flatShading: true }), Math.cos(a) * 0.45, 0.06, Math.sin(a) * 0.45)); }
  const steam = mesh(new THREE.CylinderGeometry(0.12, 0.25, 1, 10, 1, true), patchMaterial(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }), U, { hole: false }), 0, 0.5, 0);
  steam.castShadow = false;
  g.add(steam);
  g.position.set(s.x, groundY(d, s.x, s.z), s.z);
  g.userData = { steam };
  return g;
}

function portalModel(p, U, d, hue) {
  const g = new THREE.Group();
  const ring = mesh(new THREE.TorusGeometry(0.55, 0.08, 8, 24), lam(U, hue, { emissive: hue, emissiveIntensity: 0.6 }), 0, 0.7, 0);
  const swirl = mesh(new THREE.CircleGeometry(0.5, 24), patchMaterial(new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }), U, { hole: false }), 0, 0.7, 0);
  swirl.castShadow = false;
  const swirl2 = swirl.clone(); swirl2.scale.setScalar(0.55); swirl2.material = swirl.material.clone(); swirl2.material.color.set('#ffffff');
  g.add(ring, swirl, swirl2);
  g.position.set(p.x, groundY(d, p.x, p.z), p.z);
  g.userData = { ring, swirl, swirl2 };
  return g;
}

function treasureModel(s, U, d) {
  const g = new THREE.Group(), red = lam(U, '#e8281f');
  for (const a of [Math.PI / 4, -Math.PI / 4]) { const m = mesh(new THREE.BoxGeometry(0.7, 0.03, 0.14), red, 0, 0.02, 0); m.rotation.y = a; m.castShadow = false; g.add(m); }
  g.position.set(s.x, groundY(d, s.x, s.z), s.z);
  return g;
}

function recordModel(s, U, d) {
  const g = new THREE.Group(), disc = new THREE.Group();
  disc.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 24), lam(U, '#ffd23f', { emissive: '#8a6a00' })));
  disc.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.035, 16), lam(U, '#e8334a')));
  disc.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 8), lam(U, '#1a1033')));
  disc.rotation.x = Math.PI / 2;
  const spin = new THREE.Group(); spin.add(disc); spin.position.y = 0.75;
  g.add(spin);
  g.position.set(s.x, groundY(d, s.x, s.z), s.z);
  g.userData = { spin };
  return g;
}

// deux dalles et un coffre-fort entre elles
function platesModel(s, U, d) {
  const g = new THREE.Group(), plates = [];
  for (const p of [s.a, s.b]) {
    const grp = new THREE.Group();
    grp.add(mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.06, 20), lam(U, '#4a4a5e'), 0, 0.03, 0));
    const top = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 20), lam(U, '#8a8ea8', { emissive: '#000000' }), 0, 0.07, 0);
    grp.add(top);
    grp.position.set(p.x - s.x, groundY(d, p.x, p.z), p.z - s.z);
    plates.push(top); g.add(grp);
  }
  const steel = lam(U, '#8a8ea0'), gold = lam(U, '#ffd23f', { emissive: '#5a4200' }), dark = lam(U, '#2a2a3a');
  const vault = new THREE.Group();
  vault.add(mesh(new THREE.BoxGeometry(0.8, 0.72, 0.8), steel, 0, 0.36, 0));
  for (const y of [0.04, 0.68]) vault.add(mesh(new THREE.BoxGeometry(0.84, 0.06, 0.84), gold, 0, y, 0));
  // la porte, montée sur une charnière à gauche
  const hinge = new THREE.Group(); hinge.position.set(-0.32, 0.36, 0.41);
  const door = mesh(new THREE.BoxGeometry(0.64, 0.56, 0.05), lam(U, '#a0a4b8'), 0.32, 0, 0);
  door.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12), dark, 0, 0, 0.04));
  door.children[0].rotation.x = Math.PI / 2;
  door.add(mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), gold, 0, 0, 0.07));
  hinge.add(door); vault.add(hinge);
  vault.position.y = groundY(d, s.x, s.z);
  g.add(vault);
  g.position.set(s.x, 0, s.z);
  hinge.rotation.y = s.done ? -1.9 : 0;
  g.userData = { plates, hinge, dial: door.children[1] };
  return g;
}

// Construit les modèles des surprises d'un étage (appelé quand l'étage se construit).
export function buildSurprises(L) {
  const out = [];
  for (const s of L.data.surprises || []) {
    let m = null;
    if (s.kind === 'disco') m = discoModel(s, L.U);
    else if (s.kind === 'geyser') m = geyserModel(s, L.U, L.data);
    else if (s.kind === 'portals') { m = new THREE.Group(); m.add(portalModel(s.a, L.U, L.data, '#9a5aff'), portalModel(s.b, L.U, L.data, '#9a5aff')); }
    else if (s.kind === 'treasure' && !s.done) m = treasureModel(s, L.U, L.data);
    else if (s.kind === 'record' && !s.done) m = recordModel(s, L.U, L.data);
    else if (s.kind === 'plates') m = platesModel(s, L.U, L.data);
    if (m) { L.group.add(m); out.push({ s, m }); }
  }
  L.surp = out;
}

export function dropSurprises(L) {
  for (const { m } of L.surp || []) {
    L.group.remove(m);
    m.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }
  L.surp = [];
}

// --- comportement ------------------------------------------------------------------------------------------------
export class Surprises {
  constructor(scene) { this.scene = scene; this.flights = []; this.stars = []; }

  // Un joueur propulsé par un geyser : vol en cloche jusqu'à la cible.
  launch(p, to, g) {
    p.control = false; p.anim = 'fly';
    this.flights.push({ p, from: p.pos.clone(), to: { x: to.x, z: to.z }, t: 0, T: 1.35 });
    sound.play('decollage', { rate: 1.3, vol: 0.7 });
    g.fx.dust(p.pos, 14, ['#ffffff', '#e8f4ff', '#c8d8ee']);
  }

  update(dt, g) {
    const world = g.world, active = g.players.filter((p) => p.active);
    const free = !g.seq && g.state === 'play' && !g.menu;
    g.discoOn = false;

    // vols de geyser
    this.flights = this.flights.filter((f) => {
      f.t += dt;
      const k = Math.min(1, f.t / f.T), p = f.p, L = world.levels[p.level];
      p.pos.x = f.from.x + (f.to.x - f.from.x) * k;
      p.pos.z = f.from.z + (f.to.z - f.from.z) * k;
      const y1 = L.y + groundY(L.data, f.to.x, f.to.z);
      p.pos.y = f.from.y + (y1 - f.from.y) * k + Math.sin(k * Math.PI) * 4.5;
      p.anim = 'fly';
      p.faceDir(f.to.x - f.from.x, f.to.z - f.from.z);
      if (Math.random() < 0.5) g.fx.sparkle(p.pos.clone(), '#ffffff', 1, 0.2);
      if (k < 1) return true;
      const ty = world.type(p.level, p.pos.x, p.pos.z);
      if (!ty || ty === 3) { const n = world.nearestLand(p.level, p.pos.x, p.pos.z); p.pos.x = n.x; p.pos.z = n.z; }
      p.ground = p.pos.y = L.y + groundY(L.data, p.pos.x, p.pos.z); p.alt = 0; p.control = true; p.anim = 'idle'; p.squash = 0.6; p.geyserCD = 1;
      g.fx.dust(p.pos, 12);
      return false;
    });

    // étoiles filantes en route
    this.stars = this.stars.filter((st) => {
      st.t += dt;
      const k = Math.min(1, st.t / st.T);
      st.m.position.lerpVectors(st.from, st.to, k * k);
      g.fx.spawn(st.m.position.x, st.m.position.y, st.m.position.z, 0, 0, 0, 0.35, '#ffe36b', 0, 0);
      if (k < 1) return true;
      this.scene.remove(st.m);
      g.fx.sparkle(st.to, '#ffe36b', 10, 0.6);
      world.addBuck(st.level, st.to.x, st.to.z);
      sound.play('billet', { vary: 0.2, vol: 0.6 });
      return false;
    });

    for (const L of world.all) {
      if (!L.built || !L.surp?.length) continue;
      const here = active.filter((p) => p.level === L.k && p.visible);
      L.timeOn = here.length && free ? (L.timeOn || 0) + dt : L.timeOn || 0;
      for (const { s, m } of L.surp) {
        if (s.kind === 'disco') this.disco(s, m, L, here, g, dt);
        else if (s.kind === 'geyser') this.geyser(s, m, here, g, dt);
        else if (s.kind === 'portals') this.portals(s, m, here, g, dt);
        else if (s.kind === 'treasure') this.treasure(s, m, L, here, g, dt);
        else if (s.kind === 'record') this.record(s, m, L, here, g);
        else if (s.kind === 'plates') this.plates(s, m, L, here, g, dt);
      }
      for (const s of L.data.surprises) if (s.kind === 'meteors' && !s.done && free && L.timeOn > 14 && here.length) this.meteors(s, L, g);
    }
  }

  disco(s, m, L, here, g) {
    const dancers = here.filter((p) => Math.abs(p.pos.x - s.x) < 2 && Math.abs(p.pos.z - s.z) < 2 && p.control);
    for (const p of dancers) p.onDisco = s;
    const on = dancers.length > 0;
    const t = g.t, ud = m.userData;
    ud.tiles.forEach((tile, i) => {
      const a = i >> 2, b = i & 3, ph = Math.floor(t * (on ? 4 : 1.5)) + a * 3 + b * 5;
      const c = ['#ff4a8a', '#ffd23f', '#3affc0', '#5a8aff', '#c86aff', '#ff8a3a'][ph % 6];
      const lit = on || (ph + a + b) % 3 === 0;
      tile.material.color.set(lit ? c : '#2a2440');
      tile.material.emissive.set(lit ? c : '#000000');
      tile.material.emissiveIntensity = lit ? (on ? 0.9 : 0.35) : 0;
    });
    ud.ball.rotation.y = t * 1.5;
    if (!on) return;
    g.discoOn = true;
    if (!s.done) { s.done = true; g.hud.toast("UNE PISTE DE DANSE ! TOUT L'ÉTAGE SE MET À DANSER.", 3.5); }
    // tout le monde danse : les terriens de l'étage oublient de charger
    // tout l'étage danse : même les terriens éloignés lâchent l'affaire
    for (const e of g.earthlings.list) if (e.level === L.k && !e.def.friendly) e.danceT = Math.max(e.danceT || 0, 0.4);
    if (Math.random() < 0.3) g.fx.sparkle(new THREE.Vector3(s.x + (Math.random() - 0.5) * 4, L.y + 0.3, s.z + (Math.random() - 0.5) * 4), '#ffffff', 2, 0.3);
  }

  geyser(s, m, here, g, dt) {
    const st = m.userData.steam;
    st.scale.set(1, 0.6 + Math.sin(g.t * 5 + s.x) * 0.25, 1);
    st.position.y = st.scale.y * 0.5;
    for (const p of here) {
      p.geyserCD = Math.max(0, (p.geyserCD || 0) - dt);
      if (!p.control || p.geyserCD > 0 || p.alt > 0.2) continue;
      if (Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < 0.45) {
        st.scale.set(1.4, 4, 1.4); st.position.y = 2;
        this.launch(p, s.to, g);
        if (!s.seen) { s.seen = true; g.hud.toast('UN GEYSER ! DIRECTION LE LARGE.', 3); }
      }
    }
  }

  portals(s, m, here, g, dt) {
    for (const pm of m.children) { pm.userData.swirl.rotation.z = g.t * 2; pm.userData.swirl2.rotation.z = -g.t * 3.3; pm.userData.ring.rotation.y = Math.sin(g.t) * 0.2; }
    for (const p of here) {
      p.portalCD = Math.max(0, (p.portalCD || 0) - dt);
      if (!p.control || p.portalCD > 0) continue;
      for (const [a, b] of [[s.a, s.b], [s.b, s.a]]) {
        if (Math.hypot(p.pos.x - a.x, p.pos.z - a.z) > 0.5) continue;
        g.fx.sparkle(p.mid(), '#c86aff', 16, 0.6);
        const dir = Math.hypot(p.vx, p.vz) > 0.1 ? { x: p.vx, z: p.vz } : { x: 0, z: 1 }, l = Math.hypot(dir.x, dir.z);
        const n = g.world.nearestLand(p.level, b.x + (dir.x / l) * 0.9, b.z + (dir.z / l) * 0.9);
        p.pos.x = n.x; p.pos.z = n.z; p.portalCD = 1.2;
        g.fx.sparkle(p.mid(), '#c86aff', 16, 0.6);
        sound.play('poof', { rate: 1.4 });
        p.emote('surprise', 1);
        if (!s.seen) { s.seen = true; g.hud.toast('UN TROU DE VER ! FIUUU.', 2.5); }
        break;
      }
    }
  }

  treasure(s, m, L, here, g, dt) {
    if (s.done) return;
    const on = here.find((p) => p.control && Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < 0.5 && p.anim === 'idle');
    if (here.some((p) => Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < 3)) g.tip?.('tresor', 'UNE CROIX AU SOL ? RESTE DESSUS SANS BOUGER POUR CREUSER.');
    s.dig = on ? (s.dig || 0) + dt : 0;
    if (on && Math.random() < 0.4) g.fx.dust(new THREE.Vector3(s.x, L.y, s.z), 3, ['#c8a070', '#a07a50', '#e8d0a0']);
    if (on) {
      // la jauge au-dessus de la croix, et gare à qui approche pendant qu'on a le nez dans le sable
      g.gauges?.push({ pos: new THREE.Vector3(s.x, on.pos.y + 2.1, s.z), level: L.k, k: s.dig / 1.3, label: 'ON CREUSE...' });
      const near = g.earthlings?.list.some((e) => e.level === L.k && !e.def.friendly && Math.hypot(e.pos.x - s.x, e.pos.z - s.z) < 5);
      if (near && g.t - (s.alertT ?? -9) > 2.5) { s.alertT = g.t; g.hud.toast('ATTENTION, ÇA APPROCHE !', 1.4); sound.play('surprise', { vol: 0.5 }); }
    }
    if (s.dig < 1.3) return;
    s.done = true;
    L.group.remove(m);
    const y = L.y + groundY(L.data, s.x, s.z);
    g.fx.coins(new THREE.Vector3(s.x, y, s.z), 20);
    g.fx.sparkle(new THREE.Vector3(s.x, y + 0.5, s.z), '#ffe36b', 24, 0.8);
    g.bucks += 5;
    g.hud.float('+5', new THREE.Vector3(s.x, y + 1.2, s.z), L.k);
    g.hud.bounceBucks();
    for (let k = 0; k < 2; k++) {
      const n = g.world.nearestLand(L.k, s.x + (k ? 0.8 : -0.8), s.z + 0.4);
      g.world.addPresent(L.k, n.x, n.z, g.rollPresent());
    }
    sound.play('jackpot');
    on.emote('joie', 2); on.say('cadeau', true);
    g.hud.toast('UN TRÉSOR ! 5 BILLETS ET DEUX CADEAUX.', 3);
  }

  // Les dalles : à deux, un sur chaque en même temps ; seul, tenir une dalle quatre secondes.
  plates(s, m, L, here, g, dt) {
    const ud = m.userData;
    if (s.done) { ud.hinge.rotation.y += (-1.9 - ud.hinge.rotation.y) * Math.min(1, dt * 4); return; }
    const on = [s.a, s.b].map((pl) => here.find((p) => p.control && Math.hypot(p.pos.x - pl.x, p.pos.z - pl.z) < 0.45));
    ud.plates.forEach((t, i) => { t.position.y = on[i] ? 0.04 : 0.07; t.material.emissive.set(on[i] ? '#3affc0' : '#000000'); t.material.emissiveIntensity = on[i] ? 0.8 : 0; });
    ud.dial.rotation.z = g.t * (on[0] || on[1] ? 6 : 0.5);
    if (here.some((p) => Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < 4)) {
      g.tip?.('dalles', g.coop ? 'DEUX DALLES : UN SUR CHAQUE, EN MÊME TEMPS, ET LE COFFRE S\'OUVRE.' : 'UNE DALLE : RESTE DESSUS, LE COFFRE VA FINIR PAR CÉDER.');
    }
    // seul, une dalle suffit, mais il faut de la patience
    const solo = !g.coop, both = on[0] && on[1] && on[0] !== on[1];
    // une bousculade ne fait pas tout perdre : un moment de grâce, puis la jauge redescend doucement
    if (solo) {
      s.offT = on[0] || on[1] ? 0 : (s.offT || 0) + dt;
      s.hold = on[0] || on[1] ? (s.hold || 0) + dt : s.offT < 0.8 ? s.hold || 0 : Math.max(0, (s.hold || 0) - dt * 0.5);
    }
    if (solo && s.hold > 0) g.gauges?.push({ pos: new THREE.Vector3(s.x, L.y + 1.5, s.z), level: L.k, k: s.hold / 4, color: '#3affc0' });
    if (!both && !(solo && s.hold >= 4)) {
      if (g.coop && (on[0] || on[1]) && !s.hintT) { s.hintT = 1; g.hud.toast("IL FAUT QUELQU'UN SUR L'AUTRE DALLE !", 2.5); }
      return;
    }
    s.done = true;
    const y = L.y + groundY(L.data, s.x, s.z);
    sound.play('jackpot'); sound.play('portes', { rate: 0.7 });
    g.fx.coins(new THREE.Vector3(s.x, y + 0.6, s.z), 24);
    g.fx.sparkle(new THREE.Vector3(s.x, y + 0.9, s.z), '#ffe36b', 30, 1);
    g.punch?.(0.12, 0.05);
    // le butin se répand devant le coffre
    // les cadeaux un peu plus loin, les billets en cercle autour du coffre, jamais sous les pieds
    const gifts = g.world.scatter(L.k, s.x, s.z, 3, { minR: 1.8, gap: 1.2, avoid: here.map((p) => p.pos) });
    for (const n of gifts) g.world.addPresent(L.k, n.x, n.z, g.rollPresent());
    for (const n of g.world.scatter(L.k, s.x, s.z, 10, { minR: 1, gap: 0.6, avoid: [...gifts, ...here.map((p) => p.pos)] })) g.world.addBuck(L.k, n.x, n.z);
    g.hud.showCard('LE COFFRE !', 'DIX BILLETS ET TROIS CADEAUX. LE TRAVAIL D\'ÉQUIPE, ÇA PAIE.', true);
    for (const p of here) { p.emote('joie', 2); }
    if (here[0]) g.banter?.(here[0], 'vault', { force: true });
    g.addXp?.(10);
  }

  record(s, m, L, here, g) {
    if (s.done) return;
    m.userData.spin.rotation.y = g.t * 2.5;
    m.userData.spin.position.y = 0.75 + Math.sin(g.t * 2) * 0.1;
    if (Math.random() < 0.1) g.fx.sparkle(new THREE.Vector3(s.x, L.y + 0.9, s.z), '#ffe36b', 1, 0.3);
    const p = here.find((q) => Math.hypot(q.pos.x - s.x, q.pos.z - s.z) < 0.6);
    if (!p) return;
    s.done = true;
    L.group.remove(m);
    g.records = (g.records || 0) + 1;
    g.fx.sparkle(p.mid(), '#ffe36b', 30, 1);
    sound.play('promotion');
    p.emote('joie', 2);
    if (g.records >= RECORDS) {
      // en défi « une seule vie », la vie en plus devient des billets
      if (g.challenge?.id === 'vie') { g.bucks += 10; g.hud.showCard('DISCOGRAPHIE COMPLÈTE !', 'LES 7 DISQUES D\'OR. DIX BILLETS (UNE SEULE VIE, C\'EST LA RÈGLE).', true); }
      else { g.lives += 1; g.hud.showCard('DISCOGRAPHIE COMPLÈTE !', 'LES 7 DISQUES D\'OR. UNE VIE EN PLUS.', true); }
    } else g.hud.showCard(`DISQUE D'OR ${g.records}/${RECORDS}`, 'UN CLASSIQUE DU FUNK, CACHÉ ICI.', true);
    g.addXp(15);
  }

  meteors(s, L, g) {
    s.done = true;
    g.hud.toast("UNE PLUIE D'ÉTOILES FILANTES ! RAMASSE LES BILLETS.", 3.5);
    sound.play('surprise');
    const p = g.players.find((q) => q.active && q.level === L.k) || g.player;
    for (let k = 0; k < 9; k++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 7;
      const n = g.world.nearestLand(L.k, p.pos.x + Math.cos(a) * r, p.pos.z + Math.sin(a) * r);
      const to = new THREE.Vector3(n.x, L.y + groundY(L.data, n.x, n.z) + 0.3, n.z);
      const from = to.clone().add(new THREE.Vector3(-6 - Math.random() * 4, 14, -4 + Math.random() * 3));
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: '#fff3a0' }));
      m.position.copy(from);
      this.scene.add(m);
      this.stars.push({ m, from, to, t: -k * 0.35 - Math.random() * 0.2, T: 1.1, level: L.k });
    }
  }

  clear() {
    for (const st of this.stars) this.scene.remove(st.m);
    this.stars = []; this.flights = [];
  }
}
