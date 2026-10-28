import { useEffect, useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'
import { GENRE_POINTS } from '../data/genres.js'
import { COVERS } from '../data/covers.generated.js'
import { useAudio } from '../audio/AudioProvider.jsx'

// Infinite (toroidal-wrap) grid of real Spotify covers. Always-on magnify lens:
// the tile under the finger is in focus. Finger down + drag browses (lens follows,
// edge-scrolls, selects) with HAPTICS ONLY — no audio. A long-press zooms ALL tiles
// to 70px AND starts playing the selected cover (small fade); lift → unzoom + stop.
// A center vignette (slider-controlled) fades the corners for an "event" look.
// On open the board reveals radially from the centre.
const W = 343
const H = 140
const GAP = 6
const BOARD_COLS = 12
const BOARD_ROWS = 7
const GC = GENRE_POINTS.length
const FALLBACK = '#3d5a80'
const LINGER = 70 // px tile size while lingering
// zoom in/out spring — snappy but smooth (ζ≈0.81, ω₀≈18 → settles ~250ms, negligible
// overshoot). Stiffer than before so the zoom doesn't feel sluggish.
const ZOOM_SPRING = { mass: 1, stiffness: 340, damping: 30 }
const SWITCH_MS = 120 // brief settle before follow-switching audio to a new tile while zoomed
const PREPARE_MS = 140 // settle before preloading the hovered cover (avoids replace()-thrash)
const MAXDIST = 260 // radial-reveal normalizer
const VIGN_DMAX = Math.sqrt((W / 2) * (W / 2) + (H / 2) * (H / 2)) // centre→corner (~185)

// radial reveal runs only the FIRST time the grid opens this session; reopening
// shows it already loaded (module scope survives AlbumGrid mount/unmount).
let introPlayed = false

// Which cover/genre a board cell shows. A sheared assignment (steps 5 & 17,
// coprime with the count) → NO two adjacent cells (incl. diagonals + torus wrap)
// share a cover, and it stays seamless when the board loops. Worklet + JS-callable.
function genreForCell(bc, br) {
  'worklet'
  return (((bc * 5 + br * 17) % GC) + GC) % GC
}

// pan that centers the current genre's tile under the cursor when the grid opens
function initialPan(genre, P) {
  const idx = Math.max(0, GENRE_POINTS.indexOf(genre))
  let best = null
  let bestD = Infinity
  for (let br = 0; br < BOARD_ROWS; br++) {
    for (let bc = 0; bc < BOARD_COLS; bc++) {
      if (genreForCell(bc, br) === idx) {
        const d = (bc - BOARD_COLS / 2) ** 2 + (br - BOARD_ROWS / 2) ** 2
        if (d < bestD) {
          bestD = d
          best = { bc, br }
        }
      }
    }
  }
  if (!best) best = { bc: Math.floor(BOARD_COLS / 2), br: Math.floor(BOARD_ROWS / 2) }
  return { x: best.bc * P + P / 2 - W / 2, y: best.br * P + P / 2 - H / 2 }
}

function Tile({ bc, br, cover, panX, panY, acx, acy, pitch, magnify, intro, vignette }) {
  const sizeStyle = useAnimatedStyle(() => {
    const t = pitch.value - GAP
    return { width: t, height: t, borderRadius: t * 0.16 }
  })
  const dynStyle = useAnimatedStyle(() => {
    const P = pitch.value
    const boardW = BOARD_COLS * P
    const boardH = BOARD_ROWS * P
    const R = P * 1.35

    let cellX = (bc * P - panX.value) % boardW
    if (cellX < 0) cellX += boardW
    if (cellX > W) cellX -= boardW
    let cellY = (br * P - panY.value) % boardH
    if (cellY < 0) cellY += boardH
    if (cellY > H) cellY -= boardH

    const ccx = cellX + P / 2
    const ccy = cellY + P / 2
    const dx = ccx - acx.value
    const dy = ccy - acy.value
    const e = Math.exp(-(dx * dx + dy * dy) / (R * R)) // 0..1, peak under cursor
    const m = magnify.value

    // radial reveal on open — center (current album) first, outward
    const dc = Math.sqrt((ccx - W / 2) * (ccx - W / 2) + (ccy - H / 2) * (ccy - H / 2))
    const appear = Math.min(1, Math.max(0, (intro.value - dc / MAXDIST) / 0.35))

    // center vignette: fade with distance from the viewport centre (slider-driven
    // strength). Quadratic falloff → broad bright centre, dim corners.
    const nd = Math.min(1, dc / VIGN_DMAX)
    const vf = Math.max(0, 1 - vignette.value * nd * nd)

    return {
      opacity: appear * vf,
      transform: [
        { translateX: cellX + GAP / 2 },
        { translateY: cellY + GAP / 2 - e * m * 24 },
        { scale: (1 + e * m) * (0.6 + 0.4 * appear) },
      ],
      shadowOpacity: 0.4 * e,
      shadowRadius: 3 + e * 9,
      zIndex: Math.round(e * 100),
    }
  })
  return (
    <Animated.View style={[styles.tile, sizeStyle, dynStyle]}>
      {cover ? (
        <Image source={cover} style={styles.img} contentFit="cover" cachePolicy="memory-disk" transition={0} />
      ) : (
        <View style={[styles.img, { backgroundColor: FALLBACK }]} />
      )}
    </Animated.View>
  )
}

export default function AlbumGrid({ genre, onPickGenre, pitch, magnify, vignette }) {
  const { audio } = useAudio()
  const p0 = initialPan(genre, pitch.value)
  const panX = useSharedValue(p0.x)
  const panY = useSharedValue(p0.y)
  const acx = useSharedValue(W / 2)
  const acy = useSharedValue(H / 2)
  const zStartX = useSharedValue(0) // finger pos at zoom-in — gates edge-pan while zoomed
  const zStartY = useSharedValue(0)
  const zMoved = useSharedValue(0) // latches once the finger deliberately moves after a zoom
  const active = useSharedValue(false)
  const zoomed = useSharedValue(0)
  const basePitch = useSharedValue(pitch.value)
  const intro = useSharedValue(introPlayed ? 1.35 : 0)
  const lastIdx = useSharedValue(Math.max(0, GENRE_POINTS.indexOf(genre)))
  const latestIdx = useRef(Math.max(0, GENRE_POINTS.indexOf(genre))) // committed cell (JS)
  const zoomedJS = useRef(false) // JS mirror of the zoom state (gates follow-audio)
  const switchTimer = useRef(null) // debounce for follow-switching audio while zoomed
  const prepareTimer = useRef(null) // debounce for preloading the hovered cover
  const pickedIdx = useRef(null) // last tile zoomed this session (null = never zoomed)

  // radial reveal — only on the first open of the session
  useEffect(() => {
    if (!introPlayed) {
      intro.value = withTiming(1.35, { duration: 700 })
      introPlayed = true
    }
  }, [intro])

  // Audio is gated on ZOOM (zoomed = the "play" state). Opening the picker is silent
  // (browse = haptics only) but preloads the hovered cover. Long-press plays it; moving
  // while zoomed crossfades to the tile under the finger; lift pauses. On CLOSE the
  // last-zoomed song plays from the start and becomes the now-playing selection.
  useEffect(() => {
    audio.enterGrid(latestIdx.current)
    return () => {
      clearTimeout(switchTimer.current)
      clearTimeout(prepareTimer.current)
      if (pickedIdx.current != null) {
        onPickGenre(GENRE_POINTS[pickedIdx.current])
        audio.play(pickedIdx.current)
      }
    }
  }, [audio])

  // long-press zoom-in → play the cover under the finger (preloaded → instant)
  const onZoomIn = () => {
    zoomedJS.current = true
    pickedIdx.current = latestIdx.current
    audio.play(latestIdx.current)
  }
  // lift / zoom-out → pause (the pick is whatever the finger was over on release)
  const onZoomOut = () => {
    zoomedJS.current = false
    clearTimeout(switchTimer.current)
    pickedIdx.current = latestIdx.current
    audio.stop()
  }

  const commit = (idx) => {
    latestIdx.current = idx
    onPickGenre(GENRE_POINTS[idx])
    Haptics.selectionAsync()
    // Preload after a brief SETTLE, not on every cell. Preloading on every crossed
    // cell fired back-to-back replace() calls that thrashed the idle player's loader,
    // leaving the next long-press unable to load/play. Debounce = one preload per pause.
    clearTimeout(prepareTimer.current)
    prepareTimer.current = setTimeout(() => audio.prepare(latestIdx.current), PREPARE_MS)
    if (zoomedJS.current) {
      // zoomed = play state → follow the finger: settle briefly so the clip loads,
      // then crossfade to it (avoids the buffering glitch on an instant switch).
      clearTimeout(switchTimer.current)
      switchTimer.current = setTimeout(() => {
        pickedIdx.current = idx
        audio.play(idx)
      }, SWITCH_MS)
    }
  }
  const selectAt = (x, y) => {
    'worklet'
    // while zooming in, the board is still animating to centre — hold the pick until it settles
    if (zoomed.value === 1 && Math.abs(pitch.value - LINGER) > 2) return
    const P = pitch.value
    const bc = ((Math.floor((x + panX.value) / P) % BOARD_COLS) + BOARD_COLS) % BOARD_COLS
    const br = ((Math.floor((y + panY.value) / P) % BOARD_ROWS) + BOARD_ROWS) % BOARD_ROWS
    const idx = genreForCell(bc, br)
    if (idx !== lastIdx.value) {
      lastIdx.value = idx
      runOnJS(commit)(idx)
    }
  }
  const set = (e) => {
    'worklet'
    // lens follows the finger absolutely (zoomed or not) so you can move around the
    // grid while zoomed and the audio follows the tile under your finger.
    acx.value = Math.min(W, Math.max(0, e.x))
    acy.value = Math.min(H, Math.max(0, e.y))
    // once the finger deliberately moves after a zoom, unlock edge-pan (frame cb below)
    if (zoomed.value === 1 && (Math.abs(acx.value - zStartX.value) > 18 || Math.abs(acy.value - zStartY.value) > 18)) {
      zMoved.value = 1
    }
  }

  useFrameCallback((f) => {
    if (!active.value) return
    // while zoomed, only edge-pan once the zoom has SETTLED and the finger has MOVED —
    // so a fresh (esp. corner) zoom holds its anchor tile instead of auto-panning it away.
    if (zoomed.value === 1 && (Math.abs(pitch.value - LINGER) > 2 || zMoved.value === 0)) return
    const dt = Math.min(0.05, (f.timeSincePreviousFrame ?? 16) / 1000)
    const speed = 300
    const m = 38
    const x = acx.value
    const y = acy.value
    let moved = false
    if (x < m) {
      panX.value -= speed * dt * (1 - x / m)
      moved = true
    } else if (x > W - m) {
      panX.value += speed * dt * (1 - (W - x) / m)
      moved = true
    }
    if (y < m) {
      panY.value -= speed * dt * (1 - y / m)
      moved = true
    } else if (y > H - m) {
      panY.value += speed * dt * (1 - (H - y) / m)
      moved = true
    }
    if (moved) selectAt(x, y)
  })

  const pan = Gesture.Pan()
    .onBegin((e) => {
      'worklet'
      active.value = true
      set(e)
      selectAt(e.x, e.y)
    })
    .onChange((e) => {
      'worklet'
      set(e)
      selectAt(e.x, e.y)
    })
    .onFinalize(() => {
      'worklet'
      active.value = false
      if (zoomed.value === 1) {
        const p = pitch.value
        const t = basePitch.value
        panX.value = withSpring(((acx.value + panX.value) * t) / p - acx.value, ZOOM_SPRING)
        panY.value = withSpring(((acy.value + panY.value) * t) / p - acy.value, ZOOM_SPRING)
        pitch.value = withSpring(t, ZOOM_SPRING)
        zoomed.value = 0
        runOnJS(onZoomOut)() // lift → pause audio
      }
    })
  const tap = Gesture.Tap().onEnd((e) => {
    'worklet'
    set(e)
    selectAt(e.x, e.y)
  })
  const linger = Gesture.LongPress()
    .minDuration(300)
    .maxDistance(14)
    .onStart(() => {
      'worklet'
      if (zoomed.value === 1) return
      const p = pitch.value
      basePitch.value = p
      zoomed.value = 1
      zStartX.value = acx.value // anchor the edge-pan gate to the finger's zoom-in point
      zStartY.value = acy.value
      zMoved.value = 0
      // zoom AROUND the finger: the tile under it is the scale anchor and stays put
      // in the same spot while the whole grid grows around it (no slide to centre).
      // (Edge-scroll is off while zoomed so an edge tile can't slip to a neighbour.)
      panX.value = withSpring(((acx.value + panX.value) * LINGER) / p - acx.value, ZOOM_SPRING)
      panY.value = withSpring(((acy.value + panY.value) * LINGER) / p - acy.value, ZOOM_SPRING)
      pitch.value = withSpring(LINGER, ZOOM_SPRING)
      runOnJS(onZoomIn)() // zoom-in → play the tile under the finger (fade in)
    })

  const gesture = Gesture.Simultaneous(pan, linger, tap)

  const tiles = []
  for (let br = 0; br < BOARD_ROWS; br++) {
    for (let bc = 0; bc < BOARD_COLS; bc++) {
      tiles.push(
        <Tile
          key={`${bc}-${br}`}
          bc={bc}
          br={br}
          cover={COVERS[genreForCell(bc, br)]}
          panX={panX}
          panY={panY}
          acx={acx}
          acy={acy}
          pitch={pitch}
          magnify={magnify}
          intro={intro}
          vignette={vignette}
        />,
      )
    }
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.area}>{tiles}</View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  area: { width: W, height: H, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0b0f0d' },
  tile: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
  },
  img: { width: '100%', height: '100%' },
})
