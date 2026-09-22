import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { AudioEngine } from './audio.js'

// Provides one app-wide AudioEngine plus a `playing` flag the UI re-renders on
// (the play/pause icon + waveform). Default paused — nothing autoplays on launch.
const AudioContext = createContext(null)

export function AudioProvider({ children }) {
  const engineRef = useRef(null)
  if (!engineRef.current) engineRef.current = new AudioEngine()
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const engine = engineRef.current
    engine.init(setPlaying)
    return () => engine.dispose()
  }, [])

  return <AudioContext.Provider value={{ playing, audio: engineRef.current }}>{children}</AudioContext.Provider>
}

export function useAudio() {
  const value = useContext(AudioContext)
  if (!value) throw new Error('useAudio must be used within <AudioProvider>')
  return value
}
