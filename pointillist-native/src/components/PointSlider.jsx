import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native'

const TRACK_DOTS = 22
const DOT = 7

/**
 * Placeholder slider, built out of the same dots the app is about — the track
 * swells left-to-right so the control previews its own effect.
 *
 * Swap it for a bespoke design by keeping this prop contract:
 *   value / min / max / step / onChange(next) / format(value) -> string
 *
 * Dragging never re-renders the parent: the thumb and track run on a native
 * driven Animated value, `onChange` writes straight to the render loop's ref,
 * and only the small readout uses state (throttled).
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
        onPanResponderMove: (e, g) => {
          emit((grabbedAt.current + g.dx) / width.current)
        },
      }),
    [emit],
  )

  const dots = useMemo(() => Array.from({ length: TRACK_DOTS }, (_, i) => i / (TRACK_DOTS - 1)), [])

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={styles.track}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width
        }}
        {...pan.panHandlers}
      >
        {dots.map((t) => (
          <Animated.View
            key={t}
            style={[
              styles.dot,
              {
                opacity: progress.interpolate({
                  inputRange: [t - 0.04, t + 0.04],
                  outputRange: [0.22, 0.95],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    // Dots behind the handle grow with the value, so the track
                    // reads as a size ramp rather than a plain fill.
                    scale: progress.interpolate({
                      inputRange: [t - 0.04, t + 0.04],
                      outputRange: [0.4, 0.4 + t * 1.3],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.readout}>{readout}</Text>
    </View>
  )
}

export default memo(PointSlider)

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 44 },
  label: {
    width: 54,
    color: '#fff',
    opacity: 0.55,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  track: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: '#fff' },
  readout: {
    width: 52,
    textAlign: 'right',
    color: '#fff',
    opacity: 0.85,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
})
