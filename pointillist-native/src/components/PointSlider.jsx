import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native'

const KNOB = 24
const TRACK = 5

/**
 * Label and value sit on their own line above the track, so neither has to
 * compete with the bar for space or legibility.
 *
 * Swap this out by keeping the prop contract:
 *   value / min / max / step / onChange(next) / format(value) -> string
 *
 * Dragging never re-renders the parent: the fill and knob ride an
 * `Animated.Value`, `onChange` writes straight to the render loop's ref, and
 * only the small readout uses state (throttled).
 */
function PointSlider({ label, value, min, max, step = 0.01, onChange, format }) {
  const [readout, setReadout] = useState(() => format(value))
  const width = useRef(0)
  const progress = useRef(new Animated.Value((value - min) / (max - min))).current
  const lastReadout = useRef(0)
  const grabbedAt = useRef(0)

  const emit = useCallback(
    (fraction) => {
      const clamped = Math.min(1, Math.max(0, fraction))
      progress.setValue(clamped)
      const raw = min + clamped * (max - min)
      const next = Math.round(raw / step) * step
      onChange(next)
      const now = Date.now()
      if (now - lastReadout.current > 80) {
        lastReadout.current = now
        setReadout(format(next))
      }
    },
    [format, max, min, onChange, progress, step],
  )

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          // locationX is only trustworthy at touch-down, so anchor there and
          // track the delta — dragging past the track's edge still works.
          grabbedAt.current = e.nativeEvent.locationX
          emit(grabbedAt.current / width.current)
        },
        onPanResponderMove: (e, g) => emit((grabbedAt.current + g.dx) / width.current),
      }),
    [emit],
  )

  const percent = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  return (
    <View style={styles.row}>
      <View style={styles.caption}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.readout}>{readout}</Text>
      </View>

      <View
        style={styles.hit}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width
        }}
        {...pan.panHandlers}
      >
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: percent }]} />
        </View>
        <Animated.View style={[styles.knob, { left: percent, marginLeft: -KNOB / 2 }]} />
      </View>
    </View>
  )
}

export default memo(PointSlider)

const styles = StyleSheet.create({
  row: { paddingVertical: 8 },
  caption: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  label: {
    color: '#fff',
    opacity: 0.5,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  readout: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  // Generous touch target around a thin track.
  hit: { height: KNOB, justifyContent: 'center' },
  track: {
    height: TRACK,
    borderRadius: TRACK,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  fill: { height: TRACK, borderRadius: TRACK, backgroundColor: '#fff' },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
})
