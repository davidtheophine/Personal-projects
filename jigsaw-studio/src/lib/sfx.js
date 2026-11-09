// Tiny WebAudio voice per material, so a piece sounds like what it is made of.
// Everything is synthesised - no assets, no loading, and the timbre can follow
// the material picker.

let ctx = null
const ensure = () => {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

const noiseBuffer = (c, seconds = 0.4) => {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}
let noise = null

const tone = (c, { freq, to = freq, type = 'sine', dur = 0.2, gain = 0.2, delay = 0 }) => {
  const t = c.currentTime + delay
  const osc = c.createOscillator()
  const amp = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur)
  amp.gain.setValueAtTime(0, t)
  amp.gain.linearRampToValueAtTime(gain, t + 0.004)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(amp).connect(c.destination)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

const burst = (c, { cutoff = 2000, dur = 0.08, gain = 0.25, q = 1 }) => {
  const t = c.currentTime
  noise ||= noiseBuffer(c)
  const src = c.createBufferSource()
  src.buffer = noise
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = cutoff
  filter.Q.value = q
  const amp = c.createGain()
  amp.gain.setValueAtTime(gain, t)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter).connect(amp).connect(c.destination)
  src.start(t)
  src.stop(t + dur + 0.02)
}

const VOICES = {
  cardboard: (c, hard) => burst(c, { cutoff: 1100, dur: hard ? 0.07 : 0.05, gain: hard ? 0.3 : 0.16, q: 0.8 }),
  wood: (c, hard) => {
    burst(c, { cutoff: 2400, dur: 0.035, gain: hard ? 0.22 : 0.12, q: 1.2 })
    tone(c, { freq: hard ? 320 : 240, to: 180, type: 'triangle', dur: 0.12, gain: hard ? 0.16 : 0.08 })
  },
  jelly: (c, hard) =>
    tone(c, { freq: hard ? 420 : 300, to: 110, type: 'sine', dur: hard ? 0.3 : 0.22, gain: hard ? 0.22 : 0.12 }),
  gummy: (c, hard) => {
    tone(c, { freq: hard ? 340 : 260, to: 130, type: 'sine', dur: 0.22, gain: hard ? 0.2 : 0.1 })
    burst(c, { cutoff: 800, dur: 0.04, gain: 0.08, q: 0.6 })
  },
  metal: (c, hard) => {
    tone(c, { freq: 1180, type: 'sine', dur: hard ? 0.7 : 0.35, gain: hard ? 0.12 : 0.06 })
    tone(c, { freq: 1790, type: 'sine', dur: hard ? 0.5 : 0.25, gain: hard ? 0.07 : 0.035 })
    burst(c, { cutoff: 5200, dur: 0.03, gain: 0.08, q: 2 })
  },
  glass: (c, hard) => {
    tone(c, { freq: 1680, type: 'sine', dur: hard ? 0.9 : 0.4, gain: hard ? 0.1 : 0.05 })
    tone(c, { freq: 2510, type: 'sine', dur: hard ? 0.6 : 0.3, gain: hard ? 0.06 : 0.03, delay: 0.01 })
  },
}

/** @param kind 'snap' lands harder than 'drop'. */
export function playPiece(preset, kind = 'drop', enabled = true) {
  if (!enabled) return
  try {
    const c = ensure()
    ;(VOICES[preset] ?? VOICES.wood)(c, kind === 'snap')
  } catch {
    /* audio is a nicety; never let it break the puzzle */
  }
}

export function playSolved(enabled = true) {
  if (!enabled) return
  try {
    const c = ensure()
    ;[0, 4, 7, 12].forEach((semi, i) =>
      tone(c, { freq: 523.25 * Math.pow(2, semi / 12), type: 'triangle', dur: 0.5, gain: 0.1, delay: i * 0.09 }),
    )
  } catch {
    /* ignore */
  }
}
