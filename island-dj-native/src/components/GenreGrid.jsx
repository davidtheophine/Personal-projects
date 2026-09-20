import { useEffect } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import GenreField from './GenreField.jsx'
import { DEFAULT_PARAMS } from '../config.js'

export default function GenreGrid({ genre, cx, cy, clock, onCollapse, clearance }) {
  // expand-in (ease-out) when the grid opens
  const grow = useSharedValue(0)
  useEffect(() => {
    grow.value = withTiming(1, { duration: 420, easing: Easing.bezier(0.23, 1, 0.32, 1) })
  }, [grow])

  const growStyle = useAnimatedStyle(() => ({
    opacity: grow.value,
    transform: [{ scale: interpolate(grow.value, [0, 1], [0.92, 1]) }],
  }))
  const clearStyle = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(0, clearance.value) }] }))

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* tapping anywhere on the island that isn't the plane closes it */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onCollapse} />

      <Animated.View style={[StyleSheet.absoluteFill, clearStyle]}>
        <Pressable style={styles.label} onPress={onCollapse} hitSlop={6}>
          <Text style={styles.genre}>{genre.name}</Text>
          <Text style={styles.artist}> like {genre.artist}</Text>
        </Pressable>

        <Animated.View style={[styles.planeWrap, growStyle]}>
          <GenreField
            width={343}
            height={140}
            cx={cx}
            cy={cy}
            clock={clock}
            params={DEFAULT_PARAMS}
            interactive
            reticleSize={29}
            showAxes
            borderRadius={24}
          />
        </Animated.View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    left: 23,
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  genre: { fontSize: 18, fontWeight: '600', color: '#fefefe', letterSpacing: -0.2 },
  artist: { fontSize: 18, fontWeight: '400', color: '#76767c' },
  planeWrap: { position: 'absolute', left: 22, top: 56, width: 343, height: 140 },
})
