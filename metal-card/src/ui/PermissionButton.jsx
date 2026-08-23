import { useState } from 'react'

// iOS 13+ requires DeviceOrientationEvent.requestPermission() to be called from
// a user gesture (and a secure/HTTPS context). This button appears only where
// that gate exists; on Android/desktop it renders nothing.
export function PermissionButton() {
  const needsPrompt =
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  const [granted, setGranted] = useState(false)

  if (!needsPrompt || granted) return null

  return (
    <button
      onClick={async () => {
        try {
          const res = await DeviceOrientationEvent.requestPermission()
          if (res === 'granted') setGranted(true)
        } catch {
          /* denied or unavailable — pointer fallback still works */
        }
      }}
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 54,
        transform: 'translateX(-50%)',
        padding: '11px 20px',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.16)',
        background: 'rgba(20,20,24,0.72)',
        backdropFilter: 'blur(8px)',
        color: '#eef0f4',
        font: '600 13px -apple-system, system-ui, sans-serif',
        letterSpacing: '0.02em',
        cursor: 'pointer',
      }}
    >
      Enable motion
    </button>
  )
}
