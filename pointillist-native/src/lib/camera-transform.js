// Maps a point in screen space to a point in the camera texture.
//
// We cannot query the camera texture's orientation or dimensions from GL, and
// it differs by platform (iOS hands back a CVPixelBuffer-backed 2D texture,
// Android blits an external OES texture through its own SurfaceTexture matrix).
// So orientation is a *setting*: `ORIENTATIONS` enumerates every rotation/flip
// combination and the in-app dev panel cycles them, which takes two taps on
// device and beats guessing.

export const ORIENTATIONS = [
  { rot: 0, flipY: false },
  { rot: 0, flipY: true },
  { rot: 90, flipY: false },
  { rot: 90, flipY: true },
  { rot: 180, flipY: false },
  { rot: 180, flipY: true },
  { rot: 270, flipY: false },
  { rot: 270, flipY: true },
]

const mul = (a, b) => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
]

/**
 * @param rot        0 | 90 | 180 | 270, applied to the camera image
 * @param flipY      flip the image top-to-bottom
 * @param mirror     mirror left-to-right (selfies look wrong without this)
 * @param viewAspect width / height of the GL view
 * @param texAspect  width / height of the camera texture, in its own orientation
 * @returns `{ xform, centre }` where xform is a column-major mat2 ready for
 *          `uniformMatrix2fv` and camUv = xform * (screenUv - 0.5) + centre.
 */
export function cameraTransform({ rot, flipY, mirror, viewAspect, texAspect }) {
  // Aspect of the image as displayed, i.e. after rotation.
  const shown = rot === 90 || rot === 270 ? 1 / texAspect : texAspect

  // Cover fit: scale down the axis that would otherwise letterbox, so the
  // image always fills the frame and we crop instead of padding.
  let m = [Math.min(1, viewAspect / shown), 0, 0, Math.min(1, shown / viewAspect)]

  if (mirror) m = mul([-1, 0, 0, 1], m)
  if (flipY) m = mul([1, 0, 0, -1], m)

  const r = (rot * Math.PI) / 180
  const c = Math.round(Math.cos(r))
  const s = Math.round(Math.sin(r))
  m = mul([c, -s, s, c], m)

  // GLSL mat2 is column-major: [m00, m10, m01, m11].
  return { xform: [m[0], m[2], m[1], m[3]], centre: [0.5, 0.5] }
}
