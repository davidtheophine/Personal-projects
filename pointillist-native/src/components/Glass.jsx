import { BlurView } from 'expo-blur'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { Pressable, StyleSheet, Text, View } from 'react-native'

// Liquid Glass is iOS 26+. Everywhere else we fall back to a blur, which reads
// as the same material even though it does not refract what is behind it.
const LIQUID = isLiquidGlassAvailable()

/**
 * A pane of glass. Use `Glass` for surfaces and `GlassButton` for anything
 * tappable — the button variant adds the press state and keeps the hit target
 * honest.
 */
export function Glass({ style, radius = 999, tint, children, ...rest }) {
  if (LIQUID) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor={tint}
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
        {...rest}
      >
        {children}
      </GlassView>
    )
  }
  return (
    <BlurView
      intensity={38}
      tint="dark"
      style={[{ borderRadius: radius, overflow: 'hidden' }, styles.fallback, style]}
      {...rest}
    >
      {children}
    </BlurView>
  )
}

export function GlassButton({
  onPress,
  onLongPress,
  delayLongPress,
  style,
  radius = 999,
  tint,
  accessibilityLabel,
  children,
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Glass radius={radius} tint={tint} style={style}>
        {children}
      </Glass>
    </Pressable>
  )
}

/** Small caps label, the house style for anything sitting on glass. */
export function GlassLabel({ children, style }) {
  return <Text style={[styles.label, style]}>{children}</Text>
}

const styles = StyleSheet.create({
  // Liquid Glass brings its own edge; the blur fallback needs one drawn on.
  fallback: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(14,14,16,0.26)',
  },
  pressed: { opacity: 0.6, transform: [{ scale: 0.97 }] },
  label: { color: '#fff', fontSize: 12, letterSpacing: 0.6, fontWeight: '500' },
})
