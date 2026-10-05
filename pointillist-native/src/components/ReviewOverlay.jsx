import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * Shown after the shutter: the frozen frame plus save / discard. Every exit is
 * one tap — the close cross, Retake, or Save (which returns on its own).
 */
export default function ReviewOverlay({ shot, status, onSave, onDiscard }) {
  const insets = useSafeAreaInsets()
  const saved = status === 'saved'

  return (
    <View style={styles.root}>
      <Image
        source={{ uri: shot.localUri || shot.uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
      />

      <Pressable
        onPress={onDiscard}
        hitSlop={14}
        accessibilityRole="button"
        accessibilityLabel="Discard and go back to the camera"
        style={[styles.close, { top: insets.top + 10 }]}
      >
        <Text style={styles.closeGlyph}>✕</Text>
      </Pressable>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={onDiscard} hitSlop={10} style={styles.ghost}>
          <Text style={styles.ghostText}>Retake</Text>
        </Pressable>

        {status === 'saving' ? (
          <View style={styles.solid}>
            <ActivityIndicator color="#0a0a0b" />
          </View>
        ) : (
          <Pressable
            onPress={onSave}
            disabled={saved}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Save to camera roll"
            style={[styles.solid, saved && styles.solidDone]}
          >
            <Text style={[styles.solidText, saved && styles.solidTextDone]}>
              {saved ? 'Saved ✓' : 'Save to camera roll'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  close: {
    position: 'absolute',
    right: 18,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeGlyph: { color: '#fff', fontSize: 16, lineHeight: 19 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  ghost: { paddingVertical: 14, paddingHorizontal: 14 },
  ghostText: { color: '#fff', opacity: 0.8, fontSize: 15, letterSpacing: 0.4 },
  solid: {
    minWidth: 190,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 24,
  },
  solidDone: { backgroundColor: 'rgba(255,255,255,0.16)' },
  solidText: { color: '#0a0a0b', fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  solidTextDone: { color: '#fff', fontWeight: '500' },
})
