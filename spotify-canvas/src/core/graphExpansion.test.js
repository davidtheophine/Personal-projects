import { describe, it, expect } from 'vitest'
import { expand } from './graphExpansion.js'

// Deterministic fake provider (mirrors the real getSimilar contract: excludes the
// source + excludeSongIds, preserves order, caps at count) so these tests isolate
// expansion logic from the diversity math.
function fakeProvider(adj) {
  return {
    getSimilar(fromId, { count = 5, excludeSongIds = [] } = {}) {
      const ex = new Set([fromId, ...excludeSongIds])
      return (adj[fromId] || [])
        .filter((id) => !ex.has(id))
        .slice(0, count)
        .map((id) => ({ id }))
    },
  }
}

const node = (id, position, parentId = null) => ({ id, songId: id, position, parentId })
const pairKey = (e) => [e.source, e.target].sort().join('-')
const geom = { radius: 100, arcRad: Math.PI / 2 }

describe('expand', () => {
  it('fans out `count` new nodes + edges from a fresh seed', () => {
    const provider = fakeProvider({ s1: ['s2', 's3', 's4', 's5', 's6', 's7'] })
    const graph = { nodes: [node('s1', { x: 0, y: 0 })], edges: [] }

    const { newNodes, newEdges } = expand(graph, 's1', provider, { count: 5, ...geom })

    expect(newNodes.map((n) => n.id)).toEqual(['s2', 's3', 's4', 's5', 's6'])
    newNodes.forEach((n) => {
      expect(n.parentId).toBe('s1')
      expect(Math.hypot(n.position.x, n.position.y)).toBeCloseTo(100)
    })
    expect(newEdges.map(pairKey).sort()).toEqual(['s1-s2', 's1-s3', 's1-s4', 's1-s5', 's1-s6'])
  })

  it('links to an existing card instead of duplicating when unseen neighbors run out', () => {
    const provider = fakeProvider({ s1: ['s2', 's3'] }) // only 2 neighbors
    const graph = {
      nodes: [node('s1', { x: 0, y: 0 }), node('s3', { x: 50, y: 50 })], // s3 already on canvas
      edges: [],
    }

    const { newNodes, newEdges } = expand(graph, 's1', provider, { count: 5, ...geom })

    // s3 is NOT duplicated as a new node...
    expect(newNodes.map((n) => n.id)).toEqual(['s2'])
    // ...but a new edge links s1 to the existing s3 (plus the edge to the new s2)
    expect(newEdges.map(pairKey).sort()).toEqual(['s1-s2', 's1-s3'])
  })

  it('does not re-add an edge that already exists (dedup, either direction)', () => {
    const provider = fakeProvider({ s1: ['s2', 's3'] })
    const graph = {
      nodes: [node('s1', { x: 0, y: 0 }), node('s3', { x: 50, y: 50 })],
      edges: [{ id: 's1__s3', source: 's3', target: 's1' }], // pre-existing, reversed
    }

    const { newNodes, newEdges } = expand(graph, 's1', provider, { count: 5, ...geom })

    expect(newNodes.map((n) => n.id)).toEqual(['s2'])
    expect(newEdges.map(pairKey)).toEqual(['s1-s2']) // s1-s3 NOT re-added
  })

  it('returns nothing for an unknown source node', () => {
    const provider = fakeProvider({ s1: ['s2'] })
    const graph = { nodes: [node('s1', { x: 0, y: 0 })], edges: [] }
    expect(expand(graph, 'ghost', provider, { count: 5, ...geom })).toEqual({
      newNodes: [],
      newEdges: [],
    })
  })

  it('grows a child\'s children outward, away from its own parent', () => {
    const provider = fakeProvider({ s2: ['s8', 's9', 's10'] })
    const graph = {
      nodes: [node('s1', { x: 0, y: 0 }), node('s2', { x: 100, y: 0 }, 's1')],
      edges: [{ id: 's1__s2', source: 's1', target: 's2' }],
    }

    const { newNodes } = expand(graph, 's2', provider, { count: 3, ...geom })

    // outward from s1->s2 is +x, so every grandchild sits further out than s2
    newNodes.forEach((n) => expect(n.position.x).toBeGreaterThan(100))
  })
})
