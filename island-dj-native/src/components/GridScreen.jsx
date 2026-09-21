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
import AlbumGrid from './AlbumGrid.jsx'
import { DEFAULT_PARAMS } from '../config.js'

// The grid state: shared genre/artist label + the active picker interaction.
// Which interaction (`mode`) and the album tile size come from the bottom
// ControlPanel (lifted to App).
export default function GridScreen({ genre, cx, cy, clock, onCollapse, onPickGenre, clearance, tilePitch, magnify, mode }) {
  const grow = useSharedValue(0)
  useEffect(() => {
    grow.value = withTiming(1, { duration: 420, easing: Easing.bezier(0.23, 1, 0.32, 1) })
  }, [grow])

  const growStyle = useAnimatedStyle(() => ({
    opacity: grow.value,
    transform: [{ scale: interpolate(grow.value, [0, 1], [0.94, 1]) }],
  }))
  const clearStyle = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(0, clearance.value) }] }))

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* tapping anywhere that isn't the grid closes it */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onCollapse} />

      <Animated.View style={[StyleSheet.absoluteFill, clearStyle]}>
        <Pressable style={styles.label} onPress={onCollapse} hitSlop={6}>
          <Text style={styles.genre} numberOfLines={1}>
            {genre.name}
            <Text style={styles.artist}> like {genre.artist}</Text>
          </Text>
        </Pressable>

        <Animated.View style={[styles.body, mode === 'genre' ? growStyle : null]}>
          {mode === 'albums' ? (
            <AlbumGrid genre={genre} onPickGenre={onPickGenre} pitch={tilePitch} magnify={magnify} />
          ) : (
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
          )}
        </Animated.View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { position: 'absolute', left: 23, top: 20, right: 22 },
  genre: { fontSize: 18, fontWeight: '600', color: '#fefefe', letterSpacing: -0.2 },
  artist: { fontSize: 18, fontWeight: '400', color: '#76767c' },
  body: { position: 'absolute', left: 22, top: 56, width: 343, height: 140 },
})
