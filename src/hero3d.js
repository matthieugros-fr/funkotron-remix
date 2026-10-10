// ToeJam et Earl modélisés dans Blender (tools/blender/perso.py) : maillage fin, squelette, animations cuites.
// Le modèle en volumes de toejam3d.js reste en coulisse : invisible, il porte les accessoires (ailes, ressorts,
// patins, étoiles) et sert de secours si le fichier .glb manque.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const cache = new Map();
function load(kind) {
  if (!cache.has(kind)) cache.set(kind, new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${kind}.glb`));
  return cache.get(kind);
}

// matières du jeu (Lambert, comme le reste du monde) ; un peu de brillant sur les yeux, les verres et l'or
const SHINY = /Blanc|Pupille|Reflet|Lunettes|Eclat|Or/;
function gameMaterial(src, mesh) {
  const o = { color: src.color, vertexColors: !!mesh.geometry.attributes.color, emissive: src.emissive, emissiveIntensity: src.emissiveIntensity ?? 1 };
  if (SHINY.test(src.name)) return new THREE.MeshPhongMaterial({ ...o, shininess: 90, specular: '#ffffff' });
  return new THREE.MeshLambertMaterial(o);
}

// État du jeu → animation. `once` : jouée une fois puis figée sur la dernière image.
const CLIP = { idle: 'Idle', walk: 'Walk', fall: 'Fall', teeter: 'Teeter', splat: 'Splat', getup: 'Getup', fly: 'Fly', jump: 'Jump', dance: 'Dance' };
const ONCE = new Set(['getup']);
const STRIDE = 1.21; // distance parcourue par cycle de marche (même cadence que le modèle en volumes)

export function attachHero(m, kind) {
  const hidden = [];
  const keep = new Set();
  m.stars.traverse((o) => keep.add(o));
  m.root.traverse((o) => { if (o.isMesh && !keep.has(o)) hidden.push(o); });
  return load(kind).then((gltf) => {
    const scene = clone(gltf.scene);
    const eyes = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.material = gameMaterial(o.material, o);
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.isSkinnedMesh) o.frustumCulled = false;
      if (/^(Oeil|Pupille|Reflet)/.test(o.name)) eyes.push(o);
    });
    const mixer = new THREE.AnimationMixer(scene);
    const actions = {};
    for (const c of gltf.animations) {
      const a = mixer.clipAction(c);
      if (ONCE.has(Object.keys(CLIP).find((k) => CLIP[k] === c.name))) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
      actions[c.name] = a;
    }
    for (const o of hidden) o.visible = false;
    m.body.add(scene);
    m.hero = { scene, mixer, actions, eyes, eyeBase: eyes.map((e) => e.scale.y), state: null };
    return m.hero;
  }).catch((err) => { console.warn(`modèle ${kind}.glb indisponible, on garde les volumes`, err); });
}

// À appeler après poseToeJam : choisit l'animation, fond l'une dans l'autre, cligne des yeux.
export function poseHero(m, state, t, walk, dt) {
  const h = m.hero;
  if (!h) return;
  const name = CLIP[state] || 'Idle';
  const next = h.actions[name];
  if (h.state !== name && next) {
    const prev = h.state && h.actions[h.state];
    next.reset().play();
    if (prev) next.crossFadeFrom(prev, state === 'splat' ? 0.05 : 0.18, false);
    h.state = name;
  }
  if (name === 'Walk' && next) {
    // le pas suit la distance réellement parcourue : pas de glissade
    next.timeScale = 0;
    next.time = ((walk / STRIDE) % 1) * next.getClip().duration;
  }
  h.mixer.update(dt);
  // paupières : clignement au repos, yeux plissés quand il est sonné
  const shut = state === 'splat' || state === 'getup' ? 0.15 : state === 'idle' && t % 3.1 < 0.12 ? 0.1 : 1;
  h.eyes.forEach((e, i) => { e.scale.y = h.eyeBase[i] * shut; });
  // les étoiles tournent au-dessus de la galette, pas à hauteur de tête
  m.stars.position.y = state === 'splat' ? 0.75 - m.head.position.y : 0.5;
}
