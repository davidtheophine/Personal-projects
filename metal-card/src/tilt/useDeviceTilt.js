import { useEffect, useRef } from 'react'

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x)

// Produces a normalized tilt in [-1, 1] on both axes.
//
// Returns two refs:
//   target  - raw input target. The device gyroscope (mobile) writes it here;
//             on desktop the app's card hit-plane writes it on hover and zeroes
//             it on pointer-out, so the card only reacts while the cursor is on
//             it (see App). This hook owns the gyro path only.
//   tilt    - the value the scene reads; the app shell damps `tilt` toward
//             `target` each frame (see <TiltDamper/>).
//
// The iOS 13+ motion-permission prompt is handled by <PermissionButton/>; once
// granted, the deviceorientation listener here starts receiving events.
export function useDeviceTilt({ strength = 1 } = {}) {
  const target = useRef({ x: 0, y: 0 })
  const tilt = useRef({ x: 0, y: 0 })
  const strengthRef = useRef(strength)
  strengthRef.current = strength

  useEffect(() => {
    function onOrient(e) {
      if (e.gamma == null && e.beta == null) return
      // gamma: left/right tilt [-90,90]; beta: front/back tilt [-180,180].
      // Assume the phone is held ~45deg off flat as the neutral pose.
      const gx = clamp((e.gamma || 0) / 45, -1, 1)
      const gy = clamp(((e.beta || 0) - 45) / 45, -1, 1)
      target.current.x = gx * strengthRef.current
      target.current.y = gy * strengthRef.current
    }
    window.addEventListener('deviceorientation', onOrient)
    return () => window.removeEventListener('deviceorientation', onOrient)
  }, [])

  return { tilt, target }
}
