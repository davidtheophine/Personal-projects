// The little "now playing" equalizer — 7 bars, matching the Figma heights.
const HEIGHTS = [4.743, 7, 11, 7.906, 3.689, 6.852, 8.96]

export default function Waveform({ scale = 1 }) {
  return (
    <div className="waveform" style={{ gap: 1.054 * scale }}>
      {HEIGHTS.map((h, i) => (
        <span key={i} className="waveform__bar" style={{ width: 2 * scale, height: h * scale }} />
      ))}
    </div>
  )
}
