import { useEffect } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

const SEG_W = 66

// Small iOS-style 2+ segment switcher with a sliding indicator (UI-thread).
export default function SegmentedControl({ value, options, onChange }) {
  const idx = Math.max(0, options.findIndex((o) => o.key === value))
  const pos = useSharedValue(idx)
  useEffect(() => {
    pos.value = withTiming(idx, { duration: 220, easing: Easing.bezier(0.23, 1, 0.32, 1) })
  }, [idx, pos])

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value * SEG_W + 3 }] }))

  return (
    <View style={[styles.wrap, { width: SEG_W * options.length }]}>
      <Animated.View style={[styles.indicator, { width: SEG_W - 6 }, indicator]} />
      {options.map((o) => (
        <Pressable key={o.key} style={[styles.seg, { width: SEG_W }]} onPress={() => onChange(o.key)} hitSlop={6}>
          <Text style={[styles.label, value === o.key && styles.labelActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { height: 28, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.12)', flexDirection: 'row' },
  indicator: { position: 'absolute', top: 3, height: 22, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.92)' },
  seg: { height: 28, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)', letterSpacing: -0.1 },
  labelActive: { color: '#111' },
})
