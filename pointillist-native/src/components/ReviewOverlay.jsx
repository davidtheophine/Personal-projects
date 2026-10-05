import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Glass } from './Glass'

const BORDER = 13 // white margin on three sides
const CHIN = 54 // the thick bottom edge that makes it read as a Polaroid
const DEVELOP_MS = 700

/**
 * The capture, presented as a print developing into view.
 *
 * The develop is done with layered opacity rather than a shader: the image
 * rises while a cream wash and a cold cast fade off it, which is the order a
 * real print comes up in. It is all native-driven, so it stays smooth while the
 * camera loop is paused; a shader pass here would cost a GL round trip and look
 * no better.
 *
 * The aperture keeps the snapshot's own aspect ratio rather than cropping to a
 * square: what you see here is exactly the file that gets saved.
 */
export default function ReviewOverlay({ shot, status, error, onSave, onDiscard }) {
  const insets = useSafeAreaInsets()
  const develop = useRef(new Animated.Value(0)).current
  const [stage, setStage] = useState(null)
  const saved = status === 'saved'

  useEffect(() => {
    Animated.timing(develop, {
      toValue: 1,
      duration: DEVELOP_MS,
      useNativeDriver: true,
    }).start()
  }, [develop])

  // Fit the print to the space actually left over, measured rather than
  // guessed — the frame was drifting off centre when the estimate was wrong.
  let frameWidth = 0
  let imageHeight = 0
  if (stage) {
    const aspect = shot.width && shot.height ? shot.width / shot.height : 3 / 4
    frameWidth = stage.width
    imageHeight = (frameWidth - BORDER * 2) / aspect
    if (imageHeight + BORDER + CHIN > stage.height) {
      imageHeight = Math.max(80, stage.height - BORDER - CHIN)
      frameWidth = imageHeight * aspect + BORDER * 2
    }
  }

  const fade = (outputRange) =>
    develop.interpolate({ inputRange: [0, 0.45, 1], outputRange, extrapolate: 'clamp' })

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
      <View
        style={styles.stage}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout
          setStage({ width: Math.max(80, width - 44), height: Math.max(120, height - 24) })
        }}
      >
        {stage ? (
          <Animated.View
            style={[
              styles.frame,
              {
                width: frameWidth,
                opacity: develop.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
                transform: [
                  { translateY: develop.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
                  { scale: develop.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
                ],
              },
            ]}
          >
            <View style={{ width: frameWidth - BORDER * 2, height: imageHeight }}>
              <Animated.Image
                source={{ uri: shot.localUri || shot.uri }}
                style={[StyleSheet.absoluteFill, { opacity: fade([0, 0.55, 1]) }]}
                resizeMode="cover"
              />
              {/* Cream wash: the blank emulsion the image comes up through. */}
              <Animated.View
                pointerEvents="none"
                style={[styles.wash, { opacity: fade([1, 0.45, 0]) }]}
              />
              {/* Cold cast, gone early — prints come up blue before they warm. */}
              <Animated.View
                pointerEvents="none"
                style={[styles.cast, { opacity: fade([0.55, 0.22, 0]) }]}
              />
            </View>
            <View style={styles.chin} />
          </Animated.View>
        ) : null}
      </View>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 22 }]}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {status === 'saving' ? (
          <View style={styles.save}>
            <ActivityIndicator color="#0a0a0b" />
          </View>
        ) : (
          <Pressable
            onPress={onSave}
            disabled={saved}
            style={[styles.save, saved && styles.saveDone]}
            accessibilityRole="button"
            accessibilityLabel="Save to camera roll"
          >
            <Text style={[styles.saveText, saved && styles.saveTextDone]}>
              {saved ? 'Saved ✓' : 'Save to camera roll'}
            </Text>
          </Pressable>
        )}

        <Pressable onPress={onDiscard} hitSlop={12}>
          <Glass style={styles.retake}>
            <Text style={styles.retakeText}>Retake</Text>
          </Glass>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  // Its own flex row in the column, so the print centres in what is left after
  // the action bar rather than in the whole screen.
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    backgroundColor: '#fdfdfb',
    padding: BORDER,
    paddingBottom: 0,
    borderRadius: 3,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
  },
  wash: { ...StyleSheet.absoluteFillObject, backgroundColor: '#efeae0' },
  cast: { ...StyleSheet.absoluteFillObject, backgroundColor: '#7f9ba8' },
  chin: { height: CHIN },
  bar: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 18, gap: 14 },
  save: {
    minWidth: 240,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  saveDone: { backgroundColor: 'rgba(255,255,255,0.16)' },
  saveText: { color: '#0a0a0b', fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  saveTextDone: { color: '#fff', fontWeight: '500' },
  retake: { paddingVertical: 11, paddingHorizontal: 26 },
  retakeText: { color: '#fff', opacity: 0.7, fontSize: 14, letterSpacing: 0.3 },
  error: { color: '#ff9c8d', fontSize: 13, lineHeight: 18, textAlign: 'center' },
})
