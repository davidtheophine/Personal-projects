import { View } from 'react-native'
import { Image } from 'expo-image'
import Waveform from './Waveform.jsx'
import { coverFor } from '../assets.js'

// Compact pill: album thumb (reflecting the picked artist) + equalizer.
// The inner row is a FIXED 210px (== COMPACT.width) centered in the island, not
// flex — so when the close "squeeze" narrows the island below 210px, the island's
// overflow:hidden literally CUTS the album/waveform edges (Apple-style) instead of
// reflowing them inward.
export default function CompactContent({ genre }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 210,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 11,
        }}
      >
        <Image
          source={coverFor(genre)}
          style={{ width: 28, height: 28, borderRadius: 7 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
        />
        <Waveform scale={0.82} />
      </View>
    </View>
  )
}
