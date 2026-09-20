import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useDialKit } from 'dialkit'
import { genreAt } from '../lib/mapping.js'
import { DEFAULT_PARAMS, EFFECTS } from '../config.js'
import GenreField from './GenreField.jsx'

const keyOf = (g) => g.name + '|' + g.artist

export default function GenreGrid({ cursorTargetRef }) {
  const lastKey = useRef(null)
  const [genre, setGenre] = useState(() => {
    const g = genreAt(cursorTargetRef.current)
    lastKey.current = keyOf(g)
    return g
  })

  // live shader controls (persisted across reloads)
  const P = DEFAULT_PARAMS
  const dials = useDialKit(
    'Grid shader',
    {
      effect: { type: 'select', options: EFFECTS, default: EFFECTS[0] },
      effectAmount: [P.effectAmt, 0, 1.5],
      baseRadius: [P.baseRadius, 0.2, 1.2],
      dominance: [P.dominance, 0, 4],
      blobOpacity: [P.blobOpacity, 0.1, 1],
      flow: [P.flow, 0, 0.25],
      sat: [P.sat, 0, 1.4],
      bright: [P.bright, 0.5, 1.6],
      cursorSize: [P.cursorSize, 0.05, 0.5],
      cursorShadow: [P.cursorShadow, 0, 0.9],
      halo: [P.halo, 0, 1],
      haloRadius: [P.haloRadius, 0, 0.4],
      haloWidth: [P.haloWidth, 0.005, 0.1],
      grain: [P.grain, 0, 0.2],
      dotScale: [P.dotScale, 4, 60],
      dotOpacity: [P.dotOpacity, 0, 0.4],
      dotGlowRadius: [P.dotGlowRadius, 0, 0.6],
      dotGlowBoost: [P.dotGlowBoost, 0, 1],
      vignette: [P.vignette, 0, 1],
      baseColor: P.baseColor,
      colTR: P.colTR,
      colTL: P.colTL,
      colBL: P.colBL,
      colBR: P.colBR,
    },
    { id: 'grid-shader', persist: true },
  )
  const paramsRef = useRef(DEFAULT_PARAMS)
  paramsRef.current = {
    ...dials,
    effect: Math.max(0, EFFECTS.indexOf(dials.effect)),
    effectAmt: dials.effectAmount,
  }
  // screenshot-only override: ?fx=<effect index>
  const fx = typeof location !== 'undefined' && new URLSearchParams(location.search).get('fx')
  if (fx) paramsRef.current.effect = Number(fx)

  const onCursor = useCallback((sx, sy) => {
    const g = genreAt({ x: sx, y: sy })
    if (keyOf(g) !== lastKey.current) {
      lastKey.current = keyOf(g)
      setGenre(g)
    }
  }, [])

  return (
    <div className="grid-state">
      <div className="grid-label">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={keyOf(genre)}
            className="grid-label__row"
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -7 }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          >
            <span className="grid-label__genre">{genre.name}</span>
            <span className="grid-label__artist">like {genre.artist}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* expands from the genre tile's spot (bottom-left of the panel) into the
          full plane — animating the element's own transform (robust against the
          device's CSS scale, unlike Motion layout projection). */}
      <motion.div
        className="grid-plane"
        style={{ transformOrigin: 'center' }}
        initial={{ x: -151.5, y: 48, scaleX: 0.117, scaleY: 0.286, opacity: 0.4 }}
        animate={{ x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      >
        <GenreField
          cursorTargetRef={cursorTargetRef}
          paramsRef={paramsRef}
          interactive
          reticleSize={29}
          onCursor={onCursor}
        />
      </motion.div>
    </div>
  )
}
