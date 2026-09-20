import { fanOutPositions, outwardAngle } from './layout.js'

// "Give me more" expansion. Pure and platform-neutral: it takes a plain graph
// snapshot and returns plain node/edge data, so the Expo port reuses it as-is.
//
// Repeat handling (the user's choice): one node per song. Prefer songs not yet on
// the canvas; only when a node's unseen neighbors run out do we reach for songs
// already present — and those get a NEW EDGE to the EXISTING card rather than a
// duplicate node. That's what turns the tree into an interconnected "web of music."

const DEFAULT_SEED_ANGLE = -Math.PI / 2 // first fan points upward
const DEFAULT_RADIUS = 280
const DEFAULT_ARC = (2 * Math.PI) / 3 // 120°

/** Canonical, direction-independent edge id so a pair is never double-linked. */
export function edgeKey(a, b) {
  return [a, b].sort().join('__')
}

/**
 * @param {{nodes:Array<{id,songId,position,parentId}>, edges:Array<{id,source,target}>}} graph
 * @param {string} sourceNodeId
 * @param {{getSimilar:Function}} provider
 * @param {{count?:number, radius?:number, arcRad?:number, seedBaseAngle?:number}} [opts]
 * @returns {{newNodes:Array, newEdges:Array}}
 */
export function expand(graph, sourceNodeId, provider, opts = {}) {
  const {
    count = 5,
    radius = DEFAULT_RADIUS,
    arcRad = DEFAULT_ARC,
    seedBaseAngle = DEFAULT_SEED_ANGLE,
  } = opts

  const source = graph.nodes.find((n) => n.id === sourceNodeId)
  if (!source) return { newNodes: [], newEdges: [] }

  const onCanvas = new Set(graph.nodes.map((n) => n.songId))

  // Prefer unseen songs...
  const unseen = provider.getSimilar(source.songId, { count, excludeSongIds: [...onCanvas] })
  // ...only backfill from already-seen neighbors if the unseen pool is too small.
  let selected = unseen
  if (unseen.length < count) {
    const fillers = provider.getSimilar(source.songId, {
      count: count - unseen.length,
      excludeSongIds: unseen.map((s) => s.id),
    })
    selected = [...unseen, ...fillers]
  }

  // Dedupe, drop the source, cap at count.
  const picked = new Set()
  selected = selected
    .filter((s) => {
      if (s.id === source.songId || picked.has(s.id)) return false
      picked.add(s.id)
      return true
    })
    .slice(0, count)

  // Grow children away from where the source itself came from.
  let baseAngle = seedBaseAngle
  if (source.parentId) {
    const parent = graph.nodes.find((n) => n.id === source.parentId)
    if (parent) baseAngle = outwardAngle(parent.position, source.position)
  }

  const newSongs = selected.filter((s) => !onCanvas.has(s.id))
  const positions = fanOutPositions(source.position, newSongs.length, { radius, arcRad, baseAngle })
  const newNodes = newSongs.map((s, i) => ({
    id: s.id,
    songId: s.id,
    position: positions[i],
    parentId: source.id,
  }))

  const existingEdgeIds = new Set(graph.edges.map((e) => e.id))
  const addedKeys = new Set()
  const newEdges = []
  for (const s of selected) {
    const id = edgeKey(source.songId, s.id)
    if (existingEdgeIds.has(id) || addedKeys.has(id)) continue
    addedKeys.add(id)
    newEdges.push({ id, source: source.songId, target: s.id })
  }

  return { newNodes, newEdges }
}
