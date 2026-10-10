// Ajouts au shader des matériaux de Three.js.
//  - uFade  : fondu « tramé » (trame de Bayer 4 × 4) d'un étage entier pendant les changements de niveau ;
//  - uHole  : cercle tramé percé autour du héros quand quelque chose passe devant lui (x, y, rayon, profondeur) ;
//  - uFog   : noyer les étages inférieurs dans la couleur du ciel ;
//  - détail : grain de matière projeté selon les trois axes du monde (terre, herbe, roche) ;
//  - eau    : crêtes de vaguelettes qui bougent.
export const BAYER = `
float fkB2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
float fkB4(vec2 a){ return fkB2(.5 * a) * .25 + fkB2(a); }
`;

const shared = { uTime: { value: 0 }, tDetail: { value: null }, uSS: { value: 1 } };
export const shaderTime = shared.uTime;
export const shaderSS = shared.uSS;   // sous-pixels par gros pixel (lissage)
export function setDetailTexture(t) { shared.tDetail.value = t; }

export function levelUniforms(THREE) {
  return {
    uFade: { value: 1 },
    uHole: { value: new THREE.Vector4(0, 0, 0, 0) },
    uFog: { value: new THREE.Color() },
    uFogAmt: { value: 0 },
    uLevelY: { value: 0 },
    // grain de matière de l'étage (selon le biome) et couleurs de son liquide
    tDetail: { value: shared.tDetail.value },
    uLiqDeep: { value: new THREE.Color('#08339a') },
    uLiqShore: { value: new THREE.Color('#1a8cb3') },
    uLiqCrest: { value: new THREE.Color('#eaf6ff') },
    uLiqGlow: { value: 0 },
    // le liquide du biome secondaire (sa région)
    uLiq2Deep: { value: new THREE.Color('#08339a') },
    uLiq2Shore: { value: new THREE.Color('#1a8cb3') },
    uLiq2Crest: { value: new THREE.Color('#eaf6ff') },
    uLiq2Glow: { value: 0 },
  };
}

