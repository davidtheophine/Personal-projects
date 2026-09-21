import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

// Generic labelled slider bound to a shared value (read live on the UI thread).
// `round` = change granularity for the label; `format(v)` renders the label text.
const TRACK = 188

export default function Slider({ value, min, max, round = 1, format }) {
  const [val, setVal] = useState(() => value.value)
  useAnimatedReaction(
    () => Math.round(value.value / round) * round,
    (v, p) => {
      if (v !== p) runOnJS(setVal)(v)
    },
  )

  const knobStyle = useAnimatedStyle(() => {
    const t = (Math.min(max, Math.max(min, value.value)) - min) / (max - min)
    return { transform: [{ translateX: t * TRACK }] }
  })
  const fillStyle = useAnimatedStyle(() => {
    const t = (Math.min(max, Math.max(min, value.value)) - min) / (max - min)
    return { width: t * TRACK }
  })

  const set = (e) => {
    'worklet'
    value.value = Math.min(max, Math.max(min, min + (e.x / TRACK) * (max - min)))
  }
  const gesture = Gesture.Race(Gesture.Pan().onBegin(set).onChange(set), Gesture.Tap().onEnd(set))

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{format(val)}</Text>
      <GestureDetector gesture={gesture}>
        <View style={styles.hit}>
          <View style={styles.track}>
            <Animated.View style={[styles.trackFill, fillStyle]} />
          </View>
          <Animated.View style={[styles.knob, knobStyle]} />
        </View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { color: '#fff', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'], width: 62 },
  hit: { width: TRACK, height: 28, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  trackFill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: '#fff' },
  knob: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', marginLeft: -9 },
})
