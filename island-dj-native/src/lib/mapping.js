import { GENRE_POINTS } from '../data/genres.js'

// Nearest sub-genre point to a normalized cursor { x, y } (0..1, y down).
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
