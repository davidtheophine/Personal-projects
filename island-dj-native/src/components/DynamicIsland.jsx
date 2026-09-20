import { useEffect, useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler'
import CompactContent from './CompactContent.jsx'
import ExpandedContent from './ExpandedContent.jsx'
import GenreGrid from './GenreGrid.jsx'

// compact vs open dims (expanded & grid share the open size). The open height is
// derived live from `clearance` so the tuning slider can grow/shrink it in place.
const COMPACT = { left: 88, top: 16, width: 210, height: 40, radius: 20 }
const OPEN = { left: 7.5, top: 6, width: 387, radius: 48 } // height = 218 + clearance

// Apple's Dynamic Island morph is SwiftUI `.snappy`: a hair of overshoot, not a
// bounce. dampingRatio 0.82 ≈ dampingFraction 0.85; the whole morph is one spring.
const SPRING = { duration: 450, dampingRatio: 0.82 }

export default function DynamicIsland({ cx, cy, clock, genre, clearance }) {
  const [state, setState] = useState('compact')
  const reduce = useReducedMotion()
  const open = useSharedValue(0) // 0 = compact, 1 = expanded/grid

  useEffect(() => {
    const target = state === 'compact' ? 0 : 1
    open.value = reduce ? withTiming(target, { duration: 160 }) : withSpring(target, SPRING)
  }, [state, reduce, open])

  const containerStyle = useAnimatedStyle(() => {
    const t = open.value // spring-driven; may briefly over/undershoot [0,1]
    const openH = 218 + Math.max(0, clearance.value)
    const mix = (a, b) => a + t * (b - a)
    return {
      left: mix(COMPACT.left, OPEN.left),
      top: mix(COMPACT.top, OPEN.top),
      width: mix(COMPACT.width, OPEN.width),
      height: mix(COMPACT.height, openH),
      borderRadius: mix(COMPACT.radius, OPEN.radius),
    }
  })

  const close = () => setState('compact')

  // swipe up on the now-playing island → minimize (expanded only, so it can't race
  // an upward pick-drag on the grid plane)
  const flingUp = Gesture.Fling()
    .direction(Directions.UP)
    .enabled(state === 'expanded')
    .onStart(() => {
      'worklet'
      runOnJS(close)()
    })

  return (
    <>
      {state !== 'compact' && <Pressable style={styles.backdrop} onPress={close} />}

      <GestureDetector gesture={flingUp}>
        <Animated.View style={[styles.island, containerStyle]}>
          {state === 'compact' && (
            <Animated.View style={StyleSheet.absoluteFill} entering={FadeIn.duration(140)} exiting={FadeOut.duration(90)}>
              <Pressable style={styles.fill} onPress={() => setState('expanded')}>
                <CompactContent genre={genre} />
              </Pressable>
            </Animated.View>
          )}
          {state === 'expanded' && (
            <Animated.View style={StyleSheet.absoluteFill} entering={FadeIn.duration(180)} exiting={FadeOut.duration(90)}>
              <Pressable style={styles.fill} onPress={close}>
                <ExpandedContent
                  genre={genre}
                  cx={cx}
                  cy={cy}
                  clock={clock}
                  onOpenGrid={() => setState('grid')}
                  clearance={clearance}
                />
              </Pressable>
            </Animated.View>
          )}
          {state === 'grid' && (
            <Animated.View style={StyleSheet.absoluteFill} entering={FadeIn.duration(180)} exiting={FadeOut.duration(90)}>
              <GenreGrid genre={genre} cx={cx} cy={cy} clock={clock} onCollapse={close} clearance={clearance} />
            </Animated.View>
          )}
        </Animated.View>
      </GestureDetector>
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', left: 0, top: 0, width: 402, height: 874 },
  island: {
    position: 'absolute',
    backgroundColor: '#000',
    overflow: 'hidden',
    zIndex: 10,
  },
  fill: { flex: 1 },
})
