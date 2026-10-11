// Rendu 3D pixélisé, dans l'esprit de Petit Potager.
//
//  - la scène est calculée en ~480 lignes puis agrandie sans flou ;
//  - lissage : chaque gros pixel peut être calculé en 2 × 2 sous-pixels puis moyenné
//    (les bords ne font plus d'escaliers, les pixels restent gros) ;
//  - la caméra est calée sur la grille des pixels, quel que soit l'angle : le décor ne grésille pas ;
//    la fraction de pixel restante est rattrapée à l'agrandissement (défilement fluide) ;
//  - contours sombres là où la profondeur saute (silhouettes) ;
//  - palette légèrement quantifiée et tramée, pour le grain.
import * as THREE from 'three';
import { PITCH } from './config.js';
import { BAYER, shaderSS } from './dither.js';

// Réglages de netteté, touche L.
export const MODES = [
  { name: 'PIXEL BRUT', h: 480, ss: 1 },
  { name: 'PIXEL LISSÉ', h: 480, ss: 2 },
  { name: 'FIN ET LISSÉ', h: 720, ss: 2 },
];

const VS = `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Ciel : dégradé, nébuleuses, étoiles en parallaxe, galaxies spirales qui tournent, la Terre,
// et au dernier étage un trou noir dont la gravité tord la lumière des étoiles.
// Tout est calculé à la résolution des gros pixels ; les couleurs sortent en linéaire.
const SKY_FS = `
uniform vec2 uRes; uniform vec2 uScroll; uniform float uTime; uniform float uSS;
uniform float uPan; uniform float uBH;
uniform vec3 uTop; uniform vec3 uBot; uniform vec3 uNeb1; uniform vec3 uNeb2;
${BAYER}
vec3 L(vec3 c){ return pow(c, vec3(2.2)); }
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.03; a *= .5; } return s; }

// position d'un grand objet du ciel : il fait le tour du panorama quand la caméra tourne
vec2 sky(float x, float y){
  float W = uRes.x * 1.6;
  return vec2(mod(x * uRes.x + uPan * W, W) - uRes.x * .3, y * uRes.y) - uScroll * vec2(.02, .02);
}

// galaxie spirale à deux bras, qui tourne sur elle-même
vec3 galaxy(vec3 col, vec2 p, vec2 c, float R, float ratio, float tilt, float speed, vec3 tint, float b){
  vec2 d = p - c;
  float ct = cos(tilt), st = sin(tilt);
  d = vec2(ct * d.x + st * d.y, -st * d.x + ct * d.y);
  d.y /= ratio;
  float r = length(d) / R;
  if (r > 1.4) return col;
  float a = atan(d.y, d.x), spin = uTime * speed;
  float arms = .5 + .5 * cos(2. * (a - spin) + log(r + .03) * 5.5);
  float dust = .55 + .45 * vn(vec2(a * 3. - spin * 3., r * 9.));
  float core = exp(-r * r * 22.);
  float disk = exp(-r * 1.8) * pow(arms, 1.8) * dust * 1.7;
  float I = floor((core * 1.3 + disk) * 7. + b) / 7.;
  return col + tint * I * .75 + L(vec3(1., .94, .8)) * core * .6;
}

