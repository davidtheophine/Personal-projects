// Single source of truth for the card's dialed-in values. Kept renderer-
// agnostic so a future Expo/native port can import the same numbers.

export const CARD = {
  width: 3.4, // ISO card ratio ~1.586
  height: 2.14,
  radius: 0.16,
  depth: 0.05,
  inset: 0.02, // face overlay inset from the beveled rim
  // Resting pose: a slight top-back tilt to catch the overhead light. Y is 0 so
  // hovering left vs right tilts the card by an equal amount (symmetric).
  homeTiltX: 0.18,
  homeTiltY: 0,
}

export const MATERIAL = {
  color: '#191a1e', // lifted gunmetal so the fine sandblast texture reads
  roughness: 0.3,
  anisotropy: 0.2, // finer, more isotropic sandblast (less linear brushing)
  anisotropyRotation: 0,
  clearcoat: 0.45,
  clearcoatRoughness: 0.5,
  envMapIntensity: 2.1,
  normalScale: 0.7,
}

export const TILT = {
  tiltStrength: 1,
  envAmount: 1.0,
  parallax: 0.35,
  smooth: 0.35,
}

export const POST = {
  postFX: false, // vignette/bloom off by default
  bloom: 0.7,
  vignette: 0.7,
}
