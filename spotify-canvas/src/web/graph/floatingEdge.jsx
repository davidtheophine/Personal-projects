import { getBezierPath, useInternalNode } from '@xyflow/react'
import { getEdgeParams } from './edgeGeometry.js'

// Center-to-center curved edge that anchors to each card's border.
function FloatingEdge({ id, source, target, markerEnd, style }) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  if (!sourceNode || !targetNode) return null // not measured yet

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode)
  const [path] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    targetX: tx,
    targetY: ty,
    curvature: 0.35,
  })

  return <path id={id} className="react-flow__edge-path" d={path} style={style} markerEnd={markerEnd} />
}

// Module-level map (never inline in render).
export const edgeTypes = { floating: FloatingEdge }
