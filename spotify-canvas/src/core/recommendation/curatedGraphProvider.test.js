import { describe, it, expect } from 'vitest'
import { createCuratedProvider } from './curatedGraphProvider.js'

const tag = (genre, era, energy, mood) => ({ genre, era, energy, mood })

// s1's neighbor pool spans genres/eras so diversity has something to chew on.
const catalog = [
  { id: 's1', neighborIds: ['s1', 's2', 's3', 's4', 's5', 's6'], tags: tag('pop', '2010s', 0.5, 'happy') },
  { id: 's2', neighborIds: ['s1'], tags: tag('pop', '2010s', 0.55, 'happy') },
  { id: 's3', neighborIds: ['s1'], tags: tag('rock', '1970s', 0.8, 'defiant') },
  { id: 's4', neighborIds: ['s1'], tags: tag('jazz', '1950s', 0.2, 'calm') },
  { id: 's5', neighborIds: ['s1'], tags: tag('hiphop', '2000s', 0.7, 'cool') },
  { id: 's6', neighborIds: ['s1'], tags: tag('pop', '2010s', 0.52, 'happy') },
]

describe('createCuratedProvider.getSimilar', () => {
  const provider = createCuratedProvider(catalog)

  it('returns songs drawn from the neighbor pool', () => {
    const ids = provider.getSimilar('s1', { count: 3 }).map((s) => s.id)
    expect(ids).toHaveLength(3)
    ids.forEach((id) => expect(['s2', 's3', 's4', 's5', 's6']).toContain(id))
  })

  it('never returns the source song even if its neighbor list includes itself', () => {
    const ids = provider.getSimilar('s1', { count: 6 }).map((s) => s.id)
    expect(ids).not.toContain('s1')
  })

  it('honors excludeSongIds (used to prefer unseen songs)', () => {
    const ids = provider
      .getSimilar('s1', { count: 5, excludeSongIds: ['s2', 's3'] })
      .map((s) => s.id)
      .sort()
    expect(ids).toEqual(['s4', 's5', 's6'])
  })

  it('caps the result at count', () => {
    expect(provider.getSimilar('s1', { count: 2 })).toHaveLength(2)
  })

  it('returns [] for an unknown song id', () => {
    expect(provider.getSimilar('does-not-exist', { count: 5 })).toEqual([])
  })
})
