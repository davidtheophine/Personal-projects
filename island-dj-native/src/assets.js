// Bundled image assets + per-artist cover resolution.
export const HOME = require('../assets/home.png')
export const ALBUM = require('../assets/album.png')

const COVERS = {
  'aphex-twin': require('../assets/aphex-twin.png'),
}

// Album art for a genre point (falls back to the default cover).
export function coverFor(genre) {
  return (genre && genre.cover && COVERS[genre.cover]) || ALBUM
}
