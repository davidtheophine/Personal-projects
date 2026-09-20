// iOS status bar chrome: time on the left, signal/wifi/battery on the right.
// The Dynamic Island sits between them (rendered separately, on top).
export default function StatusBar() {
  return (
    <div className="statusbar">
      <div className="statusbar__time">9:41</div>
      <div className="statusbar__levels">
        <svg width="19" height="13" viewBox="0 0 19 13" fill="none" aria-hidden="true">
          <rect x="0" y="8.5" width="3" height="4.5" rx="1" fill="white" />
          <rect x="4.7" y="6" width="3" height="7" rx="1" fill="white" />
          <rect x="9.4" y="3.2" width="3" height="9.8" rx="1" fill="white" />
          <rect x="14.1" y="0.5" width="3" height="12.5" rx="1" fill="white" />
        </svg>
        <svg width="18" height="13" viewBox="0 0 18 13" fill="none" aria-hidden="true">
          <path
            d="M9 3.4c2.9 0 5.6 1.1 7.6 3l-1.6 1.6C13.4 7.6 11.3 6.7 9 6.7s-4.4.9-6 2.3L1.4 6.4C3.4 4.5 6.1 3.4 9 3.4Z"
            fill="white"
          />
          <path d="M9 8.3c1.3 0 2.5.5 3.4 1.4L9 13 5.6 9.7C6.5 8.8 7.7 8.3 9 8.3Z" fill="white" />
        </svg>
        <div className="statusbar__battery">
          <div className="statusbar__battery-body">
            <div className="statusbar__battery-fill" />
          </div>
          <div className="statusbar__battery-cap" />
        </div>
      </div>
    </div>
  )
}
