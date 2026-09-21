import { useState } from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import SegmentedControl from './SegmentedControl.jsx'
import Slider from './Slider.jsx'

const MODES = [
  { key: 'genre', label: 'Genre' },
  { key: 'albums', label: 'Albums' },
]

// Bottom dev/tuning panel: interaction switch + album tile-size + zoom sliders.
// Collapses to a small handle. Delete once values are baked.
export default function ControlPanel({ mode, onModeChange, pitch, magnify }) {
  const [shown, setShown] = useState(true)

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {shown && (
        <Animated.View style={styles.panel} entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)}>
          <SegmentedControl value={mode} options={MODES} onChange={onModeChange} />
          <Slider value={pitch} min={40} max={84} round={1} format={(v) => `tile ${v}px`} />
          <Slider value={magnify} min={0.1} max={1.2} round={0.02} format={(v) => `zoom ${Math.round(v * 100)}`} />
        </Animated.View>
      )}
      <Pressable style={styles.handle} onPress={() => setShown((s) => !s)} hitSlop={12}>
        <Ionicons name={shown ? 'chevron-down' : 'chevron-up'} size={16} color="rgba(255,255,255,0.85)" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 20, alignItems: 'center' },
  panel: {
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.66)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    marginBottom: 8,
  },
  handle: {
    width: 46,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.66)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