vec3 background(vec2 fc, vec2 p, float b){
  // fc : pixel réel (dégradé) ; p : point du ciel après déviation par le trou noir
  float g = floor(fc.y / uRes.y * 14. + b) / 14.;
  vec3 col = mix(uBot, uTop, g);
  vec2 np = (p + uScroll * .12) / 120.;
  float m1 = clamp((fbm(np + vec2(0., uTime * .01)) - .5) * 3., 0., 1.);
  float m2 = clamp((fbm(np * 1.7 + 7.3) - .55) * 3., 0., 1.);
  col = mix(col, uNeb1, floor(m1 * 5. + b) / 5. * .3);
  col = mix(col, uNeb2, floor(m2 * 5. + b) / 5. * .24);
  col = galaxy(col, p, sky(.38, .55), uRes.y * .17, .42, .35, .09, L(vec3(.85, .55, 1.)), b);
  col = galaxy(col, p, sky(.88, .3), uRes.y * .11, .7, -.7, -.13, L(vec3(.45, .85, 1.)), b);
  col = galaxy(col, p, sky(1.22, .7), uRes.y * .075, .55, 1.2, .16, L(vec3(1., .8, .45)), b);
  float h1 = h21(floor(p + uScroll * .18));
  if (h1 > .9975) col = mix(col, vec3(1.), .55 + .45 * sin(uTime * 3. + h1 * 100.));
  if (h21(floor(p + uScroll * .35) + 17.1) > .999) col = vec3(1.);
  vec2 sp = p + uScroll * .5, cell = floor(sp / 40.), lp = floor(sp - cell * 40.);
  float hc = h21(cell + 3.7);
  if (hc > .8) {
    vec2 c = floor(vec2(h21(cell + 1.1), h21(cell + 2.2)) * 30.) + 5.;
    vec2 d = abs(lp - c); float tw = floor(.5 + .5 * sin(uTime * 2. + hc * 50.) + .5);
    if ((d.x < .5 && d.y < 2.5 + tw) || (d.y < .5 && d.x < 2.5 + tw) || (d.x < 1.5 && d.y < 1.5)) col = L(vec3(1., .97, .85));
  }
  return col;
}

