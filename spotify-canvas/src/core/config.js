// Tuned constants — platform-neutral (the Expo port imports the same numbers).

export const SEED_SONG_ID = 'billie-jean'
export const FAN_COUNT = 5

// Radial fan-out geometry. Radius/arc chosen so 5 sibling cards never overlap
// (chord spacing > card width) while staying close enough to read as a cluster.
export const FAN = {
  radius: 440,
  arcRad: (130 * Math.PI) / 180,
}

// Viewport motion on "give me more": pan to the new cluster, preserve the user's
// zoom (spatial consistency beats auto-zoom that jumps around).
export const VIEWPORT = {
  initialZoom: 0.9,
  panMs: 620,
}

// Motion tokens. Strong custom curves — the built-in CSS easings lack punch.
export const MOTION = {
  cardEnterMs: 260,
  cardStaggerMs: 55,
  easeOut: 'cubic-bezier(0.23, 1, 0.32, 1)',
  easeInOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
}

// Spotify-leaning dark palette.
export const COLORS = {
  bg: '#0b0b0e',
  surface: '#181818',
  elevated: '#282828',
  green: '#1db954',
  greenBright: '#1ed760',
  text: '#ffffff',
  subtext: '#a7a7a7',
  edge: 'rgba(255,255,255,0.14)',
  edgeActive: '#1db954',
}
