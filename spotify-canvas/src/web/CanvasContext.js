import { createContext, useContext, useEffect, useState } from 'react'

// Stable handlers + the live controllers are shared with every card through
// context. Playback progress ticks ~4x/second, so cards do NOT read it from
// context (that would re-render the whole canvas); instead each card subscribes
// to the controller for ITS OWN song and bails the update when nothing relevant
// to it changed — only the active card re-renders per tick.

export const CanvasContext = createContext(null)

export function useCanvas() {
  const ctx = useContext(CanvasContext)
  if (!ctx) throw new Error('useCanvas must be used inside <CanvasContext.Provider>')
  return ctx
}

/** Live playback snapshot scoped to one song; re-renders only when it matters. */
export function usePlaybackForSong(controller, songId) {
  const [snap, setSnap] = useState({ isActiveSong: false, isPlaying: false, progress: 0 })
  useEffect(() => {
    return controller.subscribe((s) => {
      const isActiveSong = s.songId === songId
      const next = {
        isActiveSong,
        isPlaying: isActiveSong && s.isPlaying,
        progress: isActiveSong && s.durationMs ? s.positionMs / s.durationMs : 0,
      }
      setSnap((prev) =>
        prev.isActiveSong === next.isActiveSong &&
        prev.isPlaying === next.isPlaying &&
        Math.abs(prev.progress - next.progress) < 0.0015
          ? prev // bail: no visible change for this card
          : next,
      )
    })
  }, [controller, songId])
  return snap
}

/** Whether a given song is in the Liked set; re-renders only on its own change. */
export function useSavedForSong(saveStore, songId) {
  const [saved, setSaved] = useState(() => saveStore.isSaved(songId))
  useEffect(() => {
    return saveStore.subscribe(() => {
      const now = saveStore.isSaved(songId)
      setSaved((prev) => (prev === now ? prev : now))
    })
  }, [saveStore, songId])
  return saved
}
