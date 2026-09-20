import { describe, it, expect } from 'vitest'
import { createLocalSaveStore } from './SaveStore.js'

const fakeStorage = () => {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
  }
}

const song = (id) => ({ id, title: `T-${id}`, artist: `A-${id}`, album: 'Al' })

describe('createLocalSaveStore', () => {
  it('adds a song and reports it as saved', () => {
    const store = createLocalSaveStore(fakeStorage())
    store.add(song('a'))
    expect(store.isSaved('a')).toBe(true)
    expect(store.list().map((s) => s.id)).toEqual(['a'])
  })

  it('is idempotent on repeat adds', () => {
    const store = createLocalSaveStore(fakeStorage())
    store.add(song('a'))
    store.add(song('a'))
    expect(store.list()).toHaveLength(1)
  })

  it('toggle adds then removes', () => {
    const store = createLocalSaveStore(fakeStorage())
    store.toggle(song('a'))
    expect(store.isSaved('a')).toBe(true)
    store.toggle(song('a'))
    expect(store.isSaved('a')).toBe(false)
  })

  it('persists across instances backed by the same storage', () => {
    const storage = fakeStorage()
    createLocalSaveStore(storage).add(song('a'))
    const reopened = createLocalSaveStore(storage)
    expect(reopened.isSaved('a')).toBe(true)
  })

  it('notifies subscribers on change', () => {
    const store = createLocalSaveStore(fakeStorage())
    const counts = []
    store.subscribe((items) => counts.push(items.length))
    store.add(song('a'))
    expect(counts).toEqual([0, 1]) // initial emit, then after add
  })
})
