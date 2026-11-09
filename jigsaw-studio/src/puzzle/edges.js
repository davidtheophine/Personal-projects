import { CubicBezierCurve, LineCurve, Vector2 } from 'three'

/** Deterministic PRNG (mulberry32) so a seed always re-cuts the same puzzle. */
export function makeRng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// One jigsaw edge, in "edge space": it runs from (0,0) to (1,0) along +x and
// the knob bulges towards +y. The knob's shoulders pull back past the neck
// (CTRL_X > NECK), which is what gives a real jigsaw its undercut - the bit
// that makes two pieces actually hold on to each other.
//
// Edges are sampled to polylines rather than kept as curves because both
// neighbours of an internal cut reuse the *same* sample list (one of them
// reversed), so interlocking pieces share vertices exactly and never leave a
// hairline gap.
// ---------------------------------------------------------------------------
const SHOULDER = 0.2 // where the flat run ends and the shoulder starts
const NECK = 0.085 // half-width of the neck
const NECK_Y = 0.13 // height at which the neck pinches
const CTRL_X = 0.23 // how far the knob overhangs the neck
const KNOB_Y = 0.42 // tip of the knob
const BEZIER_STEPS = 9

/** Per-edge jitter so no two cuts look stamped from the same die. */
export function makeEdgeParams(rng) {
  return {
    sign: rng() < 0.5 ? -1 : 1,
    mid: 0.5 + (rng() - 0.5) * 0.08, // knob slides along the edge
    size: 0.86 + rng() * 0.28, // knob scale
    lean: (rng() - 0.5) * 0.1, // asymmetric shoulders
  }
}

/**
 * Samples an edge into points in edge space, from t=0 (inclusive) to t=1
 * (exclusive) so four edges concatenate into a closed ring.
 *
 * @param {object} p  params from makeEdgeParams
 * @param {number} flip  -1 when this piece walks the cut backwards
 * @param {number} tab  global knob-size multiplier
 */
export function sampleEdge(p, flip, tab) {
  if (!p) return [new Vector2(0, 0)] // straight border edge

  const s = p.sign * flip * p.size * tab
  const m = p.mid
  const sh = SHOULDER * p.size
  const ny = NECK_Y * s
  const ky = KNOB_Y * s
  const nk = NECK * p.size
  const cx = CTRL_X * p.size
  const lean = p.lean

  const pts = [new Vector2(0, 0)]
  const push = (curve) => {
    for (let i = 0; i < BEZIER_STEPS; i++) pts.push(curve.getPoint(i / BEZIER_STEPS))
  }

  const a = new Vector2(m - sh, 0)
  const b = new Vector2(m - nk, ny)
  const tip = new Vector2(m + lean * 0.5, ky)
  const b2 = new Vector2(m + nk, ny)
  const a2 = new Vector2(m + sh, 0)

  pts.push(a)
  // shoulder: flat table rises into the neck
  push(
    new CubicBezierCurve(
      a,
      new Vector2(m - sh * 0.45, 0),
      new Vector2(m - nk - 0.03, ny * 0.55),
      b,
    ),
  )
  // left half of the knob - controls reach out past the neck for the undercut
  push(
    new CubicBezierCurve(
      b,
      new Vector2(m - cx, ny + (ky - ny) * 0.35),
      new Vector2(m - cx + lean, ky),
      tip,
    ),
  )
  // right half, mirrored
  push(new CubicBezierCurve(tip, new Vector2(m + cx + lean, ky), new Vector2(m + cx, ny + (ky - ny) * 0.35), b2))
  push(
    new CubicBezierCurve(
      b2,
      new Vector2(m + nk + 0.03, ny * 0.55),
      new Vector2(m + sh * 0.45, 0),
      a2,
    ),
  )
  push(new LineCurve(a2, new Vector2(1, 0)))
  return pts
}

/**
 * Cuts a cols x rows grid: every internal edge is stored once, so each cut is
 * shared by exactly the two pieces it separates.
 *
 * Grid space has one piece = 1x1, origin at the puzzle's bottom-left corner.
 */
export function makeCutter({ cols, rows, seed = 1, tab = 1 }) {
  const rng = makeRng(seed)
  // h[r][c]: the cut between row r-1 and row r, canonical direction +x
  const h = []
  for (let r = 0; r <= rows; r++) {
    h.push(
      Array.from({ length: cols }, () => (r === 0 || r === rows ? null : makeEdgeParams(rng))),
    )
  }
  // v[c][r]: the cut between col c-1 and col c, canonical direction +y
  const v = []
  for (let c = 0; c <= cols; c++) {
    v.push(
      Array.from({ length: rows }, () => (c === 0 || c === cols ? null : makeEdgeParams(rng))),
    )
  }

  /** Maps edge space onto the segment a -> b (unit-length axis directions). */
  const place = (pts, ax, ay, bx, by, out) => {
    const dx = bx - ax
    const dy = by - ay
    for (const p of pts) {
      // perpendicular is the axis rotated +90 degrees
      out.push(new Vector2(ax + p.x * dx - p.y * dy, ay + p.x * dy + p.y * dx))
    }
  }

  /** Outline of one piece, counter-clockwise, in grid space. */
  const outline = (col, row) => {
    const pts = []
    // bottom: (col, row) -> (col+1, row), canonical
    place(sampleEdge(h[row][col], 1, tab), col, row, col + 1, row, pts)
    // right: (col+1, row) -> (col+1, row+1), canonical
    place(sampleEdge(v[col + 1][row], 1, tab), col + 1, row, col + 1, row + 1, pts)
    // top: walked backwards against the canonical +x
    place(sampleEdge(h[row + 1][col], -1, tab), col + 1, row + 1, col, row + 1, pts)
    // left: walked backwards against the canonical +y
    place(sampleEdge(v[col][row], -1, tab), col, row + 1, col, row, pts)
    return pts
  }

  return { outline, cols, rows }
}
