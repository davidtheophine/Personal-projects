import { useEffect, useState } from 'react'
import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Waveform from './Waveform.jsx'
import GenreField from './GenreField.jsx'
import { coverFor } from '../assets.js'
import { TILE_PARAMS } from '../config.js'

const ICON = 'rgba(255,255,255,0.92)'
const DURATION = 249 // seconds (matches the design's 1:12 / -2:57)

function fmt(s) {
  s = Math.max(0, Math.floor(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function ExpandedContent({ genre, cx, cy, clock, onOpenGrid, clearance }) {
  // ---- simulated player (no audio) ----
  const [playing, setPlaying] = useState(true)
  const playingSV = useSharedValue(true)
  useEffect(() => {
    playingSV.value = playing
  }, [playing, playingSV])

  const progress = useSharedValue(72 / DURATION) // start at 1:12
  const scrubbing = useSharedValue(false)
  const trackW = useSharedValue(1)

  // advance the playhead on the UI thread; loop at the end
  useFrameCallback((f) => {
    'worklet'
    if (!playingSV.value || scrubbing.value) return
    const dt = (f.timeSincePreviousFrame ?? 0) / 1000
    let np = progress.value + dt / DURATION
    if (np >= 1) np = 0
    progress.value = np
  })

  // push the second-resolution time to JS only when it changes (1/sec, not per frame)
  const [elapsed, setElapsed] = useState(72)
  useAnimatedReaction(
    () => Math.floor(progress.value * DURATION),
    (sec, prev) => {
      if (sec !== prev) runOnJS(setElapsed)(sec)
    },
  )

  const fillStyle = useAnimatedStyle(() => ({ width: progress.value * trackW.value }))
  const clearStyle = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(0, clearance.value) }] }))

  const scrub = Gesture.Pan()
    .onBegin((e) => {
      'worklet'
      scrubbing.value = true
      progress.value = Math.min(1, Math.max(0, e.x / trackW.value))
    })
    .onChange((e) => {
      'worklet'
      progress.value = Math.min(1, Math.max(0, e.x / trackW.value))
    })
    .onFinalize(() => {
      'worklet'
      scrubbing.value = false
    })
  // tap-to-seek; also claims the touch so a tap on the bar doesn't dismiss the island
  const seek = Gesture.Tap().onEnd((e) => {
    'worklet'
    progress.value = Math.min(1, Math.max(0, e.x / trackW.value))
  })
  const scrubGesture = Gesture.Race(scrub, seek)

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* clearance: everything sits below the camera / hardware Dynamic Island (live) */}
      <Animated.View style={[StyleSheet.absoluteFill, clearStyle]}>
        <Image source={coverFor(genre)} style={styles.art} />

        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            {genre.song}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {genre.artist}
          </Text>
        </View>

        <View style={styles.wave} pointerEvents="none">
          <Waveform clock={clock} playing={playingSV} />
        </View>

        <View style={styles.scrubber}>
          <Text style={styles.time}>{fmt(elapsed)}</Text>
          <GestureDetector gesture={scrubGesture}>
            <View style={styles.trackHit}>
              <View
                style={styles.track}
                onLayout={(e) => {
                  trackW.value = e.nativeEvent.layout.width
                }}
              >
                <Animated.View style={[styles.fill, fillStyle]} />
              </View>
            </View>
          </GestureDetector>
          <Text style={[styles.time, styles.timeRight]}>-{fmt(DURATION - elapsed)}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable style={styles.tile} onPress={onOpenGrid}>
            <GenreField
              width={40}
              height={40}
              cx={cx}
              cy={cy}
              clock={clock}
              params={TILE_PARAMS}
              interactive={false}
              reticleSize={12}
              showAxes
              borderRadius={6}
            />
          </Pressable>

          <View style={styles.transport}>
            <Pressable hitSlop={12}>
              <Ionicons name="play-back" size={30} color={ICON} />
            </Pressable>
            <Pressable hitSlop={12} onPress={() => setPlaying((p) => !p)}>
              <Ionicons name={playing ? 'pause' : 'play'} size={42} color={ICON} />
            </Pressable>
            <Pressable hitSlop={12}>
              <Ionicons name="play-forward" size={30} color={ICON} />
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  art: { position: 'absolute', left: 18, top: 16, width: 76, height: 76, borderRadius: 17 },
  meta: { position: 'absolute', left: 104, top: 16, right: 70, height: 76, justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '600', color: '#fff', letterSpacing: -0.2 },
  artist: { fontSize: 16, color: 'rgba(255,255,255,0.56)', marginTop: 3 },
  wave: { position: 'absolute', right: 20, top: 37 },
  scrubber: { position: 'absolute', left: 22, right: 22, top: 116, flexDirection: 'row', alignItems: 'center' },
  time: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)', minWidth: 32 },
  timeRight: { textAlign: 'right' },
  trackHit: { flex: 1, marginHorizontal: 8, justifyContent: 'center', paddingVertical: 12 },
  track: { height: 5, borderRadius: 3, backgroundColor: '#38383a', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: '#9a9a9f' },
  controls: { position: 'absolute', left: 22, right: 22, top: 152, height: 44 },
  tile: { position: 'absolute', left: 0, top: 2, width: 40, height: 40, borderRadius: 6, overflow: 'hidden' },
  transport: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 30,
  },
})
