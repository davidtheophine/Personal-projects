import { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { Canvas, Fill, Shader } from '@shopify/react-native-skia'
import Animated, { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { genreEffect, staticUniforms } from '../shader/genreField.js'

/**
 * Shader plane + reticle + axes for a given cursor (shared values cx/cy, 0..1).
 * Shared by the big interactive grid and the small read-only genre tile.
 */
export default function GenreField({
  width,
  height,
  cx,
  cy,
  clock,
  params,
  interactive = false,
  reticleSize = 28,
  showAxes = true,
  borderRadius = 0,
}) {
  const staticU = useMemo(() => staticUniforms(params), [params])

  const uniforms = useDerivedValue(() => ({
    ...staticU,
    u_resolution: [width, height],
    u_time: clock.value / 1000,
    u_cursor: [cx.value, cy.value],
  }))

  const reticlePos = useAnimatedStyle(() => ({
    transform: [
      { translateX: cx.value * width - reticleSize / 2 },
      { translateY: cy.value * height - reticleSize / 2 },
    ],
  }))

  const gesture = useMemo(() => {
    const set = (e) => {
      'worklet'
      cx.value = Math.min(1, Math.max(0, e.x / width))
      cy.value = Math.min(1, Math.max(0, e.y / height))
    }
    const pan = Gesture.Pan().onBegin(set).onChange(set)
    // a plain tap picks that point too — and claims the touch so it doesn't fall
    // through to the "tap background to close" Pressable behind the plane
    const tap = Gesture.Tap().onEnd(set)
    return Gesture.Race(pan, tap)
  }, [cx, cy, width, height])

  // reticle geometry (px), derived from size
  const rs = reticleSize
  const thick = Math.max(1.2, rs * 0.09)
  const len = rs * 0.26
  const ring = rs * 0.46
  const pip = ring * 0.42

  const plane = (
    <View style={{ width, height, borderRadius, overflow: 'hidden', backgroundColor: '#05100a' }}>
      <Canvas style={{ width, height }}>
        {genreEffect ? (
          <Fill>
            <Shader source={genreEffect} uniforms={uniforms} />
          </Fill>
        ) : (
          <Fill color="#062712" />
        )}
      </Canvas>

      {showAxes && (
        <>
          <View style={[styles.axis, { left: width / 2 - 0.5, top: 0, width: 1, height }]} />
          <View style={[styles.axis, { top: height / 2 - 0.5, left: 0, height: 1, width }]} />
        </>
      )}

      <Animated.View style={[{ position: 'absolute', width: rs, height: rs }, styles.reticle, reticlePos]}>
        <View style={[styles.tick, { left: (rs - thick) / 2, top: 0, width: thick, height: len }]} />
        <View style={[styles.tick, { left: (rs - thick) / 2, top: rs - len, width: thick, height: len }]} />
        <View style={[styles.tick, { top: (rs - thick) / 2, left: 0, height: thick, width: len }]} />
        <View style={[styles.tick, { top: (rs - thick) / 2, left: rs - len, height: thick, width: len }]} />
        <View
          style={[
            styles.ring,
            {
              left: (rs - ring) / 2,
              top: (rs - ring) / 2,
              width: ring,
              height: ring,
              borderRadius: ring / 2,
              borderWidth: Math.max(0.5, rs * 0.03),
            },
          ]}
        >
          <View style={{ width: pip, height: pip, borderRadius: pip / 2, backgroundColor: 'rgba(255,255,255,0.95)' }} />
        </View>
      </Animated.View>
    </View>
  )

  return interactive ? <GestureDetector gesture={gesture}>{plane}</GestureDetector> : plane
}

const styles = StyleSheet.create({
  axis: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.16)' },
  reticle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  tick: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 1 },
  ring: {
    position: 'absolute',
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(215,216,215,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
