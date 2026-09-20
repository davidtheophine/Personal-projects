// Album art resolver. We can't fetch Spotify catalog art (restricted API), so we
// look it up from the free, no-auth iTunes Search API and cache it. Every failure
// path is graceful — the card falls back to a generated gradient cover, so the
// demo never shows a broken image.

const memory = new Map()

/**
 * @param {{id:string, title:string, artist:string, artworkUrl?:string}} song
 * @returns {Promise<string|null>} an image URL, or null to signal "use the gradient"
 */
export async function resolveArtwork(song) {
  if (song.artworkUrl) return song.artworkUrl
  if (memory.has(song.id)) return memory.get(song.id)

  const cacheKey = `spotify-canvas:art:${song.id}`
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      memory.set(song.id, cached)
      return cached
    }
  } catch {
    /* storage unavailable — ignore */
  }

  try {
    const term = encodeURIComponent(`${song.artist} ${song.title}`)
    const res = await fetch(
      `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=1`,
    )
    const data = await res.json()
    const raw = data?.results?.[0]?.artworkUrl100
    const url = raw ? raw.replace('100x100bb', '600x600bb') : null
    if (url) {
      memory.set(song.id, url)
      try {
        localStorage.setItem(cacheKey, url)
      } catch {
        /* ignore */
      }
      return url
    }
  } catch {
    /* network/CORS failure — fall through to gradient */
  }
  return null
}

/** Deterministic gradient cover derived from the song id (stable per song). */
export function gradientFor(song) {
  let h = 0
  for (const ch of song.id) h = (h * 31 + ch.charCodeAt(0)) % 360
  const h2 = (h + 45) % 360
  return `linear-gradient(140deg, hsl(${h} 58% 32%), hsl(${h2} 62% 16%))`
}
