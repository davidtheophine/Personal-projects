import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import CompactContent from './CompactContent.jsx'
import ExpandedContent from './ExpandedContent.jsx'
import GenreGrid from './GenreGrid.jsx'
import { INITIAL_CURSOR } from '../data/genres.js'

// explicit left (not centered) so the compact pill covers the baked pill,
// which sits ~21px left of screen center in the Figma home frame.
const DIMS = {
  compact: { left: 88, top: 20, width: 194, height: 38, borderRadius: 19 },
  expanded: { left: 7.5, top: 6, width: 387, height: 218, borderRadius: 48 },
  grid: { left: 7.5, top: 6, width: 387, height: 218, borderRadius: 48 },
}
const SPRING = { type: 'spring', duration: 0.55, bounce: 0.22 }
const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }

export default function DynamicIsland() {
  const [state, setState] = useState('compact')
  // persisted picker position — remembered across grid/expanded, shared with the tile
  const cursorTargetRef = useRef({ ...INITIAL_CURSOR })
  const dims = DIMS[state]

  return (
    <motion.div
      className="island"
      initial={false}
      animate={{ left: dims.left, top: dims.top, width: dims.width, height: dims.height, borderRadius: dims.borderRadius }}
      transition={SPRING}
      onClick={() => state === 'compact' && setState('expanded')}
      style={{ cursor: state === 'compact' ? 'pointer' : 'default' }}
    >
      <AnimatePresence>
        {state === 'compact' && (
          <motion.div key="c" className="island__content" {...fade} transition={{ duration: 0.16 }}>
            <CompactContent cursorTargetRef={cursorTargetRef} />
          </motion.div>
        )}
        {state === 'expanded' && (
          <motion.div
            key="e"
            className="island__content"
            {...fade}
            transition={{ duration: 0.22, delay: 0.08 }}
            onClick={(e) => {
              e.stopPropagation()
              setState('compact')
            }}
          >
            <ExpandedContent onOpenGrid={() => setState('grid')} cursorTargetRef={cursorTargetRef} />
          </motion.div>
        )}
        {state === 'grid' && (
          <motion.div
            key="g"
            className="island__content"
            {...fade}
            transition={{ duration: 0.22, delay: 0.08 }}
            onClick={(e) => {
              e.stopPropagation()
              setState('compact')
            }}
          >
            <GenreGrid cursorTargetRef={cursorTargetRef} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
