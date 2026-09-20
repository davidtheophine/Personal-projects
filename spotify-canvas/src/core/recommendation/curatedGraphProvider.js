import { selectDiverse } from './diversity.js'

/**
 * The only RecommendationProvider implementation for the POC: it reads a song's
 * hand-authored `neighborIds` pool and returns a mutually-diverse subset.
 * A future hosted version can drop in a real provider (Last.fm / ListenBrainz)
 * behind this same { getSimilar } shape.
 *
 * @param {Array<{id:string, neighborIds:string[], tags:object}>} songs
 */
export function createCuratedProvider(songs) {
  const byId = new Map(songs.map((s) => [s.id, s]))

  /**
   * @param {string} fromSongId
   * @param {{count?:number, excludeSongIds?:string[]}} [opts]
   * @returns {Array<object>} up to `count` similar-yet-mutually-different songs
   */
  function getSimilar(fromSongId, { count = 5, excludeSongIds = [] } = {}) {
    const source = byId.get(fromSongId)
    if (!source) return []

    const exclude = new Set([fromSongId, ...excludeSongIds])
    const seen = new Set()
    const pool = []
    for (const id of source.neighborIds || []) {
      if (exclude.has(id) || seen.has(id)) continue
      const song = byId.get(id)
      if (!song) continue
      seen.add(id)
      pool.push(song)
    }

    return selectDiverse(pool, count)
  }

  return { getSimilar }
}
