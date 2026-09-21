import { useState } from 'react'
import { View, Image, useWindowDimensions, StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useClock } from '@shopify/react-native-skia'
import { useAnimatedReaction, useSharedValue, runOnJS } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import DynamicIsland from './src/components/DynamicIsland.jsx'
import ControlPanel from './src/components/ControlPanel.jsx'
import CoverPreloader from './src/components/CoverPreloader.jsx'
import { HOME } from './src/assets.js'
import { INITIAL_CURSOR, GENRE_POINTS, POINT_XY } from './src/data/genres.js'

// The UI is authored in the web app's 402×874 "screen" (== iPhone 16 Pro points);
// scale it to fit the device.
const DW = 402
const DH = 874

function nearestGenre(x, y) {
  let best = GENRE_POINTS[0]
  let bestD = Infinity
  for (const p of GENRE_POINTS) {
    const dx = p.x - x
    const dy = p.y - y
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}

function Stage() {
  const { width, height } = useWindowDimensions()
  const scale = Math.min(width / DW, height / DH)

  const cx = useSharedValue(INITIAL_CURSOR.x)
  const cy = useSharedValue(INITIAL_CURSOR.y)
  const clock = useClock()
  // space between the island's topmost content and the top of the black island
  const clearance = useSharedValue(20)
  // album-grid tile size (px) + magnify (peak scale boost), live from the panel
  const tilePitch = useSharedValue(48)
  const magnify = useSharedValue(0.42)

  const [gridMode, setGridMode] = useState('albums') // 'genre' | 'albums' (driven by the control panel)
  const [genre, setGenre] = useState(() => nearestGenre(INITIAL_CURSOR.x, INITIAL_CURSOR.y))
  const lastIdx = useSharedValue(-1)
  const setGenreIdx = (i) => setGenre(GENRE_POINTS[i])

  // update the label/cover when the picker crosses into a new nearest genre
  useAnimatedReaction(
    () => [cx.value, cy.value],
    (cur) => {
      'worklet'
      let best = 0
      let bestD = 1e9
      for (let i = 0; i < POINT_XY.length; i++) {
        const dx = POINT_XY[i][0] - cur[0]
        const dy = POINT_XY[i][1] - cur[1]
        const d = dx * dx + dy * dy
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      if (best !== lastIdx.value) {
        lastIdx.value = best
        runOnJS(setGenreIdx)(best)
        // selection tick each time the picker crosses into a new genre
        runOnJS(Haptics.selectionAsync)()
      }
    },
  )

  return (
    <View style={[styles.stage, { transform: [{ scale }] }]}>
      <Image source={HOME} style={styles.home} resizeMode="cover" />
      <DynamicIsland
        cx={cx}
        cy={cy}
        clock={clock}
        genre={genre}
        clearance={clearance}
        onPickGenre={setGenre}
        tilePitch={tilePitch}
        magnify={magnify}
        mode={gridMode}
      />
      <ControlPanel mode={gridMode} onModeChange={setGridMode} pitch={tilePitch} magnify={magnify} />
    </View>
  )
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics} style={styles.center}>
        <StatusBar hidden />
        <Stage />
        <CoverPreloader />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { width: DW, height: DH, overflow: 'hidden' },
  home: { position: 'absolute', width: DW, height: DH },
})
