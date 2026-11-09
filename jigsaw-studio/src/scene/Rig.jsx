import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Plane, Raycaster, Vector3 } from 'three'
import { scatterExtents } from '../puzzle/geometry.js'

const GROUND = new Plane(new Vector3(0, 1, 0), 0)
const DIR = new Vector3(0, 0.74, 0.86).normalize() // the angle we look from
const raycaster = new Raycaster()

/**
 * Frames the whole scatter area inside the part of the window the UI isn't
 * sitting on.
 *
 * Rather than guess a camera distance from the puzzle size, this projects the
 * four corners of the scatter area and binary-searches the distance that just
 * fits them, then slides the look-at point until the content is centred in the
 * free area. That keeps the pieces on screen whatever the image's aspect, the
 * window's shape, or where the dock is - and it is exact rather than tuned.
 */
export function Rig({ puzzle }) {
  const { camera, controls, size } = useThree()
  const shape = `${puzzle.width.toFixed(2)}x${puzzle.height.toFixed(2)}x${size.width}x${size.height}`
  const pending = useRef('')

  useEffect(() => {
    pending.current = shape
  }, [shape])

  // run from the render loop so it waits for OrbitControls to register itself
  useEffect(() => {
    if (pending.current !== shape || !controls) return
    pending.current = ''

    const { width: vw, height: vh } = size
    // keep clear of the masthead, the status line and the dock
    const wide = vw > 760
    const inset = wide
      ? { left: 26, right: 300, top: 74, bottom: 74 }
      : { left: 14, right: 14, top: 74, bottom: vh * 0.5 }
    const box = {
      minX: -1 + (2 * inset.left) / vw,
      maxX: 1 - (2 * inset.right) / vw,
      minY: -1 + (2 * inset.bottom) / vh,
      maxY: 1 - (2 * inset.top) / vh,
    }

    const ext = scatterExtents(puzzle)
    const corners = [
      [-ext.x, -ext.z],
      [ext.x, -ext.z],
      [-ext.x, ext.z],
      [ext.x, ext.z],
    ]
    const target = new Vector3(0, 0, 0)
    const probe = new Vector3()
    const hit = new Vector3()

    const place = (distance) => {
      camera.position.copy(DIR).multiplyScalar(distance).add(target)
      camera.lookAt(target)
      camera.updateMatrixWorld()
    }

    const project = () => {
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const [x, z] of corners) {
        probe.set(x, 0, z).project(camera)
        minX = Math.min(minX, probe.x)
        maxX = Math.max(maxX, probe.x)
        minY = Math.min(minY, probe.y)
        maxY = Math.max(maxY, probe.y)
      }
      return { minX, maxX, minY, maxY }
    }

    // ground point under a given spot in the viewport
    const ground = (ndcX, ndcY) => {
      raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera)
      return raycaster.ray.intersectPlane(GROUND, hit) ? hit.clone() : null
    }

    let distance = 12
    for (let pass = 0; pass < 4; pass++) {
      let lo = 2
      let hi = 90
      for (let i = 0; i < 24; i++) {
        distance = (lo + hi) / 2
        place(distance)
        const p = project()
        const fits =
          p.minX >= box.minX && p.maxX <= box.maxX && p.minY >= box.minY && p.maxY <= box.maxY
        if (fits) hi = distance
        else lo = distance
      }
      distance = hi
      place(distance)
      // slide the target so the content sits in the middle of the free area
      const p = project()
      const from = ground((p.minX + p.maxX) / 2, (p.minY + p.maxY) / 2)
      const to = ground((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2)
      if (!from || !to) break
      // move the camera so the point currently at the box centre gives way to
      // the content's centre
      target.add(from.sub(to))
    }

    place(distance)
    controls.target.copy(target)
    controls.update()
  })

  return null
}
