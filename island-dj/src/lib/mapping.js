// Pure genre-mapping logic. Platform-neutral + testable.
import { GENRE_POINTS } from '../data/genres.js'

// Nearest sub-genre point to a normalized cursor { x, y } (0..1, y down).
// As the cursor moves, this returns finer/nicher sub-genres toward the corners
// and different artists within a quadrant.
export function genreAt(cursor, points = GENRE_POINTS) {
  let best = points[0]
  let bestD = Infinity
  for (const p of points) {
    const dx = p.x - cursor.x
    const dy = p.y - cursor.y
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}
