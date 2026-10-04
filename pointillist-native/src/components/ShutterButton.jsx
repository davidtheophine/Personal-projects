import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { useRef } from 'react'

export default function ShutterButton({ onPress, busy }) {
  const press = useRef(new Animated.Value(0)).current
  const to = (v) =>
    Animated.spring(press, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start()

  return (
    <Pressable
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      onPress={onPress}
      disabled={busy}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Take a pointillist photo"
    >
      <View style={styles.ring}>
        <Animated.View
          style={[
            styles.core,
            { opacity: busy ? 0.4 : 1, transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }) }] },
          ]}
        />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  ring: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
})
