import { Animated, Pressable, StyleSheet } from 'react-native'
import { useRef } from 'react'

import { Glass } from './Glass'

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
      <Glass radius={37} style={styles.ring}>
        <Animated.View
          style={[
            styles.core,
            { opacity: busy ? 0.4 : 1, transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }) }] },
          ]}
        />
      </Glass>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  ring: { width: 74, height: 74, alignItems: 'center', justifyContent: 'center' },
  core: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
})
