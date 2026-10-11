// Bords du vide : une bande hachurée posée sur les cases qui donnent sur le néant. Invisible de loin,
// elle s'allume et clignote quand un joueur s'en approche, pour qu'on ne tombe que si on l'a cherché.
import * as THREE from 'three';
import { SIZE } from './config.js';
import { cellX } from './gen.js';
import { topOf } from './terrain3d.js';
import { shaderTime } from './dither.js';

// positions des deux joueurs (x, sol, z) ; un joueur absent est envoyé très loin
export const edgeU = { uP: { value: [new THREE.Vector3(0, -999, 0), new THREE.Vector3(0, -999, 0)] } };
const C1 = new THREE.Color('#ffd23f'), C2 = new THREE.Color('#1a1033');
const W = 0.2; // largeur de la bande, en cases

const VS = `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS = `
uniform vec3 uP[2]; uniform float uTime; uniform vec3 uC1; uniform vec3 uC2;
varying vec3 vW;
void main(){
  float d = 99.;
  for (int i = 0; i < 2; i++) if (abs(uP[i].y - vW.y) < 1.2) d = min(d, distance(uP[i].xz, vW.xz));
  float a = 1. - smoothstep(1.3, 3.2, d);
  if (a < .02) discard;
  float blink = .55 + .45 * step(.5, fract(uTime * 2.6));
  float stripe = step(.5, fract((vW.x + vW.z) * 2.2));
  gl_FragColor = vec4(mix(uC2, uC1, stripe), a * blink * .9);
}`;

export function buildEdges(data) {
  const pos = [], idx = [], ty = data.type;
  const voidAt = (i, j) => i < 0 || j < 0 || i >= SIZE || j >= SIZE || !ty[i][j];
  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
    const t = ty[i][j];
    if (!t) continue;
    const x = cellX(i), z = cellX(j), y = topOf(t) + 0.1, h = 0.5;
    // un quadrilatère le long de chaque côté qui donne sur le vide
    const quad = (x0, z0, x1, z1) => {
      const n = pos.length / 3;
      pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
      idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
    };
    if (voidAt(i - 1, j)) quad(x - h, z - h, x - h + W, z + h);
    if (voidAt(i + 1, j)) quad(x + h - W, z - h, x + h, z + h);
    if (voidAt(i, j - 1)) quad(x - h, z - h, x + h, z - h + W);
    if (voidAt(i, j + 1)) quad(x - h, z + h - W, x + h, z + h);
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uP: edgeU.uP, uTime: shaderTime, uC1: { value: C1 }, uC2: { value: C2 } },
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;
  return m;
}
