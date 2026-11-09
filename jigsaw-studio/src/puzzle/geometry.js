import { ExtrudeGeometry, Shape, Vector3 } from 'three'
import { makeCutter } from './edges.js'

/**
 * Builds one extruded, beveled geometry per piece plus the slot it belongs in.
 *
 * World layout: the puzzle lies flat on the XZ plane, +Y is up, and a piece's
 * local origin sits at the centre of its cell on the table surface - so a
 * resting piece is just `position.y = 0` and a lifted one raises Y.
 *
 * UVs come from each vertex's position in the whole-puzzle plane, which is
 * what makes the knobs carry the image that belongs to them (a tab reaches
 * into its neighbour's cell and must show that bit of the painting), and lets
 * every shader address the image through a single varying.
 */
export function buildPuzzle({
  cols,
  rows,
  aspect = 1,
  seed = 1,
  tab = 1,
  span = 6, // longest side of the puzzle, in world units
  depth = 0.22, // piece thickness
}) {
  const width = aspect >= 1 ? span : span * aspect
  const height = aspect >= 1 ? span / aspect : span
  const sx = width / cols
  const sy = height / rows
  const bevel = Math.min(sx, sy) * 0.035

  const cutter = makeCutter({ cols, rows, seed, tab })
  const pieces = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // grid space -> local piece space: centre on the cell, scale to world
      const shape = new Shape()
      cutter.outline(col, row).forEach((p, i) => {
        const x = (p.x - (col + 0.5)) * sx
        const y = (p.y - (row + 0.5)) * sy
        if (i === 0) shape.moveTo(x, y)
        else shape.lineTo(x, y)
      })
      shape.closePath()

      // bevelOffset: -bevelSize keeps the *walls* on the cut line and insets
      // the lid instead, so the chamfer reads as a milled edge and neighbours
      // still butt together exactly. The extrusion is shortened by the two
      // bevel caps and shifted back up so the slab spans y = 0..depth.
      const geometry = new ExtrudeGeometry(shape, {
        depth: Math.max(depth - 2 * bevel, depth * 0.2),
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelOffset: -bevel,
        bevelSegments: 1, // a single facet: a crisp machined chamfer, half the verts
        steps: 1,
      })
      geometry.translate(0, 0, bevel)

      const cx = (col + 0.5) * sx - width / 2
      const cy = (row + 0.5) * sy - height / 2
      writeUvs(geometry, cx, cy, width, height)
      // Shape XY -> table XZ: (x, y, z) becomes (x, z, -y), so the extrusion
      // 0..depth becomes height above the table and the image's +v runs to -Z.
      geometry.rotateX(-Math.PI / 2)

      pieces.push({
        id: `${col}-${row}`,
        col,
        row,
        geometry,
        home: new Vector3(cx, 0, -cy),
        seed: (Math.abs((col * 73856093) ^ (row * 19349663) ^ seed) % 1000) / 1000,
      })
    }
  }

  return { pieces, width, height, sx, sy, depth, cols, rows }
}

/**
 * Replaces ExtrudeGeometry's own UVs with puzzle-plane coordinates. The same
 * rule covers the lid, the bevel and the walls: every vertex asks the image
 * "what colour are you at my spot on the table?", and each shader decides how
 * much of that to show on a given face from the surface normal.
 */
function writeUvs(geometry, cx, cy, width, height) {
  const pos = geometry.attributes.position
  const uv = geometry.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + cx) / width + 0.5, (pos.getY(i) + cy) / height + 0.5)
  }
  uv.needsUpdate = true
}

/**
 * How far loose pieces are thrown around the tray. The camera rig and the
 * scatter both read this, so the pieces always land inside the shot.
 */
export const scatterExtents = ({ width, height }) => ({
  x: width / 2 + 2.1,
  z: height / 2 + 1.8,
})

/** Frees every geometry in a built puzzle. */
export function disposePuzzle(puzzle) {
  puzzle?.pieces.forEach((p) => p.geometry.dispose())
}
