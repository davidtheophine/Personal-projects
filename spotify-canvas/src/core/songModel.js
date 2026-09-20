// The Song shape + a catalog integrity check. Platform-neutral.
//
/** @typedef {Object} Song
 *  @property {string} id            internal id (NOT a Spotify id), e.g. "billie-jean"
 *  @property {string} title
 *  @property {string} artist
 *  @property {string} album
 *  @property {number} durationMs    drives the (real or simulated) progress bar
 *  @property {string} [artworkUrl]  optional hard override; otherwise resolved at runtime
 *  @property {string} [spotifyUri]  optional; enables real full-track playback when present
 *  @property {{genre:string, era:string, energy:number, mood:string}} tags  diversity metadata
 *  @property {string[]} neighborIds ordered pool of similar-yet-different song ids
 */

const REQUIRED = ['id', 'title', 'artist', 'album', 'durationMs']
const MIN_NEIGHBORS = 5

/**
 * Validate a hand-authored catalog. Returns a list of human-readable problems
 * (empty array = valid). Catches the authoring mistakes that would break
 * expansion: dangling neighbor refs, self-links, dupes, thin neighbor pools.
 * @param {Song[]} songs
 * @returns {string[]}
 */
export function validateCatalog(songs) {
  const errors = []
  const ids = new Set()

  for (const s of songs) {
    for (const f of REQUIRED) {
      if (s[f] === undefined || s[f] === null || s[f] === '') {
        errors.push(`song ${s.id ?? '?'}: missing ${f}`)
      }
    }
    if (
      !s.tags ||
      !s.tags.genre ||
      !s.tags.era ||
      !s.tags.mood ||
      typeof s.tags.energy !== 'number'
    ) {
      errors.push(`song ${s.id ?? '?'}: invalid tags (need genre/era/mood/energy)`)
    }
    if (ids.has(s.id)) errors.push(`duplicate id ${s.id}`)
    else ids.add(s.id)
  }

  for (const s of songs) {
    const neighbors = s.neighborIds || []
    if (neighbors.length < MIN_NEIGHBORS) {
      errors.push(`song ${s.id}: has ${neighbors.length} neighbors (need at least ${MIN_NEIGHBORS})`)
    }
    if (neighbors.includes(s.id)) errors.push(`song ${s.id}: self-referential neighbor`)
    for (const nid of neighbors) {
      if (!ids.has(nid)) errors.push(`song ${s.id}: neighbor ${nid} not found`)
    }
  }

  return errors
}
