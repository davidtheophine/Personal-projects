import { useRef, useState } from 'react'
import { Play, Pause, Rewind, FastForward, Airplay } from 'lucide-react'
import Waveform from './Waveform.jsx'
import GenreField from './GenreField.jsx'
import { TILE_PARAMS } from '../config.js'
import { genreAt } from '../lib/mapping.js'

const ICON = 'rgba(255,255,255,0.92)'

// Now-playing reflects wherever the picker was left (Frank Ocean → "Ivy" at start).
export default function ExpandedContent({ onOpenGrid, cursorTargetRef }) {
  const [playing, setPlaying] = useState(true)
  const tileParamsRef = useRef(TILE_PARAMS)
  const np = genreAt(cursorTargetRef.current)
  const stop = (e) => e.stopPropagation()

  return (
    <div className="expanded">
      <img className="expanded__art" src={np.cover || '/figma/album.png'} alt="" />
      <div className="expanded__wave">
        <Waveform />
      </div>

      <div className="expanded__meta">
        <div className="expanded__title">{np.song}</div>
        <div className="expanded__artist">{np.artist}</div>
      </div>

      <div className="scrubber">
        <span className="scrubber__time">1:12</span>
        <div className="scrubber__track">
          <div className="scrubber__fill" style={{ width: '29%' }} />
        </div>
        <span className="scrubber__time scrubber__time--right">-2:57</span>
      </div>

      {/* tile far-left · transport grouped-and-centered · output far-right (like iOS) */}
      <div className="controls">
        <button
          className="controls__tile"
          onClick={(e) => {
            stop(e)
            onOpenGrid()
          }}
          aria-label="Open genre map"
        >
          <GenreField
            cursorTargetRef={cursorTargetRef}
            paramsRef={tileParamsRef}
            interactive={false}
            mini
            reticleSize={12}
            showAxes
          />
        </button>

        <div className="controls__transport">
          <button className="controls__btn" aria-label="Rewind" onClick={stop}>
            <Rewind size={31} fill={ICON} color={ICON} strokeWidth={0} />
          </button>
          <button
            className="controls__btn"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={(e) => {
              stop(e)
              setPlaying((p) => !p)
            }}
          >
            {playing ? (
              <Pause size={36} fill={ICON} color={ICON} strokeWidth={0} />
            ) : (
              <Play size={36} fill={ICON} color={ICON} strokeWidth={0} />
            )}
          </button>
          <button className="controls__btn" aria-label="Forward" onClick={stop}>
            <FastForward size={31} fill={ICON} color={ICON} strokeWidth={0} />
          </button>
        </div>

        <button className="controls__btn controls__out" aria-label="AirPlay" onClick={stop}>
          <Airplay size={24} color="rgba(255,255,255,0.82)" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
