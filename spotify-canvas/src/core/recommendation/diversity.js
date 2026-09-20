// Diversity helpers — the core of "similar to the seed, yet different from each other."
// Pure and platform-neutral (reused verbatim by the Expo port).

/**
 * Distance between two tag objects. Categorical facets (genre/era/mood) each add
 * 1 when they differ; energy adds its absolute gap (0..1). Higher = more different.
 * @param {{genre:string, era:string, energy:number, mood:string}} a
 * @param {{genre:string, era:string, energy:number, mood:string}} b
 * @returns {number}
 */
export function tagDistance(a, b) {
  let d = 0
  if (a.genre !== b.genre) d += 1
  if (a.era !== b.era) d += 1
  if (a.mood !== b.mood) d += 1
  d += Math.abs((a.energy ?? 0) - (b.energy ?? 0))
  return d
}

/**
 * Greedily pick `count` songs that are as mutually different as possible.
 * The first item is kept as the anchor (the strongest "similar" match by pool
 * order); each subsequent pick maximizes its minimum tag-distance to the
 * already-selected set, so the result spreads across genres/eras/moods.
 * Deterministic. Does not mutate the input.
 * @param {Array<{tags:object}>} songs
 * @param {number} count
 * @returns {Array<{tags:object}>}
 */
export function selectDiverse(songs, count) {
  if (count <= 0) return []
  if (count >= songs.length) return [...songs]

  const selected = [songs[0]]
  const remaining = songs.slice(1)

  while (selected.length < count && remaining.length > 0) {
    let bestIndex = 0
    let bestScore = -Infinity
    for (let i = 0; i < remaining.length; i++) {
      const minDistToSelected = Math.min(
        ...selected.map((s) => tagDistance(remaining[i].tags, s.tags)),
      )
      if (minDistToSelected > bestScore) {
        bestScore = minDistToSelected
        bestIndex = i
      }
    }
    selected.push(remaining[bestIndex])
    remaining.splice(bestIndex, 1)
  }

  return selected
}
