import { PixelRatio, Platform } from 'react-native'

export { MIN_DOT_PX } from './lib/constants'

/**
 * Sliders. `value` is the starting position; the dot size is in points and gets
 * multiplied by the screen's pixel ratio before it reaches the shader.
 */
export const CONTROLS = {
  dotSize: { label: 'Size', min: 2, max: 40, value: 20, step: 0.5 },
  colour: { label: 'Colour', min: 0, max: 2, value: 2, step: 0.01 },
  palette: { label: 'Palette', min: 2, max: 17, value: 17, step: 1 },
}

/** Fixed parts of the look. Tune these to change the house style. */
export const LOOK = {
  fill: 1.02, // dot diameter as a fraction of its cell; > 1 lets dabs overlap
  stagger: 0, // 0 = square grid like the reference, 0.5 = brickwork
  jitter: 0.1, // per-dot size wobble, so the grid reads as hand-placed
  lumaSize: 0.22, // darker tones swell slightly, the way loaded paint does
  paperTint: 0.0, // bleed of dot colour into the gaps
}

// First entry is what the app opens with.
export const PAPERS = [
  { name: 'Ink', colour: '#0A0A0B' },
  { name: 'Snow', colour: '#FFFFFF' },
  { name: 'Paper', colour: '#F4EFE4' },
  { name: 'Slate', colour: '#15181C' },
]

/**
 * Camera texture orientation. Index into `ORIENTATIONS` in
 * `lib/camera-transform.js`. These are the best starting guesses; if the
 * preview comes up rotated or mirrored, long-press the paper chip to open the
 * dev panel, cycle until it looks right, and paste the index it prints here.
 */
export const DEFAULT_ORIENTATION = Platform.select({ ios: 1, android: 1, default: 1 })

/** Camera texture aspect (width / height) in its own orientation. */
export const CAMERA_TEXTURE_ASPECT = 3 / 4

/** `takeSnapshotAsync` reads a y-up GL framebuffer; flip if saves come out upside down. */
export const SNAPSHOT_FLIP = false

export const toDevicePx = (points) => points * PixelRatio.get()
