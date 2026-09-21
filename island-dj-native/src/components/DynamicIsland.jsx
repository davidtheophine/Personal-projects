import { useEffect, useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler'
import CompactContent from './CompactContent.jsx'
import ExpandedContent from './ExpandedContent.jsx'
import GridScreen from './GridScreen.jsx'

// compact vs open dims (expanded & grid share the open size). Open height is
// 218 + `clearance` (the top gap inside the black island, baked at 20px).
const COMPACT = { left: 88, top: 15, width: 210, height: 40, radius: 20 }
const OPEN = { left: 7.5, top: 6, width: 387, radius: 48 } // height = 218 + clearance

// Direction-aware morph springs. Open stays lively (a little overshoot); close is
// near-critically-damped so it settles into the pill WITHOUT bouncing past it and
// flashing the wallpaper behind. Bouncier = lower damping; snappier = higher stiffness.
const OPEN_SPRING = { mass: 1, stiffness: 300, damping: 24 } // ζ≈0.69
const CLOSE_SPRING = { mass: 1, stiffness: 300, damping: 35 } // ζ≈1.0, no overshoot

export default function DynamicIsland({ cx, cy, clock, genre, clearance, onPickGenre, tilePitch, magnify, mode }) {
  const [state, setState] = useState('compact')
  const reduce = useReducedMotion()
  const open = useSharedValue(0) // 0 = compact, 1 = expanded/grid
  const squeeze = useSharedValue(0) // 0..1 collapse "squeeze": pill dips narrower then springs back

  useEffect(() => {
    const target = state === 'compact' ? 0 : 1
    const spring = target === 0 ? CLOSE_SPRING : OPEN_SPRING
    open.value = reduce ? withTiming(target, { duration: 160 }) : withSpring(target, spring)
    // Apple-style collapse: as it lands on the pill, squeeze narrower (clipping the
    // album/waveform) then spring back out. Horizontal-emphasis; close only.
    if (target === 0 && !reduce) {
      squeeze.value = withDelay(
        90,
        withSequence(
          withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) }),
          withSpring(0, { mass: 1, stiffness: 300, damping: 28 }),
        ),
      )
    } else {
      squeeze.value = 0
    }
  }, [state, reduce, open, squeeze])

  const containerStyle = useAnimatedStyle(() => {
    const t = open.value // spring-driven; may briefly over/undershoot [0,1]
    const openH = 218 + Math.max(0, clearance.value)
    const mix = (a, b) => a + t * (b - a)
    // Peak squeeze clips ~16px off each side of the 210px compact pill: past the
    // 11px padding gutter and ~5px into the album cover (left) + waveform (right),
    // so they visibly "cut" for a moment. `dx` is THE knob for how deep the cut is.
    const dx = squeeze.value * 32 // horizontal squeeze (emphasis)
    const dy = squeeze.value * 6 // subtle vertical dip
    return {
      left: mix(COMPACT.left, OPEN.left) + dx / 2,
      top: mix(COMPACT.top, OPEN.top) + dy / 2,
      width: mix(COMPACT.width, OPEN.width) - dx,
      height: mix(COMPACT.height, openH) - dy,
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
              <GridScreen
              genre={genre}
              cx={cx}
              cy={cy}
              clock={clock}
              onCollapse={close}
              onPickGenre={onPickGenre}
              clearance={clearance}
              tilePitch={tilePitch}
              magnify={magnify}
              mode={mode}
            />
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
