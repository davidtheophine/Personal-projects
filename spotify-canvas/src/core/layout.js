// Radial fan-out geometry — pure math, platform-neutral (reused by the Expo port).
// React Flow coordinates: +x right, +y down; angles via atan2(dy, dx).

/**
 * Positions for `count` child cards evenly spread across an arc around `origin`.
 * @param {{x:number,y:number}} origin
 * @param {number} count
 * @param {{radius:number, arcRad:number, baseAngle:number}} opts
 *   radius: distance from origin; arcRad: total angular spread; baseAngle: arc center.
 * @returns {Array<{x:number,y:number}>}
 */
export function fanOutPositions(origin, count, { radius, arcRad, baseAngle }) {
  const positions = []
  for (let i = 0; i < count; i++) {
    const angle =
      count === 1 ? baseAngle : baseAngle - arcRad / 2 + (arcRad * i) / (count - 1)
    positions.push({
      x: origin.x + radius * Math.cos(angle),
      y: origin.y + radius * Math.sin(angle),
    })
  }
  return positions
}

/**
 * Direction (radians) of the vector from `from` to `to`. Used to grow a node's
 * children away from where the node itself came from.
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @returns {number}
 */
export function outwardAngle(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x)
}
