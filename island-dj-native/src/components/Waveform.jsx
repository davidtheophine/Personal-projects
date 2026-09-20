import { View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'

const HEIGHTS = [4.743, 7, 11, 7.906, 3.689, 6.852, 8.96]
// per-bar oscillation so the equalizer looks alive, not synchronized
const SPEEDS = [5.1, 6.3, 4.4, 7.0, 5.6, 6.8, 4.9]
const PHASES = [0, 1.7, 0.6, 2.3, 1.1, 2.9, 0.4]

// One bar. When `clock` + `playing` are supplied it bounces on the UI thread
// (scaleY from the bar's centre — Apple's equalizer is centre-mirrored); static otherwise.
function Bar({ h, scale, speed, phase, clock, playing }) {
  const style = useAnimatedStyle(() => {
    'worklet'
    if (!clock || !playing || !playing.value) return { transform: [{ scaleY: 1 }] }
    const t = clock.value / 1000
    const s = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * speed + phase)) // [0.45, 1]
    return { transform: [{ scaleY: s }] }
  })

  return (
    <Animated.View
      style={[
        {
          width: 2 * scale,
          height: h * scale,
          borderRadius: 1.5,
          backgroundColor: '#e6e6e6',
        },
        style,
      ]}
    />
  )
}

export default function Waveform({ scale = 1, clock, playing }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {HEIGHTS.map((h, i) => (
        <View key={i} style={{ marginLeft: i ? 1.054 * scale : 0 }}>
          <Bar h={h} scale={scale} speed={SPEEDS[i]} phase={PHASES[i]} clock={clock} playing={playing} />
        </View>
      ))}
    </View>
  )
}
