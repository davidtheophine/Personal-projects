import { MeshPhysicalMaterial, Vector2, Vector4 } from 'three'
import { BUMP_HOOK, GLOBALS, NOISE, PREAMBLE, VARYINGS } from './chunks.js'
import { DEFAULT_PARAMS, PRESETS } from './presets.js'

/**
 * One uniform object per knob, shared by every piece material: a slider writes
 * `store.uWoodGrain.value` once and all 48 pieces see it, because they all got
 * handed the same uniform object in onBeforeCompile.
 */
export function createUniformStore() {
  const store = {
    uTime: { value: 0 },
    uPuzzle: { value: new Vector2(6, 4) },
    uThickness: { value: 0.22 },
  }
  for (const [key, value] of Object.entries(DEFAULT_PARAMS)) store[key] = { value }
  return store
}

/**
 * Builds a piece material for one preset.
 *
 * Every piece gets its *own* MeshPhysicalMaterial instance so it can carry a
 * per-piece uniform (seed, wobble amount, hover highlight, yaw) - three only
 * re-uploads custom uniforms when the material instance changes between draw
 * calls. They all share one compiled program thanks to customProgramCacheKey,
 * so the cost is a few hundred bytes each, not a shader compile each.
 */
export function createPieceMaterial(presetKey, { map, store, seed = 0, wobbleScale = 1 }) {
  const preset = PRESETS[presetKey]
  const material = new MeshPhysicalMaterial({ color: 0xffffff, map, ...preset.material })
  const uPiece = { value: new Vector4(seed, 0, 0, 0) }
  const uSpark = { value: 0 }
  material.userData.uPiece = uPiece
  material.userData.uSpark = uSpark
  material.userData.preset = presetKey

  const uniformDecls = preset.controls.map((c) => `uniform float ${c.uniform};`).join('\n')
  const wobble = (preset.wobble ?? 0) * wobbleScale
  // mutate, never replace: MeshPhysicalMaterial ships STANDARD/PHYSICAL in here
  if (preset.bump > 0) material.defines.JS_BUMP = ''

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, store)
    shader.uniforms.uPiece = uPiece
    shader.uniforms.uSpark = uSpark

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VARYINGS}`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        vUp = objectNormal.y;
        vWorldNrm = normalize(mat3(modelMatrix) * objectNormal);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        ${
          wobble > 0
            ? `{
          // slow breathing all the time, a real jiggle right after a drop
          float ph = uTime * 2.4 + uPiece.x * 6.283;
          float amp = (0.12 + uPiece.y) * ${wobble.toFixed(3)} * 0.05;
          float k = transformed.x * 2.2 + transformed.z * 2.2;
          float h = transformed.y / max(uThickness, 0.001);
          transformed.y += sin(ph + k) * amp * (0.35 + h);
          transformed.xz *= 1.0 + sin(ph * 1.3 + k) * amp * 0.3;
        }`
            : ''
        }
        vLocal = transformed;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${VARYINGS}\n${uniformDecls}\n${NOISE}\n${GLOBALS}`)
      .replace(
        '#include <map_fragment>',
        `${PREAMBLE}
        ${preset.glsl}
        gEmissive += vec3(0.5, 0.68, 1.0) * uPiece.z * (0.12 + rim * 0.6);
        // magnet pull / snap flash: warm, and brightest right at the edges
        gEmissive += vec3(1.0, 0.76, 0.38) * uSpark * (0.25 + rim * 1.5);`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(gRough, 0.015, 1.0);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = clamp(gMetal, 0.0, 1.0);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${BUMP_HOOK}`)
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gEmissive;',
      )
  }

  // All pieces of a preset share one program; the per-piece uniform rides along.
  material.customProgramCacheKey = () => `piece-${presetKey}`
  return material
}
