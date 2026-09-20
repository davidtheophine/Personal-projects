import { useCallback, useRef } from 'react'
import { useGenreShader } from '../shader/useGenreShader.js'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

/**
 * Shader plane + reticle for a given cursor. Fills its parent (the parent sets
 * the size + radius). Shared by the big interactive grid and the small,
 * read-only genre tile so both reflect the same (persisted) picker position.
 */
export default function GenreField({
  cursorTargetRef,
  paramsRef,
  interactive = false,
  reticleSize = 29,
  showAxes = true,
  mini = false,
  onCursor,
}) {
  const canvasRef = useRef(null)
  const planeRef = useRef(null)
  const crossRef = useRef(null)
  const dragging = useRef(false)

  const onSmoothed = useCallback(
    (sx, sy) => {
      const el = crossRef.current
      const plane = planeRef.current
      if (el && plane) {
        el.style.transform = `translate(${sx * plane.clientWidth}px, ${sy * plane.clientHeight}px) translate(-50%, -50%)`
      }
      if (onCursor) onCursor(sx, sy)
    },
    [onCursor],
  )

  useGenreShader({ canvasRef, cursorTargetRef, paramsRef, onSmoothed })

  const setFromPointer = (e) => {
    const r = planeRef.current.getBoundingClientRect()
    cursorTargetRef.current.x = clamp((e.clientX - r.left) / r.width, 0, 1)
    cursorTargetRef.current.y = clamp((e.clientY - r.top) / r.height, 0, 1)
  }
  const pointerProps = interactive
    ? {
        onClick: (e) => e.stopPropagation(),
        onPointerDown: (e) => {
          e.stopPropagation()
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          setFromPointer(e)
        },
        onPointerMove: (e) => dragging.current && setFromPointer(e),
        onPointerUp: () => (dragging.current = false),
        onPointerCancel: () => (dragging.current = false),
      }
    : {}

  return (
    <div className={mini ? 'field field--mini' : 'field'} ref={planeRef} {...pointerProps}>
      <canvas ref={canvasRef} />
      {showAxes && (
        <>
          <div className="field-axis field-axis--v" />
          <div className="field-axis field-axis--h" />
        </>
      )}
      <div className="reticle" ref={crossRef} style={{ width: reticleSize, height: reticleSize }}>
        <span className="reticle__tick reticle__tick--t" />
        <span className="reticle__tick reticle__tick--b" />
        <span className="reticle__tick reticle__tick--l" />
        <span className="reticle__tick reticle__tick--r" />
        <span className="reticle__dot">
          <span className="reticle__pip" />
        </span>
      </div>
    </div>
  )
}
