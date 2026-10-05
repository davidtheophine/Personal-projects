import { useEffect, useRef } from 'react'
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const BORDER = 13 // white margin on three sides
const CHIN = 54 // the thick bottom edge that makes it read as a Polaroid

/**
 * The capture, presented as a print that develops into view.
 *
 * The aperture keeps the snapshot's own aspect ratio rather than cropping to a
 * square: what you see here is exactly the file that gets saved.
 */
export default function ReviewOverlay({ shot, status, error, onSave, onDiscard }) {
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const enter = useRef(new Animated.Value(0)).current
  const saved = status === 'saved'

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 460,
      useNativeDriver: true,
    }).start()
  }, [enter])

  // Fit the print into whatever is left between the status bar and the button.
  const available = {
    width: window.width - 44,
    height: window.height - insets.top - insets.bottom - 190,
  }
  const aspect = shot.width && shot.height ? shot.width / shot.height : 3 / 4
  let frameWidth = available.width
  let imageHeight = (frameWidth - BORDER * 2) / aspect
  if (imageHeight + BORDER + CHIN > available.height) {
    imageHeight = available.height - BORDER - CHIN
    frameWidth = imageHeight * aspect + BORDER * 2
  }

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.frame,
          {
            width: frameWidth,
            opacity: enter,
            transform: [
              { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
              { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          },
        ]}
      >
        <Image
          source={{ uri: shot.localUri || shot.uri }}
          style={{ width: frameWidth - BORDER * 2, height: imageHeight, backgroundColor: '#111' }}
          resizeMode="cover"
        />
        <View style={styles.chin} />
      </Animated.View>

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

        <Pressable onPress={onDiscard} hitSlop={12} style={styles.retake}>
          <Text style={styles.retakeText}>Retake</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,9,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    backgroundColor: '#fdfdfb',
    padding: BORDER,
    paddingBottom: 0,
    borderRadius: 3,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
  },
  chin: { height: CHIN },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 14,
  },
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
  retake: { paddingVertical: 4, paddingHorizontal: 16 },
  retakeText: { color: '#fff', opacity: 0.7, fontSize: 14, letterSpacing: 0.3 },
  error: { color: '#ff9c8d', fontSize: 13, lineHeight: 18, textAlign: 'center' },
})
