import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'
import { PREVIEWS } from '../data/previews.generated.js'

// Two-player crossfade engine for the DJ preview. One "sounding" track at a time,
// volume-enveloped with a small fade in/out. Two players let a zoomed cover→cover
// change overlap (crossfade). Clips loop (~30s iTunes previews).
//
// Audio is intentionally sparse: nothing autoplays, browsing is silent, and the
// grid only sounds while a tile is zoomed (long-press). See play()/stop()/toggle().
// Framework-agnostic on purpose (no React) — AudioProvider wraps it for the UI.
const STEP_MS = 30 // volume-ramp granularity
const FADE_IN = 180 // small rise when audio starts (zoom-in / play button)
const FADE_OUT = 150 // small fall when audio stops (lift / pause)

export class AudioEngine {
  constructor() {
    this.players = null // { a, b }
    this.activeKey = 'a' // which player holds the current track
    this.currentIdx = -1 // GENRE_POINTS index of the sounding track
    this.playing = false // now-playing intent (drives play icon + waveform)
    this.onPlaying = null // React setter, registered in init()
    this._fades = new Map() // player -> { timer, target }
    this._initFailed = false // true if the native player couldn't be created
    this._preparedIdx = null // idx currently preloaded (paused) in the idle player
    this._readySubs = new Map() // player -> pending "play once loaded" subscription
  }

  init(onPlaying) {
    this.onPlaying = onPlaying
    this._ensurePlayers()
    // Play with the iOS ringer off; best-effort (don't block the first play on it).
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
  }

  dispose() {
    if (!this.players) return
    for (const k of ['a', 'b']) {
      this._cancelReady(this.players[k])
      this._clearFade(this.players[k])
      try {
        this.players[k].remove()
      } catch {}
    }
    this.players = null
  }

  _ensurePlayers() {
    if (this.players || this._initFailed) return
    try {
      this.players = { a: createAudioPlayer(null), b: createAudioPlayer(null) }
      this.players.a.loop = true
      this.players.b.loop = true
    } catch {
      // degrade to silence rather than crash the app if the player can't be made
      this._initFailed = true
    }
  }

  _active() {
    return this.players?.[this.activeKey]
  }
  _idle() {
    return this.players?.[this.activeKey === 'a' ? 'b' : 'a']
  }

  _setPlaying(v) {
    if (this.playing === v) return
    this.playing = v
    this.onPlaying?.(v)
  }

  _clearFade(player) {
    const f = this._fades.get(player)
    if (f) {
      clearInterval(f.timer)
      this._fades.delete(player)
    }
  }

  // Ramp a player's volume to `target` over `ms`; pause it when it reaches 0.
  _fade(player, target, ms) {
    if (!player) return
    const existing = this._fades.get(player)
    if (existing && existing.target === target) return // already heading there
    this._clearFade(player)
    const start = player.volume ?? 0
    if (ms <= 0 || start === target) {
      this._setVol(player, target)
      if (target === 0) this._safePause(player)
      return
    }
    const steps = Math.max(1, Math.round(ms / STEP_MS))
    let i = 0
    const timer = setInterval(() => {
      i++
      this._setVol(player, start + (target - start) * (i / steps))
      if (i >= steps) {
        this._clearFade(player)
        this._setVol(player, target)
        if (target === 0) this._safePause(player)
      }
    }, STEP_MS)
    this._fades.set(player, { timer, target })
  }

  _setVol(player, v) {
    try {
      player.volume = Math.max(0, Math.min(1, v))
    } catch {}
  }
  _safePause(player) {
    try {
      player.pause()
    } catch {}
  }
  _safe(fn) {
    try {
      fn()
    } catch {}
  }

  // Cancel a pending "play once loaded" wait (e.g. we switched away before it loaded).
  _cancelReady(player) {
    const sub = this._readySubs.get(player)
    if (sub) {
      this._safe(() => sub.remove())
      this._readySubs.delete(player)
    }
  }

