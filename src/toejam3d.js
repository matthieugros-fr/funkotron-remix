// ToeJam en volumes arrondis : trois jambes, baskets montantes, casquette à l'envers,
// chaîne en or, gros yeux. Membres accrochés à des articulations pour l'animation.
import * as THREE from 'three';

const mats = new Map();
function mat(color, emissive) {
  const key = color + (emissive || '');
  if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color, emissive: emissive || '#000000' }));
  return mats.get(key);
}
function add(parent, geo, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function joint(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

const COL = { R: '#e8334a', RD: '#c22840', B: '#2f6fe4', BD: '#1f4fb0', W: '#ffffff', K: '#1a1033', Y: '#ffcf3a', S: '#f4f4f4', ST: '#ff4a5c', SO: '#3a3550', M: '#5a0f22' };

export function buildToeJam() {
  const root = new THREE.Group();
  const body = joint(root);
  const sphere = (r) => new THREE.SphereGeometry(r, 16, 12);

  // jambes : deux devant, une derrière
  const legs = [[-0.16, 0.06], [0.16, 0.06], [0, -0.13]].map(([x, z]) => {
    const j = joint(body, x, 0.42, z);
    add(j, new THREE.CapsuleGeometry(0.062, 0.2, 4, 10), COL.R, 0, -0.16, 0);
    add(j, new THREE.BoxGeometry(0.17, 0.11, 0.25), COL.S, 0, -0.35, 0.04);
    add(j, new THREE.BoxGeometry(0.175, 0.04, 0.255), COL.ST, 0, -0.31, 0.04);
    add(j, new THREE.BoxGeometry(0.18, 0.035, 0.27), COL.SO, 0, -0.405, 0.045);
    return j;
  });
  add(body, sphere(0.3), COL.B, 0, 0.48, 0, 1, 0.55, 0.9);           // short
  add(body, sphere(0.26), COL.R, 0, 0.7, 0, 1, 1.05, 0.88);           // torse
  const chain = add(body, new THREE.TorusGeometry(0.16, 0.018, 6, 18), COL.Y, 0, 0.84, 0.02);
  chain.rotation.x = Math.PI / 2 - 0.35;
  const med = add(body, new THREE.CylinderGeometry(0.065, 0.065, 0.025, 12), COL.Y, 0, 0.71, 0.23);
  med.rotation.x = Math.PI / 2 - 0.2;

  const arms = [-1, 1].map((s) => {
    const j = joint(body, s * 0.27, 0.82, 0);
    add(j, new THREE.CapsuleGeometry(0.052, 0.24, 4, 10), COL.R, 0, -0.16, 0);
    add(j, sphere(0.072), COL.R, 0, -0.33, 0.01);
    return j;
  });

  const head = joint(body, 0, 1.1, 0);
  add(head, sphere(0.35), COL.R, 0, 0, 0, 1.05, 0.93, 1);
  const eyes = [-1, 1].map((s) => {
    const e = joint(head, s * 0.13, 0.12, 0.24);
    add(e, sphere(0.13), COL.W, 0, 0, 0, 1, 1.25, 0.75);
    const pupil = add(e, sphere(0.05), COL.K, -s * 0.012, -0.01, 0.09);
    e.userData.pupil = pupil;
    return e;
  });
  const mouth = add(head, new THREE.TorusGeometry(0.1, 0.022, 6, 14, Math.PI), COL.M, 0, -0.1, 0.31);
  mouth.rotation.z = Math.PI;
  // casquette retournée, posée en arrière du crâne : la visière part vers la nuque
  const cap = joint(head, 0, 0.14, -0.08);
  cap.rotation.x = -0.45;
  add(cap, new THREE.SphereGeometry(0.29, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), COL.B, 0, 0, 0);
  add(cap, new THREE.CylinderGeometry(0.255, 0.255, 0.05, 18), COL.BD, 0, 0.02, 0);
  const brim = add(cap, new THREE.BoxGeometry(0.3, 0.035, 0.22), COL.BD, 0, 0.02, -0.33);
  brim.rotation.x = 0.15;
  add(cap, sphere(0.035), COL.BD, 0, 0.28, 0);

  // étoiles qui tournent au-dessus de la tête après une chute
  const stars = joint(head, 0, 0.5, 0);
  for (let k = 0; k < 3; k++) {
    const s = add(stars, new THREE.OctahedronGeometry(0.07, 0), COL.Y);
    s.material = mat(COL.Y, '#a07800');
    const a = (k / 3) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35);
  }
  stars.visible = false;

  return { root, body, legs, arms, head, eyes, mouth, stars };
}

// Pose du personnage selon l'état. `walk` : distance parcourue ; `t` : horloge.
export function poseToeJam(m, state, t, walk, squash) {
  const ph = walk * 5.2;
  let bob = 0, eyeY = 1, eyeS = 1;
  for (const l of m.legs) l.rotation.set(0, 0, 0);
  for (const a of m.arms) a.rotation.set(0, 0, 0);
  m.body.rotation.set(0, 0, 0);
  m.head.rotation.set(0, 0, 0);
  m.stars.visible = false;

  switch (state) {
    case 'walk':
      m.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i * Math.PI * 2) / 3) * 0.75; });
      bob = Math.abs(Math.sin(ph * 1.5)) * 0.05;
      m.arms[0].rotation.x = Math.sin(ph) * 0.7; m.arms[1].rotation.x = -Math.sin(ph) * 0.7;
      m.arms[0].rotation.z = -0.15; m.arms[1].rotation.z = 0.15;
      m.head.rotation.z = Math.sin(ph) * 0.06;
      break;
    case 'fall':
      m.arms[0].rotation.z = -2.6 + Math.sin(t * 26) * 0.25; m.arms[1].rotation.z = 2.6 - Math.sin(t * 26 + 1) * 0.25;
      m.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 30 + i * 2.1) * 0.9; });
      eyeS = 1.3;
      break;
    case 'teeter':
      m.arms[0].rotation.set(t * 14, 0, -1.3); m.arms[1].rotation.set(t * 14 + Math.PI, 0, 1.3);
      m.body.rotation.x = Math.sin(t * 9) * 0.18;
      eyeS = 1.3;
      break;
    case 'splat':
      eyeY = 0.15; m.stars.visible = true; m.stars.rotation.y = t * 6;
      m.arms[0].rotation.z = -1.4; m.arms[1].rotation.z = 1.4;
      break;
    case 'getup':
      eyeY = 0.15; m.stars.visible = true; m.stars.rotation.y = t * 6;
      break;
    default: // repos : respiration, clignements, petit balancement funky
      bob = Math.sin(t * 3) * 0.015;
      m.arms[0].rotation.z = -0.12 - Math.sin(t * 3) * 0.04; m.arms[1].rotation.z = 0.12 + Math.sin(t * 3) * 0.04;
      m.head.rotation.z = Math.sin(t * 1.5) * 0.05;
      if (t % 3.1 < 0.12) eyeY = 0.1;
  }
  m.body.position.y = bob;
  m.body.scale.set(1 + 0.45 * squash, 1 - 0.6 * squash, 1 + 0.45 * squash);
  for (const e of m.eyes) { e.scale.set(eyeS, eyeS * eyeY, eyeS); e.userData.pupil.scale.setScalar(eyeS > 1 ? 0.6 : 1); }
}
