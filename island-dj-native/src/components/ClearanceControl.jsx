import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

// On-device tuning slider for the island's top clearance (there's no DialKit in
// native). Drag/tap the track; read the px value and tell me what to bake, then
// this whole component can be deleted.
const TRACK = 200
const MIN = 0
const MAX = 96

export default function ClearanceControl({ value }) {
  const [txt, setTxt] = useState(() => Math.round(value.value))
  useAnimatedReaction(
    () => Math.round(value.value),
    (v, p) => {
      if (v !== p) runOnJS(setTxt)(v)
    },
  )

  const knobStyle = useAnimatedStyle(() => {
    const t = (Math.min(MAX, Math.max(MIN, value.value)) - MIN) / (MAX - MIN)
    return { transform: [{ translateX: t * TRACK }] }
  })
  const fillStyle = useAnimatedStyle(() => {
    const t = (Math.min(MAX, Math.max(MIN, value.value)) - MIN) / (MAX - MIN)
    return { width: t * TRACK }
  })

  const set = (e) => {
    'worklet'
    value.value = Math.min(MAX, Math.max(MIN, MIN + (e.x / TRACK) * (MAX - MIN)))
  }
  const gesture = Gesture.Race(Gesture.Pan().onBegin(set).onChange(set), Gesture.Tap().onEnd(set))

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.panel}>
        <Text style={styles.label}>top space {txt}px</Text>
        <GestureDetector gesture={gesture}>
          <View style={styles.hit}>
            <View style={styles.track}>
              <Animated.View style={[styles.trackFill, fillStyle]} />
            </View>
            <Animated.View style={[styles.knob, knobStyle]} />
          </View>
        </GestureDetector>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 26, alignItems: 'center' },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  label: { color: '#fff', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'], width: 96 },
  hit: { width: TRACK, height: 28, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  trackFill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: '#fff' },
  knob: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', marginLeft: -9 },
})
