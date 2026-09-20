// Tunable shader/grid params (surfaced live via DialKit in the grid state, and
// persisted across reloads). When settled, inline the winners and drop the dials.
export const DEFAULT_PARAMS = {
  baseRadius: 0.5, // radial size (bleed)
  dominance: 1.6, // how much the approached corner floods the field
  blobOpacity: 0.58, // per-radial alpha — lower = more muted, more mingling
  flow: 0.07, // organic domain-warp motion
  sat: 0.78, // <1 desaturates toward the refined Figma look
  bright: 1.05,
  cursorSize: 0.16, // radius of the recess under the picker
  cursorShadow: 0.4, // how much the picker spot DARKENS (elevation), not brightens
  halo: 0.0, // optional soft light ring around the picker (off by default)
  haloRadius: 0.09,
  haloWidth: 0.02,
  grain: 0.05, // film-grain / noise
  dotScale: 13, // dot-grid spacing (higher = denser)
  dotOpacity: 0.06, // low-opacity dots
  vignette: 0.42,
  dotGlowRadius: 0.2, // radius of the brighter-dots halo around the picker
  dotGlowBoost: 0.4, // how much the dots brighten near the picker
  effect: 0, // index into EFFECTS (0 = Base)
  effectAmt: 0.6, // strength of the active effect
  baseColor: '#062712', // dark base behind the gradient
  colTR: '#CCD823', // Pop (top-right — Frank Ocean)
  colTL: '#41C77D', // Jazz (top-left)
  colBL: '#02D9FF', // Electronic (bottom-left)
  colBR: '#681DC4', // Rock (bottom-right)
}

// Selectable shader effects — index matches u_effect in the shader.
export const EFFECTS = [
  'Base',
  'Dither',
  'Metaballs',
  'Chromatic',
  'Caustics',
  'Bloom',
  'Specular',
  'Fresnel',
  'Curl flow',
]

// The genre tile is a small icon — it reads better a touch more vibrant with a
// finer dot grid than the big (deliberately muted) grid plane.
export const TILE_PARAMS = {
  ...DEFAULT_PARAMS,
  dotScale: 27,
  dotOpacity: 0.14,
  sat: 1.2,
  bright: 1.15,
  blobOpacity: 0.72,
  dominance: 1.2,
  cursorSize: 0.22,
  cursorShadow: 0,
  vignette: 0.25,
  flow: 0.03,
  grain: 0.02,
  dotGlowBoost: 0, // no cursor dot-glow on the tiny tile
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
