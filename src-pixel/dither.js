// Fondu « tramé » façon Mega Drive : au lieu de la transparence, on retire des pixels selon une
// trame de Bayer 4 × 4. Sert à trois choses :
//  - uFade  : faire apparaître ou disparaître un étage entier pendant les changements de niveau ;
//  - uHole  : percer un cercle autour de ToeJam quand quelque chose passe devant lui (x, y, rayon, profondeur) ;
//  - uFog   : noyer les étages inférieurs dans la couleur du ciel.
export const BAYER = `
float fkB2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
float fkB4(vec2 a){ return fkB2(.5 * a) * .25 + fkB2(a); }
`;

export function levelUniforms(THREE) {
  return {
    uFade: { value: 1 },
    uHole: { value: new THREE.Vector4(0, 0, 0, 0) },
    uFog: { value: new THREE.Color() },
    uFogAmt: { value: 0 },
  };
}

export function patchMaterial(mat, U, { hole = true, water = false } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uFade: U.uFade, uHole: U.uHole, uFog: U.uFog, uFogAmt: U.uFogAmt });
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform float uFade;
uniform vec4 uHole;
uniform vec3 uFog;
uniform float uFogAmt;
${BAYER}
void main() {
  float fkB = fkB4(gl_FragCoord.xy);
  if (fkB >= uFade${water ? ' * 0.72' : ''}) discard;
  ${hole ? `if (uHole.z > 0.5 && gl_FragCoord.z < uHole.w - 0.0012) {
    float fkV = clamp((distance(gl_FragCoord.xy, uHole.xy) - uHole.z * 0.6) / (uHole.z * 0.4), 0.0, 1.0);
    if (fkB >= fkV) discard;
  }` : ''}`)
      .replace('#include <dithering_fragment>', `gl_FragColor.rgb = mix(gl_FragColor.rgb, uFog, uFogAmt);
#include <dithering_fragment>`);
  };
  mat.customProgramCacheKey = () => `fk${hole ? 1 : 0}${water ? 1 : 0}`;
  return mat;
}