void main(){
  vec2 fc = floor(gl_FragCoord.xy / uSS);
  float b = fkB4(fc);
  vec2 bc = sky(.52, .82);
  float R = uRes.y * .12;
  vec2 d = fc + .5 - bc;
  float r = length(d);
  // lentille gravitationnelle : près du trou noir, on voit le ciel qui se trouve « derrière » lui
  vec2 p = fc + d * (R * R * 2.2) / max(r * r, 1.) * uBH;
  vec3 col = background(fc, p, b);

  // la Terre, très loin (elle s'efface au dernier étage)
  vec2 dd = fc + .5 - sky(.8, .76);
  float pr = uRes.y * .085;
  if (uBH < .95 && dot(dd, dd) < pr * pr) {
    vec3 nrm = vec3(dd / pr, sqrt(max(0., 1. - dot(dd, dd) / (pr * pr))));
    float lit = clamp(dot(nrm, normalize(vec3(-.6, .5, .62))), 0., 1.);
    float land = step(.53, fbm(dd / pr * 2.2 + vec2(uTime * .015, 3.)));
    float cloud = step(.62, fbm(dd / pr * 3.1 + vec2(uTime * .03, 9.)));
    vec3 pcol = mix(L(vec3(.16, .38, .9)), L(vec3(.28, .68, .32)), land);
    pcol = mix(pcol, vec3(.9), cloud * .8);
    col = mix(col, pcol * (.05 + 1.1 * floor(lit * 6. + b) / 6.), 1. - uBH);
  } else if (uBH < .95) {
    float rim = length(dd) - pr;
    if (rim < 3.) col = mix(col, L(vec3(.45, .7, 1.)), .35 * (1. - uBH));
  }

  // Gargantua : ombre, anneau de photons, halo du disque vu par-dessus et par-dessous,
  // disque d'accrétion presque de profil qui passe devant, plus brillant du côté qui vient vers nous
  if (uBH > .01) {
    float tl = .07, ct = cos(tl), st = sin(tl);
    vec2 q = vec2(ct * d.x + st * d.y, -st * d.x + ct * d.y) / R;
    float rr = length(q), ang = atan(q.y, q.x);
    vec3 hot = L(vec3(1., .78, .5)), white = L(vec3(1., .96, .88));
    vec3 bh = col;
    bh += hot * exp(-max(rr - 1., 0.) * 2.2) * .18;
    if (rr < 1.) bh = vec3(0.);
    float streak = .55 + .45 * vn(vec2(ang * 9. - uTime * 1.4, rr * 7.));
    float halo = exp(-pow((rr - 1.32) / .2, 2.)) * streak * (.45 + .55 * abs(sin(ang)));
    bh += mix(hot, white, .3) * halo * 1.5 * step(1., rr);
    bh += white * exp(-pow((rr - 1.03) / .03, 2.)) * 1.8;
    float thick = .07 + .02 * abs(q.x);
    float band = exp(-pow(q.y / thick, 2.)) * smoothstep(5.5, 2.2, abs(q.x));
    float flow = .6 + .4 * vn(vec2(q.x * 6. - uTime * 2.4, q.y * 40.));
    float doppler = 1.25 - .45 * clamp(q.x / 4., -1., 1.);
    bh += mix(hot, white, band) * band * 2.4 * flow * doppler;
    bh = floor(bh * 10. + b) / 10.;
    col = mix(col, bh, uBH);
  }
  gl_FragColor = vec4(col, 1.);
}`;

// Agrandissement : moyenne des sous-pixels, contours d'après la profondeur, sRGB, trame, iris.
const BLIT_FS = `
uniform sampler2D tScene; uniform sampler2D tDepth; uniform sampler2D tSceneB; uniform sampler2D tDepthB;
uniform vec2 uTarget; uniform float uScale; uniform vec2 uRem; uniform vec2 uRemB; uniform float uSS;
uniform float uLevels; uniform vec3 uIris; uniform float uRange; uniform vec3 uSplit; uniform vec2 uHalf;
${BAYER}
vec3 toSRGB(vec3 c){ c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
float dz(sampler2D d, vec2 t){ return texture2D(d, (t + .5) / uTarget).r; }
// une vue : moyenne des sous-pixels et contours d'après la profondeur
vec3 view(sampler2D sc, sampler2D d, vec2 pix){
  vec2 base = pix * uSS;
  vec3 c = vec3(0.); float edge = 0., n = 0.;
  for (int i = 0; i < 2; i++) for (int j = 0; j < 2; j++) {
    if (float(i) >= uSS || float(j) >= uSS) continue;
    vec2 t = base + vec2(float(i), float(j));
    c += texture2D(sc, (t + .5) / uTarget).rgb;
    float z = dz(d, t);
    float zn = min(min(dz(d, t + vec2(uSS, 0.)), dz(d, t - vec2(uSS, 0.))), min(dz(d, t + vec2(0., uSS)), dz(d, t - vec2(0., uSS))));
    edge += smoothstep(.3, .7, (z - zn) * uRange);
    n += 1.;
  }
  return c / n * (1. - edge / n * .5);
}
void main(){
  vec2 tp = gl_FragCoord.xy / uScale + vec2(1.) + uRem;
  vec2 pix = floor(tp);
  vec3 c;
  // écran partagé : de quel côté de la ligne est ce pixel ?
  float side = dot(floor(gl_FragCoord.xy / uScale) + .5 - uHalf, uSplit.xy);
  if (uSplit.z > .5 && side > 0.) c = view(tSceneB, tDepthB, floor(gl_FragCoord.xy / uScale + vec2(1.) + uRemB));
  else c = view(tScene, tDepth, pix);
  c = toSRGB(c);
  if (uSplit.z > .5 && abs(side) < 1.6) c = abs(side) < .6 ? vec3(1., .82, .25) : vec3(.1, .06, .2);
  float b = fkB4(pix);
  c = floor(c * (uLevels - 1.) + b) / (uLevels - 1.);
  if (uIris.z >= 0. && distance(pix + .5, uIris.xy) > uIris.z) c = vec3(0.);
  gl_FragColor = vec4(c, 1.);
}`;

const D = 120;

export class Pipeline {
  constructor(canvas, hud) {
    this.canvas = canvas; this.hud = hud;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }));
    r.setPixelRatio(1);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.autoClear = false;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 300);
    const depthTexture = new THREE.DepthTexture(4, 4);
    depthTexture.type = THREE.UnsignedIntType;
    depthTexture.minFilter = depthTexture.magFilter = THREE.NearestFilter;
    const makeTarget = (dt) => new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      generateMipmaps: false, depthBuffer: true, depthTexture: dt,
    });
    this.target = makeTarget(depthTexture);
    const depthB = new THREE.DepthTexture(4, 4);
    depthB.type = THREE.UnsignedIntType;
    depthB.minFilter = depthB.magFilter = THREE.NearestFilter;
    this.targetB = makeTarget(depthB);
    this.cameraB = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 300);
    this.cams = [this.camera, this.cameraB];
    this.targets = [this.target, this.targetB];
    const quad = new THREE.PlaneGeometry(2, 2);
    this.flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.skyU = {
      uRes: { value: new THREE.Vector2() }, uScroll: { value: new THREE.Vector2() }, uTime: { value: 0 },
      uSS: shaderSS, uPan: { value: 0 }, uBH: { value: 0 },
      uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uNeb1: { value: new THREE.Color() }, uNeb2: { value: new THREE.Color() },
    };
    this.skyScene = new THREE.Scene();
    this.skyScene.add(new THREE.Mesh(quad, new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: VS, fragmentShader: SKY_FS, depthTest: false, depthWrite: false })));
    this.blitU = {
      tScene: { value: this.target.texture }, tDepth: { value: depthTexture },
      tSceneB: { value: this.targetB.texture }, tDepthB: { value: depthB },
      uSplit: { value: new THREE.Vector3(1, 0, 0) }, uHalf: { value: new THREE.Vector2() }, uRemB: { value: new THREE.Vector2() },
      uTarget: { value: new THREE.Vector2() }, uScale: { value: 1 }, uRem: { value: new THREE.Vector2() }, uSS: shaderSS,
      uLevels: { value: 40 }, uIris: { value: new THREE.Vector3(0, 0, -1) }, uRange: { value: 299 },
    };
    this.blitScene = new THREE.Scene();
    this.blitScene.add(new THREE.Mesh(quad, new THREE.ShaderMaterial({ uniforms: this.blitU, vertexShader: VS, fragmentShader: BLIT_FS, depthTest: false, depthWrite: false })));
    this.pxs = 0.04;
    this.setMode(1);
    addEventListener('resize', () => this.resize());
  }

  setMode(i) {
    this.mode = (i + MODES.length) % MODES.length;
    this.baseH = MODES[this.mode].h;
    this.ss = MODES[this.mode].ss;
    shaderSS.value = this.ss;
    this.resize();
    return MODES[this.mode].name;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(1, Math.floor(innerWidth * dpr)), H = Math.max(1, Math.floor(innerHeight * dpr));
    this.renderer.setSize(W, H, false);
    this.canvas.style.width = innerWidth + 'px'; this.canvas.style.height = innerHeight + 'px';
    const s = Math.max(1, H / this.baseH);
    const RW = Math.ceil(W / s), RH = Math.ceil(H / s);
    let TW = RW + 2, TH = RH + 2;
    if (TW % 2) TW++;
    if (TH % 2) TH++;
    Object.assign(this, { W, H, s, RW, RH, TW, TH, dpr });
    this.target.setSize(TW * this.ss, TH * this.ss);
    this.targetB.setSize(TW * this.ss, TH * this.ss);
    this.blitU.uHalf.value.set(RW / 2, RH / 2);
    this.skyU.uRes.value.set(TW, TH);
    this.blitU.uTarget.value.set(TW * this.ss, TH * this.ss);
    this.blitU.uScale.value = s;
    // l'interface garde ses gros pixels, quelle que soit la netteté choisie
    const k = (2 * this.baseH) / 480;
    const hw = Math.ceil(RW / k), hh = Math.ceil(RH / k);
    this.hud.width = hw; this.hud.height = hh;
    this.hud.style.width = (hw * k * s) / dpr + 'px'; this.hud.style.height = (hh * k * s) / dpr + 'px';
  }

  // Place la caméra sur `focus`, vue sous l'angle `yaw`, avec `viewH` unités de hauteur visible.
  aim(focus, yaw, viewH, shake = { x: 0, y: 0 }, view = 0) {
    const pxs = (this.pxs = viewH / this.RH);
    const c = this.cams[view], sp = Math.sin(PITCH), cp = Math.cos(PITCH);
    c.left = (-this.TW / 2) * pxs; c.right = (this.TW / 2) * pxs; c.top = (this.TH / 2) * pxs; c.bottom = (-this.TH / 2) * pxs;
    c.updateProjectionMatrix();
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const back = new THREE.Vector3(sy * cp, sp, cy * cp);
    const right = new THREE.Vector3(cy, 0, -sy);
    const up = new THREE.Vector3().crossVectors(back, right);
    const fx = focus.dot(right) / pxs, fu = focus.dot(up) / pxs, fb = focus.dot(back);
    const sx = Math.floor(fx), su = Math.floor(fu);
    (view ? this.blitU.uRemB : this.blitU.uRem).value.set(fx - sx, fu - su);
    const p = right.multiplyScalar((sx + shake.x) * pxs).addScaledVector(up, (su + shake.y) * pxs).addScaledVector(back, fb);
    c.position.copy(p).addScaledVector(back, D);
    c.lookAt(p);
    c.updateMatrixWorld();
    this.blitU.uRange.value = c.far - c.near;
    this.skyU.uScroll.value.set(sx + yaw * 320, su + (focus.y / pxs) * 0.5);
    this.skyU.uPan.value = -yaw / (Math.PI * 2);
  }

  // Position en texels de la cible (pour le trou autour du héros) ; diviser par `ss` pour les gros pixels.
  // axes de l'écran dans le monde, pour l'écran partagé
  axes(yaw) {
    const sp = Math.sin(PITCH), cp = Math.cos(PITCH), sy = Math.sin(yaw), cy = Math.cos(yaw);
    const back = new THREE.Vector3(sy * cp, sp, cy * cp), right = new THREE.Vector3(cy, 0, -sy);
    return { right, up: new THREE.Vector3().crossVectors(back, right) };
  }

  project(v, view = 0) {
    const p = v.clone().project(this.cams[view]);
    return { x: ((p.x + 1) / 2) * this.TW * this.ss, y: ((p.y + 1) / 2) * this.TH * this.ss, z: (p.z + 1) / 2 };
  }

  // Où un point du monde apparaît sur le calque d'interface (en pixels de l'interface) : une position par vue
  // qui le montre ; en écran partagé, seulement du côté de la ligne où cette vue est affichée.
  spots(v, split, views = [0]) {
    const k = (2 * this.baseH) / 480, out = [];
    for (const view of views) {
      const p = v.clone().project(this.cams[view]);
      if (p.z < -1 || p.z > 1) continue;
      const sx = ((p.x + 1) / 2) * this.TW - 1, sy = ((p.y + 1) / 2) * this.TH - 1;
      if (split) { const side = (sx - this.RW / 2) * split.x + (sy - this.RH / 2) * split.y; if (side > 0 !== (view === 1)) continue; }
      if (sx < -20 || sy < -20 || sx > this.RW + 20 || sy > this.RH + 20) continue;
      out.push({ x: sx / k, y: (this.RH - sy) / k });
    }
    return out;
  }

  // Même chose, sans aucun tri : la position (même hors écran) d'un point dans une vue donnée.
  toHud(v, view = 0) {
    const k = (2 * this.baseH) / 480, p = v.clone().project(this.cams[view]);
    return { x: ((((p.x + 1) / 2) * this.TW) - 1) / k, y: (this.RH - (((p.y + 1) / 2) * this.TH - 1)) / k };
  }

  // Dessine une vue (ciel + scène) dans sa cible.
  renderView(scene, view = 0) {
    const r = this.renderer;
    r.setRenderTarget(this.targets[view]);
    r.clear();
    r.render(this.skyScene, this.flatCam);
    r.clearDepth();
    r.render(scene, this.cams[view]);
  }

  // Assemble à l'écran ; split = { x, y } direction de la ligne de partage, ou null.
  present(split) {
    const r = this.renderer;
    if (split) this.blitU.uSplit.value.set(split.x, split.y, 1); else this.blitU.uSplit.value.z = 0;
    r.setRenderTarget(null);
    r.clear();
    r.render(this.blitScene, this.flatCam);
  }
}
