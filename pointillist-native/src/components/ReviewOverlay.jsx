import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** Shown after the shutter: the frozen frame plus save / discard. */
export default function ReviewOverlay({ shot, status, onSave, onDiscard }) {
  const insets = useSafeAreaInsets()
  const saved = status === 'saved'

  return (
    <View style={styles.root}>
      <Image source={{ uri: shot.localUri || shot.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
      <View style={[styles.bar, { paddingBottom: insets.bottom + 26, paddingTop: 18 }]}>
        <Pressable onPress={onDiscard} hitSlop={10} style={styles.ghost}>
          <Text style={styles.ghostText}>Retake</Text>
        </Pressable>

        {status === 'saving' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Pressable onPress={onSave} disabled={saved} hitSlop={10} style={[styles.solid, saved && styles.solidDone]}>
            <Text style={[styles.solidText, saved && styles.solidTextDone]}>
              {saved ? 'Saved to camera roll' : 'Save'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  ghost: { paddingVertical: 12, paddingHorizontal: 16 },
  ghostText: { color: '#fff', opacity: 0.75, fontSize: 14, letterSpacing: 0.4 },
  solid: { backgroundColor: '#fff', borderRadius: 999, paddingVertical: 13, paddingHorizontal: 26 },
  solidDone: { backgroundColor: 'rgba(255,255,255,0.14)' },
  solidText: { color: '#0a0a0b', fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
  solidTextDone: { color: '#fff', fontWeight: '500' },
})
