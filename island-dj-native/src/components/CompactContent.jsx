import { View, Image } from 'react-native'
import Waveform from './Waveform.jsx'
import { coverFor } from '../assets.js'

// Compact pill: album thumb (reflecting the picked artist) + equalizer.
export default function CompactContent({ genre }) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 11,
      }}
    >
      <Image source={coverFor(genre)} style={{ width: 28, height: 28, borderRadius: 7 }} />
      <Waveform scale={0.82} />
    </View>
  )
}
