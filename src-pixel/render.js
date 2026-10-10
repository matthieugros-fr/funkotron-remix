// Rendu en basse résolution, puis agrandissement net à l'écran.
//
// Pour que le pixel art reste propre en mouvement :
//  - la caméra est calée sur la grille des pixels (aucun texel ne « grésille ») ;
//  - le reste, la fraction de pixel, est rattrapé au moment de l'agrandissement,
//    ce qui donne un défilement fluide à la résolution de l'écran ;
//  - l'image rendue a 2 pixels de marge pour ce décalage.
import * as THREE from 'three';
import { PX, SIN_P, COS_P, BASE_H } from './config.js';
import { BAYER } from './dither.js';

const VS = `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const SKY_FS = `
uniform vec2 uRes; uniform vec2 uScroll; uniform float uTime;
uniform vec3 uTop; uniform vec3 uBot; uniform vec3 uNeb1; uniform vec3 uNeb2;
${BAYER}
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.03; a *= .5; } return s; }
void main(){
  vec2 fc = floor(gl_FragCoord.xy);
  float b = fkB4(fc);
  float g = floor(fc.y / uRes.y * 10. + b) / 10.;
  vec3 col = mix(uBot, uTop, g);
  vec2 np = (fc + uScroll * .12) / 70.;
  float m1 = clamp((fbm(np + vec2(0., uTime * .01)) - .5) * 3., 0., 1.);
  float m2 = clamp((fbm(np * 1.7 + 7.3) - .55) * 3., 0., 1.);
  col = mix(col, uNeb1, floor(m1 * 4. + b) / 4. * .35);
  col = mix(col, uNeb2, floor(m2 * 4. + b) / 4. * .28);
  // la Terre, très loin
  vec2 pc = vec2(uRes.x * .8, uRes.y * .76) - uScroll * .03;
  vec2 dd = fc + .5 - pc; float pr = 22.;
  if (dot(dd, dd) < pr * pr) {
    vec3 nrm = vec3(dd / pr, sqrt(max(0., 1. - dot(dd, dd) / (pr * pr))));
    float lit = clamp(dot(nrm, normalize(vec3(-.6, .5, .62))), 0., 1.);
    float land = step(.53, fbm(dd / pr * 2.2 + vec2(uTime * .015, 3.)));
    float cloud = step(.62, fbm(dd / pr * 3.1 + vec2(uTime * .03, 9.)));
    vec3 pcol = mix(vec3(.16, .38, .9), vec3(.28, .68, .32), land);
    pcol = mix(pcol, vec3(.95), cloud * .8);
    col = pcol * (.18 + .9 * floor(lit * 4. + b) / 4.);
  } else {
    float rim = length(dd) - pr;
    if (rim < 2.) col = mix(col, vec3(.45, .7, 1.), .35);
    vec2 s1 = floor(fc + uScroll * .18); float h1 = h21(s1);
    if (h1 > .9965) col = mix(col, vec3(1.), .55 + .45 * sin(uTime * 3. + h1 * 100.));
    if (h21(floor(fc + uScroll * .35) + 17.1) > .9985) col = vec3(1.);
    vec2 sp = fc + uScroll * .5, cell = floor(sp / 28.), lp = floor(sp - cell * 28.);
    float hc = h21(cell + 3.7);
    if (hc > .8) {
      vec2 c = floor(vec2(h21(cell + 1.1), h21(cell + 2.2)) * 20.) + 4.;
      vec2 d = abs(lp - c); float tw = floor(.5 + .5 * sin(uTime * 2. + hc * 50.) + .5);
      if ((d.x < .5 && d.y < 1.5 + tw) || (d.y < .5 && d.x < 1.5 + tw)) col = vec3(1., .97, .85);
    }
  }
  gl_FragColor = vec4(col, 1.);
}`;

const BLIT_FS = `
uniform sampler2D tScene; uniform vec2 uTarget; uniform float uScale; uniform vec2 uRem;
uniform float uLevels; uniform vec3 uIris;
${BAYER}
void main(){
  vec2 tp = gl_FragCoord.xy / uScale + vec2(1.) + uRem;
  vec2 pix = floor(tp);
  vec3 c = texture2D(tScene, (pix + .5) / uTarget).rgb;
  if (uLevels < 255.) { float b = fkB4(pix); c = floor(c * (uLevels - 1.) + b) / (uLevels - 1.); }
  if (uIris.z >= 0. && distance(pix + .5, uIris.xy) > uIris.z) c = vec3(0.);
  gl_FragColor = vec4(c, 1.);
}`;

export class Pipeline {
  constructor(canvas, hud) {
    this.canvas = canvas; this.hud = hud;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }));
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.setPixelRatio(1);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.BasicShadowMap;
    r.autoClear = false;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.target = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true });
    const quad = new THREE.PlaneGeometry(2, 2);
    this.flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.skyU = {
      uRes: { value: new THREE.Vector2() }, uScroll: { value: new THREE.Vector2() }, uTime: { value: 0 },
      uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uNeb1: { value: new THREE.Color() }, uNeb2: { value: new THREE.Color() },
    };
    this.skyScene = new THREE.Scene();
    this.skyScene.add(new THREE.Mesh(quad, new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: VS, fragmentShader: SKY_FS, depthTest: false, depthWrite: false })));
    this.blitU = {
      tScene: { value: this.target.texture }, uTarget: { value: new THREE.Vector2() }, uScale: { value: 1 },
      uRem: { value: new THREE.Vector2() }, uLevels: { value: 256 }, uIris: { value: new THREE.Vector3(0, 0, -1) },
    };
    this.blitScene = new THREE.Scene();
    this.blitScene.add(new THREE.Mesh(quad, new THREE.ShaderMaterial({ uniforms: this.blitU, vertexShader: VS, fragmentShader: BLIT_FS, depthTest: false, depthWrite: false })));
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(1, Math.floor(innerWidth * dpr)), H = Math.max(1, Math.floor(innerHeight * dpr));
    this.renderer.setSize(W, H, false);
    this.canvas.style.width = innerWidth + 'px'; this.canvas.style.height = innerHeight + 'px';
    const s = Math.max(1, Math.round(H / BASE_H));
    const RW = Math.ceil(W / s), RH = Math.ceil(H / s);
    let TW = RW + 2, TH = RH + 2;
    if (TW % 2) TW++;
    if (TH % 2) TH++;
    Object.assign(this, { W, H, s, RW, RH, TW, TH, dpr });
    this.target.setSize(TW, TH);
    const c = this.camera;
    c.left = -TW / 2 / PX; c.right = TW / 2 / PX; c.top = TH / 2 / PX; c.bottom = -TH / 2 / PX;
    c.updateProjectionMatrix();
    this.skyU.uRes.value.set(TW, TH);
    this.blitU.uTarget.value.set(TW, TH);
    this.blitU.uScale.value = s;
    this.hud.width = RW; this.hud.height = RH;
    this.hud.style.width = (RW * s) / dpr + 'px'; this.hud.style.height = (RH * s) / dpr + 'px';
  }

  // Place la caméra sur `focus`, calée sur les pixels. `shake` en pixels entiers.
  aim(focus, shake = { x: 0, y: 0 }) {
    const fx = focus.x * PX, fu = (focus.y * COS_P - focus.z * SIN_P) * PX;
    const sx = Math.floor(fx), su = Math.floor(fu);
    this.blitU.uRem.value.set(fx - sx, fu - su);
    const ox = (sx + shake.x) / PX, ou = (su + shake.y) / PX, ob = focus.y * SIN_P + focus.z * COS_P;
    // repère caméra : droite (1,0,0), haut (0,cos,-sin), arrière (0,sin,cos)
    const px = ox, py = ou * COS_P + ob * SIN_P, pz = -ou * SIN_P + ob * COS_P, D = 120;
    this.camera.position.set(px, py + SIN_P * D, pz + COS_P * D);
    this.camera.lookAt(px, py, pz);
    this.camera.updateMatrixWorld();
    this.skyU.uScroll.value.set(sx, su + focus.y * PX * 1.2);
  }

  // Position d'un point du monde en pixels de l'image basse résolution, et sa profondeur.
  project(v) {
    const p = v.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * this.TW, y: ((p.y + 1) / 2) * this.TH, z: (p.z + 1) / 2 };
  }

  render(scene) {
    const r = this.renderer;
    r.setRenderTarget(this.target);
    r.clear();
    r.render(this.skyScene, this.flatCam);
    r.clearDepth();
    r.render(scene, this.camera);
    r.setRenderTarget(null);
    r.clear();
    r.render(this.blitScene, this.flatCam);
  }
}
