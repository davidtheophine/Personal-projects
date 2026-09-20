// Simulated playback: no audio, just an advancing progress bar so a card *looks*
// like it's playing. Platform-neutral (the Expo port always uses this one, and the
// web build falls back to it whenever real Spotify playback isn't available).

const TICK_MS = 250

/**
 * @returns a controller implementing the shared PlaybackController shape:
 *   play, pause, resume, toggle, seek, stop, getState, subscribe, isSimulated.
 */
export function createSimulatedController() {
  let state = {
    songId: null,
    isPlaying: false,
    positionMs: 0,
    durationMs: 0,
    ended: false,
    isSimulated: true,
  }
  const listeners = new Set()
  let timer = null

  const emit = () => listeners.forEach((l) => l(state))
  const set = (patch) => {
    state = { ...state, ...patch }
    emit()
  }

  const startTimer = () => {
    if (timer) return
    timer = setInterval(() => tick(TICK_MS), TICK_MS)
  }
  const stopTimer = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function tick(delta) {
    if (!state.isPlaying) return
    const next = state.positionMs + delta
    if (next >= state.durationMs) {
      stopTimer()
      set({ positionMs: state.durationMs, isPlaying: false, ended: true })
    } else {
      set({ positionMs: next })
    }
  }

  const play = (song) => {
    set({ songId: song.id, durationMs: song.durationMs, positionMs: 0, isPlaying: true, ended: false })
    startTimer()
  }
  const pause = () => {
    stopTimer()
    set({ isPlaying: false })
  }
  const resume = () => {
    if (!state.songId || state.ended) return
    set({ isPlaying: true })
    startTimer()
  }
  const toggle = (song) => {
    if (state.songId !== song.id) return play(song)
    if (state.isPlaying) return pause()
    if (state.ended) return play(song)
    return resume()
  }
  const seek = (ms) => set({ positionMs: Math.max(0, Math.min(ms, state.durationMs)) })
  const stop = () => {
    stopTimer()
    set({ songId: null, isPlaying: false, positionMs: 0, durationMs: 0, ended: false })
  }

  return {
    play,
    pause,
    resume,
    toggle,
    seek,
    stop,
    tick,
    isSimulated: true,
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn)
      fn(state)
      return () => listeners.delete(fn)
    },
  }
}
