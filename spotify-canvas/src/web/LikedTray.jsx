import { useEffect, useState } from 'react'

const PlayMini = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path d="M8 5v14l11-7z" fill="currentColor" />
  </svg>
)
const XMini = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
)

export default function LikedTray({ saveStore, onPlay, songById }) {
  const [items, setItems] = useState(saveStore.list())
  const [open, setOpen] = useState(true)

  useEffect(() => saveStore.subscribe(setItems), [saveStore])

  return (
    <div className={`liked-tray${open ? ' is-open' : ''}`}>
      <button className="liked-header nodrag" onClick={() => setOpen((o) => !o)}>
        <span className="liked-title">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path
              d="M12 21s-7.5-4.6-10-9.2C.6 8.5 2.2 5.3 5.4 5.3c2 0 3.3 1.2 4.1 2.3.4.5 1 .5 1.4 0 .8-1.1 2.1-2.3 4.1-2.3 3.2 0 4.8 3.2 3.4 6.5C19.5 16.4 12 21 12 21z"
              fill="currentColor"
            />
          </svg>
          Liked
          <span className="liked-count">{items.length}</span>
        </span>
        <span className={`liked-chevron${open ? ' is-open' : ''}`}>⌄</span>
      </button>

      {open && (
        <div className="liked-body">
          {items.length === 0 ? (
            <p className="liked-empty">Songs you like appear here. Tap the ♥ on any card.</p>
          ) : (
            <ul className="liked-list">
              {items.map((item) => (
                <li key={item.id} className="liked-row">
                  <button
                    className="liked-play nodrag"
                    onClick={() => onPlay(songById.get(item.id))}
                    aria-label={`Play ${item.title}`}
                  >
                    <PlayMini />
                  </button>
                  <span className="liked-meta">
                    <span className="liked-song">{item.title}</span>
                    <span className="liked-artist">{item.artist}</span>
                  </span>
                  <button
                    className="liked-remove nodrag"
                    onClick={() => saveStore.remove(item.id)}
                    aria-label={`Remove ${item.title}`}
                  >
                    <XMini />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