  // Play + fade a player, but ONLY once its source is loaded. expo-audio does not
  // reliably start a play() issued before a remote clip has buffered — that was the
  // "long-press expands but no audio; playing it again works" bug. If it isn't loaded
  // yet, we play on the first playbackStatusUpdate that reports isLoaded.
  _startWhenReady(player, fadeMs) {
    if (!player) return
    this._cancelReady(player)
    const start = () => {
      this._safe(() => player.play())
      this._fade(player, 1, fadeMs)
    }
    let loaded = false
    this._safe(() => {
      loaded = player.isLoaded === true
    })
    if (loaded) {
      start()
      return
    }
    this._safe(() => player.play()) // best-effort: also nudges buffering to begin
    let sub = null
    this._safe(() => {
      sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status && status.isLoaded) {
          this._cancelReady(player)
          start()
        }
      })
    })
    if (sub) this._readySubs.set(player, sub)
  }

  // Preload idx into the IDLE player (loaded, paused, silent) so a later play()
  // is instant instead of silent-until-buffered. Called as you browse/hover, and
  // on grid open — the ~300ms long-press hold is plenty of load time.
  prepare(idx) {
    this._ensurePlayers()
    const url = PREVIEWS[idx]
    if (!url || idx === this.currentIdx || idx === this._preparedIdx) return
    const idle = this._idle()
    try {
      idle.replace(url)
      idle.loop = true
      idle.volume = 0
    } catch {}
    this._preparedIdx = idx
  }

  // Make `idx` the sounding track (playing), crossfading from whatever's current.
  _play(idx, fadeMs) {
    this._ensurePlayers()
    this._setPlaying(true)
    const url = PREVIEWS[idx]
    if (!url) {
      // no clip for this cover → just fall silent, but remember the selection
      this._fade(this._active(), 0, FADE_OUT)
      this.currentIdx = idx
      return
    }
    if (idx === this.currentIdx) {
      // same track — restart from the top and rise back up (once loaded)
      const p = this._active()
      this._safe(() => (p.volume = 0))
      this._safe(() => p.seekTo(0))
      this._startWhenReady(p, fadeMs)
      return
    }
    const incoming = this._idle()
    const outgoing = this._active()
    const prev = this.currentIdx
    if (this._preparedIdx !== idx) {
      this._safe(() => incoming.replace(url)) // not preloaded → load now (may lag on first sound)
      this._safe(() => (incoming.loop = true))
    }
    this._safe(() => (incoming.volume = 0))
    this._safe(() => incoming.seekTo(0))
    this._cancelReady(outgoing) // a superseded pending play must not sound later
    this._startWhenReady(incoming, fadeMs) // plays now if loaded, else the moment it loads
    this._fade(outgoing, 0, FADE_OUT)
    this.activeKey = this.activeKey === 'a' ? 'b' : 'a'
    this.currentIdx = idx
    this._preparedIdx = prev // the idle now holds the previous track (still loaded)
  }

  // ---- public intent API (called from the UI) ----
  play(idx) {
    // start (or crossfade to) idx from the top with a small fade-in.
    // Used by zoom-in, by the follow-switch while zoomed, and on close.
    this._play(idx, FADE_IN)
  }
  stop() {
    // fade out + pause (play button off, lift/zoom-out, or entering the grid).
    // Keeps currentIdx so a later play() can restart the same clip.
    this._setPlaying(false)
    this._cancelReady(this._active()) // drop any pending "play once loaded" so lift stays silent
    this._fade(this._active(), 0, FADE_OUT)
  }
  toggle(idx) {
    // expanded now-playing play/pause button
    if (this.playing) this.stop()
    else this.play(idx)
  }
  enterGrid(idx) {
    // opening the picker: silent browse, but preload the centre tile so the first
    // zoom sounds instantly.
    this.stop()
    this.prepare(idx)
  }
}
