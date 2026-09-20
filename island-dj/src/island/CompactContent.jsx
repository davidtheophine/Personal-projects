import Waveform from './Waveform.jsx'
import { genreAt } from '../lib/mapping.js'

// Compact Dynamic Island: album thumb (reflecting the picked artist) + equalizer.
export default function CompactContent({ cursorTargetRef }) {
  const np = genreAt(cursorTargetRef.current)
  return (
    <div className="compact">
      <img className="compact__art" src={np.cover || '/figma/album.png'} alt="" />
      <Waveform scale={0.82} />
    </div>
  )
}
