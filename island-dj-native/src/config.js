// Tuned shader/grid params (baked from the web app's DialKit-tuned defaults).
export const DEFAULT_PARAMS = {
  effect: 'Metaballs', // merged blobs; each blob is a centre→edge radial gradient
  effectAmount: 0.9,
  baseRadius: 0.96,
  dominance: 1.1,
  blobOpacity: 0.34,
  flow: 0.09,
  sat: 1.2,
  bright: 0.6,
  cursorSize: 0.17,
  cursorShadow: 0.06,
  halo: 0.0,
  haloRadius: 0.03,
  haloWidth: 0.015,
  grain: 0.0,
  dotScale: 13,
  dotOpacity: 0.37,
  vignette: 0.0,
  dotGlowRadius: 0.14,
  dotGlowBoost: 1.0,
  // exact colours from Figma frame 631-142151 — each metaball is a radial
  // gradient: colX = centre (blob core), edgeX = rim.
  baseColor: '#062712',
  colTR: '#CCD823', // Pop (top-right — Frank Ocean)
  edgeTR: '#41C77D',
  colTL: '#0E629A', // Jazz (top-left)
  edgeTL: '#61C592',
  colBL: '#02D9FF', // Electronic (bottom-left)
  edgeBL: '#303B9F',
  colBR: '#681DC4', // Rock (bottom-right)
  edgeBR: '#49B1CD',
}

// The genre tile is a small icon — a touch more vibrant, finer dots, no dot-glow.
export const TILE_PARAMS = {
  ...DEFAULT_PARAMS,
  dotScale: 27,
  dotOpacity: 0.14,
  sat: 1.2,
  bright: 0.95,
  blobOpacity: 0.72,
  dominance: 1.2,
  cursorSize: 0.22,
  cursorShadow: 0,
  vignette: 0.25,
  flow: 0.03,
  grain: 0.0,
  dotGlowBoost: 0,
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
