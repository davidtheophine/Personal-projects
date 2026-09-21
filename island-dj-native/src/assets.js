// Bundled image assets + per-genre cover resolution.
import { GENRE_POINTS } from './data/genres.js'
import { COVERS } from './data/covers.generated.js'

export const HOME = require('../assets/home.png')
export const ALBUM = require('../assets/album.png')
export const GRID_ICON = require('../assets/grid-icon.png') // opens the picker grid

// Real Spotify cover for a genre point (by its index), falling back to the
// bundled default if it wasn't fetched. `genre` is always a GENRE_POINTS element.
export function coverFor(genre) {
  const i = GENRE_POINTS.indexOf(genre)
  return (i >= 0 && COVERS[i]) || ALBUM
}
