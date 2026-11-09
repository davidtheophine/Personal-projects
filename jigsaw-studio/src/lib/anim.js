/** Frame-rate independent exponential approach. */
export const damp = (current, target, lambda, dt) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt))

/** Shortest signed distance from a to b on the circle. */
export const angleDelta = (a, b) => {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export const dampAngle = (current, target, lambda, dt) =>
  current + angleDelta(current, target) * (1 - Math.exp(-lambda * dt))

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
