import { Position } from '@xyflow/react'

// Floating-edge geometry (adapted from React Flow's floating-edges example):
// find where the straight line between two node centers crosses each node's
// rectangle, so edges connect border-to-border from ANY direction — right for a
// radial "web" where fixed top/bottom handles would route awkwardly.

function getNodeIntersection(intersectionNode, targetNode) {
  const { width, height } = intersectionNode.measured
  const ipos = intersectionNode.internals.positionAbsolute
  const tpos = targetNode.internals.positionAbsolute

  const w = width / 2
  const h = height / 2
  const x2 = ipos.x + w
  const y2 = ipos.y + h
  const x1 = tpos.x + targetNode.measured.width / 2
  const y1 = tpos.y + targetNode.measured.height / 2

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h)
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h)
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1)
  const xx3 = a * xx1
  const yy3 = a * yy1

  return { x: w * (xx3 + yy3) + x2, y: h * (-xx3 + yy3) + y2 }
}

function getEdgePosition(node, point) {
  const pos = node.internals.positionAbsolute
  const nx = Math.round(pos.x)
  const ny = Math.round(pos.y)
  const px = Math.round(point.x)
  const py = Math.round(point.y)
  if (px <= nx + 1) return Position.Left
  if (px >= nx + node.measured.width - 1) return Position.Right
  if (py <= ny + 1) return Position.Top
  if (py >= ny + node.measured.height - 1) return Position.Bottom
  return Position.Top
}

export function getEdgeParams(source, target) {
  const sp = getNodeIntersection(source, target)
  const tp = getNodeIntersection(target, source)
  return {
    sx: sp.x,
    sy: sp.y,
    tx: tp.x,
    ty: tp.y,
    sourcePos: getEdgePosition(source, sp),
    targetPos: getEdgePosition(target, tp),
  }
}
