import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'
import { GENRE_POINTS } from '../data/genres.js'
import { COVERS } from '../data/covers.generated.js'

// Infinite (toroidal-wrap) grid of real Spotify covers. Always-on magnify lens:
// the tile under the finger is in focus (starts on the currently-playing album).
// Finger down + drag browses (lens follows, edge-scrolls, selects); a tap selects.
// Lingering still bumps ALL tiles to 70px (zoomed toward the finger); lift → base.
// On open the board reveals radially from the centre (the playing album).
const W = 343
const H = 140
const GAP = 6
const BOARD_COLS = 12
const BOARD_ROWS = 7
const GC = GENRE_POINTS.length
const FALLBACK = '#3d5a80'
const LINGER = 70 // px tile size while lingering
const ZMS = 190 // linger zoom animation
const MAXDIST = 260 // radial-reveal normalizer

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

function Tile({ bc, br, cover, panX, panY, acx, acy, pitch, magnify, intro }) {
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

    return {
      opacity: appear,
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

export default function AlbumGrid({ genre, onPickGenre, pitch, magnify }) {
  const p0 = initialPan(genre, pitch.value)
  const panX = useSharedValue(p0.x)
  const panY = useSharedValue(p0.y)
  const acx = useSharedValue(W / 2)
  const acy = useSharedValue(H / 2)
  const active = useSharedValue(false)
  const zoomed = useSharedValue(0)
  const basePitch = useSharedValue(pitch.value)
  const intro = useSharedValue(introPlayed ? 1.35 : 0)
  const lastIdx = useSharedValue(Math.max(0, GENRE_POINTS.indexOf(genre)))

  // radial reveal — only on the first open of the session
  useEffect(() => {
    if (!introPlayed) {
      intro.value = withTiming(1.35, { duration: 700 })
      introPlayed = true
    }
  }, [intro])

  const commit = (idx) => {
    onPickGenre(GENRE_POINTS[idx])
    Haptics.selectionAsync()
  }
  const selectAt = (x, y) => {
    'worklet'
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
    acx.value = Math.min(W, Math.max(0, e.x))
    acy.value = Math.min(H, Math.max(0, e.y))
  }

  useFrameCallback((f) => {
    if (!active.value) return
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
        panX.value = withTiming(((acx.value + panX.value) * t) / p - acx.value, { duration: ZMS })
        panY.value = withTiming(((acy.value + panY.value) * t) / p - acy.value, { duration: ZMS })
        pitch.value = withTiming(t, { duration: ZMS })
        zoomed.value = 0
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
      panX.value = withTiming(((acx.value + panX.value) * LINGER) / p - acx.value, { duration: ZMS })
      panY.value = withTiming(((acy.value + panY.value) * LINGER) / p - acy.value, { duration: ZMS })
      pitch.value = withTiming(LINGER, { duration: ZMS })
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
