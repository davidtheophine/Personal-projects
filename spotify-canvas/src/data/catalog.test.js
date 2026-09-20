import { describe, it, expect } from 'vitest'
import { catalog } from './catalog.js'
import { validateCatalog } from '../core/songModel.js'
import { createCuratedProvider } from '../core/recommendation/curatedGraphProvider.js'

describe('catalog', () => {
  it('is internally consistent (no dangling refs, dupes, or thin pools)', () => {
    expect(validateCatalog(catalog)).toEqual([])
  })

  it('has a substantial cross-genre set', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(40)
    const genres = new Set(catalog.map((s) => s.tags.genre))
    expect(genres.size).toBeGreaterThanOrEqual(10)
  })

  it('every song can produce a full fan of 5 from a cold start', () => {
    const provider = createCuratedProvider(catalog)
    for (const song of catalog) {
      expect(provider.getSimilar(song.id, { count: 5 })).toHaveLength(5)
    }
  })
})
