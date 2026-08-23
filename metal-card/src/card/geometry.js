import * as THREE from 'three'

// A rounded-rectangle Shape centered on the origin (XY plane).
export function roundedRectShape(w, h, r) {
  const shape = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  r = Math.min(r, w / 2, h / 2)
  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.quadraticCurveTo(x + w, y, x + w, y + r)
  shape.lineTo(x + w, y + h - r)
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  shape.lineTo(x + r, y + h)
  shape.quadraticCurveTo(x, y + h, x, y + h - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)
  return shape
}

// The card body: an extruded rounded rectangle with a small bevel so the
// edges catch light. Centered on the origin in all three axes.
export function cardBodyGeometry(w, h, r, depth) {
  const shape = roundedRectShape(w, h, r)
  const bevel = depth * 0.35
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    steps: 1,
    curveSegments: 32,
  })
  geo.center()
  geo.computeVertexNormals()
  return geo
}

// A rectangle with ONLY the top two corners rounded (radius r). Used for the
// back's black strip so it follows the card's rounded top edge instead of
// poking square corners past the silhouette.
export function roundedTopRectGeometry(w, h, r) {
  const x = -w / 2
  const y = -h / 2
  r = Math.min(r, w / 2, h)
  const shape = new THREE.Shape()
  shape.moveTo(x, y)
  shape.lineTo(x + w, y)
  shape.lineTo(x + w, y + h - r)
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  shape.lineTo(x + r, y + h)
  shape.quadraticCurveTo(x, y + h, x, y + h - r)
  shape.lineTo(x, y)
  return new THREE.ShapeGeometry(shape, 24)
}

// A flat rounded-rectangle face with UVs normalized to 0..1 over its bounding
// box, so a card-face texture maps exactly once across the face.
export function cardFaceGeometry(w, h, r) {
  const shape = roundedRectShape(w, h, r)
  const geo = new THREE.ShapeGeometry(shape, 32)
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  const sx = bb.max.x - bb.min.x
  const sy = bb.max.y - bb.min.y
  const pos = geo.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - bb.min.x) / sx
    uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / sy
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}
