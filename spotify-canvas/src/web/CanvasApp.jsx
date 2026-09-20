import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { nodeTypes } from './nodeTypes.js'
import { edgeTypes } from './graph/floatingEdge.jsx'
import { CanvasContext } from './CanvasContext.js'
import LikedTray from './LikedTray.jsx'
import { catalog } from '../data/catalog.js'
import { createCuratedProvider } from '../core/recommendation/curatedGraphProvider.js'
import { createSimulatedController } from '../core/playback/simulatedController.js'
import { createLocalSaveStore } from '../core/save/SaveStore.js'
import { expand } from '../core/graphExpansion.js'
import { SEED_SONG_ID, FAN, FAN_COUNT, VIEWPORT } from '../core/config.js'

const songById = new Map(catalog.map((s) => [s.id, s]))
const CARD_HALF = { x: 104, y: 98 } // to center the viewport on a card's middle

const toRfNode = (n, enterIndex = 0) => ({
  id: n.id,
  type: 'songCard',
  position: n.position,
  data: { song: songById.get(n.songId), songId: n.songId, parentId: n.parentId, enterIndex },
})
const toRfEdge = (e) => ({ id: e.id, source: e.source, target: e.target, type: 'floating', animated: true })

const seedNodes = () => [
  toRfNode({ id: SEED_SONG_ID, songId: SEED_SONG_ID, position: { x: 0, y: 0 }, parentId: null }),
]

export default function CanvasApp() {
  const provider = useMemo(() => createCuratedProvider(catalog), [])
  const controller = useMemo(() => createSimulatedController(), [])
  const saveStore = useMemo(() => createLocalSaveStore(window.localStorage), [])

  const [nodes, setNodes, onNodesChange] = useNodesState(seedNodes())
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const rf = useReactFlow()

  const centerOnSeed = useCallback(
    (inst, duration) =>
      inst.setCenter(CARD_HALF.x, CARD_HALF.y, { zoom: VIEWPORT.initialZoom, duration }),
    [],
  )

  const onMore = useCallback(
    (songId) => {
      const rfNodes = rf.getNodes()
      const graph = {
        nodes: rfNodes.map((n) => ({
          id: n.id,
          songId: n.data.songId,
          position: n.position,
          parentId: n.data.parentId,
        })),
        edges: rf.getEdges().map((e) => ({ id: e.id, source: e.source, target: e.target })),
      }

      const { newNodes, newEdges } = expand(graph, songId, provider, {
        count: FAN_COUNT,
        radius: FAN.radius,
        arcRad: FAN.arcRad,
      })

      if (newNodes.length) rf.addNodes(newNodes.map((n, i) => toRfNode(n, i)))
      if (newEdges.length) rf.addEdges(newEdges.map(toRfEdge))

      // Pan to frame the source + its new fan, preserving the user's zoom.
      const source = rfNodes.find((n) => n.id === songId)
      const framed = [source, ...newNodes].filter(Boolean)
      if (framed.length) {
        const cx = framed.reduce((a, n) => a + n.position.x + CARD_HALF.x, 0) / framed.length
        const cy = framed.reduce((a, n) => a + n.position.y + CARD_HALF.y, 0) / framed.length
        rf.setCenter(cx, cy, { zoom: rf.getViewport().zoom, duration: VIEWPORT.panMs })
      }
    },
    [rf, provider],
  )

  const onPlayToggle = useCallback((song) => controller.toggle(song), [controller])

  const reset = useCallback(() => {
    controller.stop()
    setEdges([])
    setNodes(seedNodes())
    requestAnimationFrame(() => centerOnSeed(rf, VIEWPORT.panMs))
  }, [controller, setEdges, setNodes, rf, centerOnSeed])

  const ctx = useMemo(
    () => ({ controller, saveStore, onMore, onPlayToggle }),
    [controller, saveStore, onMore, onPlayToggle],
  )

  return (
    <CanvasContext.Provider value={ctx}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'floating', animated: true }}
        onInit={(inst) => centerOnSeed(inst, 0)}
        minZoom={0.2}
        maxZoom={1.6}
        nodesConnectable={false}
        zoomOnDoubleClick={false}
        panOnScroll
        proOptions={{ hideAttribution: false }}
        className="discovery-canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1.6} color="rgba(255,255,255,0.06)" />
        <Controls showInteractive={false} position="bottom-right" />
        <MiniMap pannable zoomable nodeColor={() => '#1db954'} maskColor="rgba(6,6,8,0.7)" />

        <Panel position="top-left" className="brand-panel">
          <div className="brand">
            <span className="brand-dot" />
            Canvas
          </div>
          <p className="brand-sub">
            Start at a song, hit <strong>More</strong>, and wander a web of music.
          </p>
        </Panel>

        <Panel position="top-right" className="status-panel">
          <span className="status-chip" title="Real full-track playback via Spotify is the next layer">
            <span className="status-dot" />
            Preview · simulated audio
          </span>
          <button className="reset-btn nodrag" onClick={reset}>
            Reset
          </button>
        </Panel>

        <Panel position="bottom-left" className="tray-panel">
          <LikedTray saveStore={saveStore} onPlay={onPlayToggle} songById={songById} />
        </Panel>
      </ReactFlow>
    </CanvasContext.Provider>
  )
}
