import { View, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { COVERS } from '../data/covers.generated.js'

// Warms expo-image's memory+disk cache at startup by mounting every cover once
// (off-screen). The album grid + now-playing use the same sources with
// cachePolicy "memory-disk", so they hit this cache — no row-by-row load, and
// reopening the grid doesn't reload (the cache persists across mount/unmount).
export default function CoverPreloader() {
  return (
    <View style={styles.wrap} pointerEvents="none" accessible={false}>
      {COVERS.map((c, i) =>
        c ? <Image key={i} source={c} style={styles.img} cachePolicy="memory-disk" priority="high" transition={0} /> : null,
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: -9999, left: 0, opacity: 0 },
  img: { width: 64, height: 64 },
})
