import { useEffect, useState } from 'react'
import Backdrop from './Backdrop.jsx'
import DynamicIsland from '../island/DynamicIsland.jsx'

// Screen is authored at the Figma size (402×874); the device body adds a bezel.
const BODY_W = 402 + 2 * 13
const BODY_H = 874 + 2 * 13

export default function PhoneMockup() {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fit = () =>
      setScale(Math.min(1, (window.innerHeight - 32) / BODY_H, (window.innerWidth - 32) / BODY_W))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  return (
    <div className="device" style={{ transform: `scale(${scale})` }}>
      <span className="device__btn device__btn--mute" />
      <span className="device__btn device__btn--volup" />
      <span className="device__btn device__btn--voldn" />
      <span className="device__btn device__btn--power" />
      <div className="device__screen">
        <Backdrop />
        <DynamicIsland />
      </div>
    </div>
  )
}