const DEF = { deep: { value: { r: 0.03, g: 0.2, b: 0.6 } }, shore: { value: { r: 0.1, g: 0.55, b: 0.7 } }, crest: { value: { r: 0.92, g: 0.97, b: 1 } }, glow: { value: 0 } };
export function patchMaterial(mat, U, { hole = true, water = false, detail = false } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uFade: U.uFade, uHole: U.uHole, uFog: U.uFog, uFogAmt: U.uFogAmt, uLevelY: U.uLevelY, uTime: shared.uTime, tDetail: U.tDetail || shared.tDetail, uSS: shared.uSS,
      uLiqDeep: U.uLiqDeep || DEF.deep, uLiqShore: U.uLiqShore || DEF.shore, uLiqCrest: U.uLiqCrest || DEF.crest, uLiqGlow: U.uLiqGlow || DEF.glow,
      uLiq2Deep: U.uLiq2Deep || DEF.deep, uLiq2Shore: U.uLiq2Shore || DEF.shore, uLiq2Crest: U.uLiq2Crest || DEF.crest, uLiq2Glow: U.uLiq2Glow || DEF.glow });
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', `varying vec3 vFkPos;\nvarying vec3 vFkNrm;\n${water ? 'attribute float aShore;\nattribute float aLiq;\nvarying float vFkShore;\nvarying float vFkLiq;\n' : ''}void main() {\n${water ? '  vFkShore = aShore;\n  vFkLiq = aLiq;\n' : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
  vFkPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vFkNrm = normalize(mat3(modelMatrix) * normal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform float uFade;
uniform vec4 uHole;
uniform vec3 uFog;
uniform float uFogAmt;
uniform float uTime;
uniform float uLevelY;
uniform float uSS;
uniform sampler2D tDetail;
uniform vec3 uLiqDeep;
uniform vec3 uLiqShore;
uniform vec3 uLiqCrest;
uniform float uLiqGlow;
uniform vec3 uLiq2Deep;
uniform vec3 uLiq2Shore;
uniform vec3 uLiq2Crest;
uniform float uLiq2Glow;
varying vec3 vFkPos;
varying vec3 vFkNrm;
${water ? 'varying float vFkShore;\nvarying float vFkLiq;' : ''}
${BAYER}
float fkHash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float fkB = fkB4(floor(gl_FragCoord.xy / uSS));
  if (fkB >= uFade) discard;
  ${hole ? `if (uHole.z > 0.5 && gl_FragCoord.z < uHole.w - 0.002) {
    float fkV = clamp((distance(gl_FragCoord.xy, uHole.xy) - uHole.z * 0.6) / (uHole.z * 0.4), 0.0, 1.0);
    if (fkB >= fkV) discard;
  }` : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  ${detail ? `{
    vec3 fkN = abs(normalize(vFkNrm)) + 0.001;
    float fkD = (texture2D(tDetail, vFkPos.xz * 0.32).r * fkN.y + texture2D(tDetail, vFkPos.xy * 0.32).r * fkN.z
               + texture2D(tDetail, vFkPos.zy * 0.32).r * fkN.x) / (fkN.x + fkN.y + fkN.z);
    diffuseColor.rgb *= 0.68 + 0.64 * fkD;
    // fond des lacs : teinte bleutée et reflets lumineux qui dansent
    float fkLy = vFkPos.y - uLevelY;
    if (fkLy < -0.2 && fkLy > -0.62 && vFkNrm.y > 0.5) {
      diffuseColor.rgb *= mix(vec3(0.7, 0.88, 1.0), uLiqShore * 1.3, uLiqGlow);
      {
        vec2 q = vFkPos.xz * 2.4;
        float c1 = sin(q.x + uTime * 1.3 + sin(q.y * 1.7 + uTime)) + sin(q.y * 1.3 - uTime * 1.1 + sin(q.x * 1.9 - uTime * 0.8));
        diffuseColor.rgb += mix(vec3(0.35, 0.45, 0.4), uLiqCrest * 0.6, uLiqGlow) * step(abs(c1), 0.2);
      }
    }
  }` : ''}
  ${water ? `{
    // turquoise près des rives, bleu profond au milieu
    vec3 lDeep = mix(uLiqDeep, uLiq2Deep, vFkLiq), lShore = mix(uLiqShore, uLiq2Shore, vFkLiq), lCrest = mix(uLiqCrest, uLiq2Crest, vFkLiq);
    float lGlow = mix(uLiqGlow, uLiq2Glow, vFkLiq);
    diffuseColor.rgb = mix(lDeep, lShore, vFkShore);
    // la lave (et l'eau phosphorescente) bouillonne : de grosses taches lentes plus claires
    diffuseColor.rgb = mix(diffuseColor.rgb, lShore, lGlow * 0.5 * smoothstep(0.3, 0.9, sin(vFkPos.x * 1.3 + uTime * 0.6) * sin(vFkPos.z * 1.1 - uTime * 0.5) + 0.4));
    diffuseColor.a = mix(0.82, 0.62, vFkShore);
    // vaguelettes qui défilent
    float fkW = sin(vFkPos.x * 3.1 + vFkPos.z * 1.7 + uTime * 1.8 + sin(vFkPos.z * 2.3 + uTime) * 1.4);
    float fkC = step(0.93, fkW) * step(0.4, sin(vFkPos.z * 5.0 - vFkPos.x * 1.3 + uTime * 0.7));
    // écume qui ondule le long des berges
    float fkF = step(0.86, vFkShore + 0.1 * sin(vFkPos.x * 7.0 + uTime * 2.2) * sin(vFkPos.z * 6.0 - uTime * 1.6));
    // éclats de soleil qui scintillent
    vec2 fkG = floor(vFkPos.xz * 7.0);
    float fkS = step(0.985, fkHash(fkG + floor(uTime * 4.0 + fkHash(fkG) * 4.0)));
    float fkWhite = max(max(fkC * 0.7, fkF), fkS);
    diffuseColor.rgb = mix(diffuseColor.rgb, lCrest, fkWhite);
    diffuseColor.a = mix(diffuseColor.a, 1.0, max(fkWhite, lGlow));
  }` : ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  ${water ? 'totalEmissiveRadiance += diffuseColor.rgb * mix(uLiqGlow, uLiq2Glow, vFkLiq) * 0.85;' : ''}
  ${detail ? `if (uLiqGlow > 0.0 && vFkPos.y - uLevelY < -0.2 && vFkPos.y - uLevelY > -0.62 && vFkNrm.y > 0.5) totalEmissiveRadiance += diffuseColor.rgb * uLiqGlow * 0.5;` : ''}`)
      .replace('#include <dithering_fragment>', `gl_FragColor.rgb = mix(gl_FragColor.rgb, uFog, uFogAmt);
#include <dithering_fragment>`);
  };
  mat.customProgramCacheKey = () => `fk${hole ? 1 : 0}${water ? 1 : 0}${detail ? 1 : 0}`;
  return mat;
}
