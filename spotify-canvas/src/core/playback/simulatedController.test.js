import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createSimulatedController } from './simulatedController.js'

const song = (id, durationMs) => ({ id, durationMs })

describe('simulatedController', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts a song at position 0, playing', () => {
    const c = createSimulatedController()
    c.play(song('a', 10000))
    expect(c.getState()).toMatchObject({ songId: 'a', isPlaying: true, positionMs: 0, isSimulated: true })
  })

  it('advances position as time passes', () => {
    const c = createSimulatedController()
    c.play(song('a', 10000))
    vi.advanceTimersByTime(1000)
    expect(c.getState().positionMs).toBe(1000)
  })

  it('stops advancing while paused and resumes afterward', () => {
    const c = createSimulatedController()
    c.play(song('a', 10000))
    vi.advanceTimersByTime(1000)
    c.pause()
    vi.advanceTimersByTime(1000)
    expect(c.getState().positionMs).toBe(1000)
    c.resume()
    vi.advanceTimersByTime(1000)
    expect(c.getState().positionMs).toBe(2000)
  })

  it('ends exactly at the duration and stops playing', () => {
    const c = createSimulatedController()
    c.play(song('a', 1000))
    vi.advanceTimersByTime(5000)
    expect(c.getState()).toMatchObject({ positionMs: 1000, isPlaying: false, ended: true })
  })

  it('toggle pauses the same song, then resumes it, and switches to a new one', () => {
    const c = createSimulatedController()
    const a = song('a', 10000)
    const b = song('b', 10000)
    c.toggle(a)
    expect(c.getState()).toMatchObject({ songId: 'a', isPlaying: true })
    c.toggle(a)
    expect(c.getState().isPlaying).toBe(false)
    c.toggle(a)
    expect(c.getState().isPlaying).toBe(true)
    c.toggle(b)
    expect(c.getState()).toMatchObject({ songId: 'b', isPlaying: true, positionMs: 0 })
  })

  it('notifies subscribers and stops after unsubscribe', () => {
    const c = createSimulatedController()
    const seen = []
    const unsub = c.subscribe((s) => seen.push(s.positionMs))
    c.play(song('a', 10000))
    vi.advanceTimersByTime(500)
    unsub()
    const countAtUnsub = seen.length
    vi.advanceTimersByTime(1000)
    expect(seen.length).toBe(countAtUnsub)
  })
})
