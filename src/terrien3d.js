// Les terriens modélisés dans Blender (tools/blender/terriens/<type>.py) : un .glb par type, cloné pour chaque
// terrien et animé selon ce qu'il fait. Tant qu'un fichier manque, le terrien garde son modèle en volumes
// (earthlings.js) : on peut donc les remplacer un par un.
//
// Clips attendus dans chaque .glb : Idle, Walk, Run (poursuite), Warn (le « ! » avant la charge, joué une fois),
// Hit (après un coup : le dentiste rit, etc.), Dance (piste de disco). Un clip absent retombe sur Idle.
// Facultatifs : Sing (la cantatrice), Fire (les poulets tirent, une fois), Fly (le Père Noël s'envole).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const TERRIENS = ['dentist', 'nerd', 'hamster', 'cupid', 'devil', 'opera', 'wiseman', 'hula', 'boogey', 'mower', 'cart', 'mole', 'chicken', 'santa'];
const ready = new Map();
// matières que le code fait varier terrien par terrien (le croque-mitaine qui apparaît en approchant)
const OWN = { boogey: /^(Fourrure|Lueur|Crocs|Griffes|Pupille)/ };

// matières du jeu (Lambert, comme le reste du monde) ; un peu de brillant sur les yeux, le métal, les verres
const SHINY = /Blanc|Pupille|Dents|Miroir|Chrome|Fraise|Verre|Metal|Or\b/;
function gameMaterial(src, mesh) {
  const o = { color: src.color, vertexColors: !!mesh.geometry.attributes.color, emissive: src.emissive, emissiveIntensity: src.emissiveIntensity ?? 1,
    transparent: src.transparent, opacity: src.opacity, depthWrite: !src.transparent };
  const m = SHINY.test(src.name) ? new THREE.MeshPhongMaterial({ ...o, shininess: 80, specular: '#ffffff' }) : new THREE.MeshLambertMaterial(o);
  m.name = src.name;
  return m;
}

// chargés une fois au démarrage, en arrière-plan ; les fichiers absents sont simplement ignorés
export function preloadTerriens() {
  for (const type of TERRIENS) {
    new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/terriens/${type}.glb`).then((g) => {
      const mats = new Map();
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        if (!mats.has(o.material)) mats.set(o.material, gameMaterial(o.material, o));
        o.material = mats.get(o.material);
      });
      ready.set(type, g);
    }).catch(() => {});
  }
}

// Un terrien neuf (ou null si son modèle n'est pas encore là). Mêmes champs que les modèles en volumes.
export function makeTerrien(type) {
  const g = ready.get(type);
  if (!g) return null;
  const scene = clone(g.scene);
  const own = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    if (o.isSkinnedMesh) o.frustumCulled = false;
    // matières que le code fait varier pour ce terrien-là seulement (le croque-mitaine qui apparaît…)
    if (OWN[type]?.test(o.material.name)) { o.material = o.material.clone(); own.push(o.material); }
  });
  const mixer = new THREE.AnimationMixer(scene);
  const actions = {};
  for (const c of g.animations) {
    const a = mixer.clipAction(c);
    if (c.name === 'Warn' || c.name === 'Fire') { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
    actions[c.name] = a;
  }
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body); body.add(scene);
  // pièces nommées dans Blender, pour les effets propres à chaque terrien (transparence, hélices…)
  const parts = {};
  scene.traverse((o) => { if (o.name) parts[o.name] = o; });
  return { root, body, extra: {}, glb: { scene, mixer, actions, state: null, parts, own } };
}

// Ce que fait le terrien → animation, avec un fondu de l'une à l'autre.
export function animateTerrien(m, e, dt) {
  const h = m.glb;
  let name = e.lift !== undefined ? 'Fly' : e.dancing ? 'Dance' : e.fireT > 0 ? 'Fire' : e.singT > 0 ? 'Sing' : e.warnT > 0 ? 'Warn'
    : e.pauseT > 0 || e.upT > 0 ? 'Hit' : e.moving ? (e.state === 'chase' ? 'Run' : 'Walk') : 'Idle';
  if (!h.actions[name]) name = e.moving && h.actions.Walk ? 'Walk' : 'Idle';
  if (h.state !== name) {
    const next = h.actions[name], prev = h.state && h.actions[h.state];
    if (next) {
      next.reset().play();
      if (prev) next.crossFadeFrom(prev, name === 'Warn' ? 0.08 : 0.2, false);
    }
    h.state = name;
  }
  h.mixer.update(dt);
}

export function disposeTerrien(m) {
  for (const x of m.glb.own) x.dispose();
  m.glb.mixer.stopAllAction();
  m.glb.mixer.uncacheRoot(m.glb.scene);
}
