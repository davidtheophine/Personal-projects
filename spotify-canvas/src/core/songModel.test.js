import { describe, it, expect } from 'vitest'
import { validateCatalog } from './songModel.js'

const base = (over) => ({
  id: 'x',
  title: 'Title',
  artist: 'Artist',
  album: 'Album',
  durationMs: 200000,
  tags: { genre: 'pop', era: '2010s', energy: 0.5, mood: 'happy' },
  neighborIds: [],
  ...over,
})

// A ring of N songs, each pointing at the next 5 — always well-formed.
const ring = (n) =>
  Array.from({ length: n }, (_, i) =>
    base({ id: String(i), neighborIds: [1, 2, 3, 4, 5].map((k) => String((i + k) % n)) }),
  )

const has = (errors, re) => errors.some((e) => re.test(e))

describe('validateCatalog', () => {
  it('returns no errors for a well-formed catalog', () => {
    expect(validateCatalog(ring(10))).toEqual([])
  })

  it('flags duplicate ids', () => {
    const songs = ring(10)
    songs[1].id = '0'
    expect(has(validateCatalog(songs), /duplicate/i)).toBe(true)
  })

  it('flags a neighbor id that does not exist', () => {
    const songs = ring(10)
    songs[0].neighborIds = ['1', '2', '3', '4', 'nope']
    expect(has(validateCatalog(songs), /nope/)).toBe(true)
  })

  it('flags a self-referential neighbor', () => {
    const songs = ring(10)
    songs[0].neighborIds = ['0', '1', '2', '3', '4']
    expect(has(validateCatalog(songs), /self/i)).toBe(true)
  })

  it('flags a missing required field', () => {
    const songs = ring(10)
    delete songs[0].title
    expect(has(validateCatalog(songs), /title/)).toBe(true)
  })

  it('flags fewer than 5 neighbors (a full fan needs 5)', () => {
    const songs = ring(10)
    songs[0].neighborIds = ['1', '2']
    expect(has(validateCatalog(songs), /neighbor/i)).toBe(true)
  })
})
