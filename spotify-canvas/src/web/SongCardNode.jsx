import { memo, useEffect, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { MOTION } from '../core/config.js'
import { useCanvas, usePlaybackForSong, useSavedForSong } from './CanvasContext.js'
import { resolveArtwork, gradientFor } from './artwork.js'

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M8 5v14l11-7z" fill="currentColor" />
  </svg>
)
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
  </svg>
)
const HeartIcon = ({ filled }) => (
  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
    <path
      d="M12 21s-7.5-4.6-10-9.2C.6 8.5 2.2 5.3 5.4 5.3c2 0 3.3 1.2 4.1 2.3.4.5 1 .5 1.4 0 .8-1.1 2.1-2.3 4.1-2.3 3.2 0 4.8 3.2 3.4 6.5C19.5 16.4 12 21 12 21z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.7"
    />
  </svg>
)
const SparkIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
    <path
      d="M12 3l1.6 5.1L19 9.6l-4.4 2.9L16 18l-4-3.2L8 18l1.4-5.5L5 9.6l5.4-1.5z"
      fill="currentColor"
    />
  </svg>
)

const fmtTime = (ms) => {
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function SongCardNodeImpl({ data, selected }) {
  const { song, enterIndex = 0 } = data
  const { controller, saveStore, onMore, onPlayToggle } = useCanvas()
  const { isActiveSong, isPlaying, progress } = usePlaybackForSong(controller, song.id)
  const saved = useSavedForSong(saveStore, song.id)
  const [art, setArt] = useState(song.artworkUrl || null)

  useEffect(() => {
    let alive = true
    resolveArtwork(song).then((url) => {
      if (alive && url) setArt(url)
    })
    return () => {
      alive = false
    }
  }, [song])

  const posMs = progress * song.durationMs

  return (
    <div
      className={`song-card${selected ? ' is-selected' : ''}${isActiveSong ? ' is-active' : ''}`}
      style={{ '--enter-delay': `${enterIndex * MOTION.cardStaggerMs}ms` }}
    >
      <Handle type="target" position={Position.Top} className="card-handle" />

      <div className="card-art" style={{ backgroundImage: art ? `url(${art})` : gradientFor(song) }}>
        <div className="card-art-scrim" />
        <button
          className="play-btn nodrag"
          onClick={() => onPlayToggle(song)}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={isPlaying ? 'Pause (preview)' : 'Play (preview)'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className="card-progress" data-visible={isActiveSong}>
          <div className="card-progress-fill" style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>

      <div className="card-body">
        <div className="card-meta">
          <div className="card-title" title={song.title}>
            {song.title}
          </div>
          <div className="card-artist" title={`${song.artist} · ${song.album}`}>
            {song.artist}
          </div>
        </div>

        <div className="card-actions">
          <span className="card-time">
            {isActiveSong ? `${fmtTime(posMs)} · preview` : fmtTime(song.durationMs)}
          </span>
          <div className="card-buttons">
            <button
              className={`like-btn nodrag${saved ? ' is-saved' : ''}`}
              onClick={() => saveStore.toggle(song)}
              aria-label={saved ? 'Remove from Liked' : 'Save to Liked'}
              title={saved ? 'Remove from Liked' : 'Save to Liked'}
            >
              <HeartIcon filled={saved} />
            </button>
            <button
              className="more-btn nodrag"
              onClick={() => onMore(song.id)}
              title="Discover 5 more from this song"
            >
              <SparkIcon />
              More
            </button>
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="card-handle" />
    </div>
  )
}

export default memo(SongCardNodeImpl)
