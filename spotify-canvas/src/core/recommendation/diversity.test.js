import { describe, it, expect } from 'vitest'
import { tagDistance, selectDiverse } from './diversity.js'

const song = (id, tags) => ({ id, tags })

describe('tagDistance', () => {
  it('is 0 for identical tags', () => {
    const t = { genre: 'pop', era: '2010s', energy: 0.5, mood: 'happy' }
    expect(tagDistance(t, t)).toBe(0)
  })

  it('sums each differing categorical facet plus the energy gap', () => {
    const a = { genre: 'pop', era: '2010s', energy: 0.2, mood: 'happy' }
    const b = { genre: 'rock', era: '1970s', energy: 0.9, mood: 'happy' }
    // genre differs (1) + era differs (1) + mood same (0) + |0.2-0.9| (0.7)
    expect(tagDistance(a, b)).toBeCloseTo(2.7)
  })
})

describe('selectDiverse', () => {
  const a = song('a', { genre: 'pop', era: '2010s', energy: 0.5, mood: 'happy' })
  const aClone = song('a2', { genre: 'pop', era: '2010s', energy: 0.55, mood: 'happy' })
  const b = song('b', { genre: 'metal', era: '1980s', energy: 0.95, mood: 'angry' })
  const c = song('c', { genre: 'jazz', era: '1950s', energy: 0.2, mood: 'calm' })

  it('returns every item when count >= length', () => {
    const picked = selectDiverse([a, b], 5)
    expect(picked.map((s) => s.id).sort()).toEqual(['a', 'b'])
  })

  it('keeps the first item as the anchor', () => {
    const picked = selectDiverse([a, aClone, b, c], 3)
    expect(picked[0].id).toBe('a')
  })

  it('skips a near-duplicate in favor of a mutually distant pick', () => {
    // anchor a, then the item maximizing min-distance to {a} is b (0.05 vs 3.45 vs 3.3)
    const picked = selectDiverse([a, aClone, b, c], 2)
    expect(picked.map((s) => s.id)).toEqual(['a', 'b'])
    expect(picked.map((s) => s.id)).not.toContain('a2')
  })

  it('returns [] for count 0 and does not mutate input', () => {
    const input = [a, b, c]
    expect(selectDiverse(input, 0)).toEqual([])
    expect(input).toHaveLength(3)
  })
})
