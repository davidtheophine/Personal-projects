import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Plane, Vector3 } from 'three'
import { angleDelta, clamp, damp, dampAngle } from '../lib/anim.js'
import { playPiece, playSolved } from '../lib/sfx.js'
import { createPieceMaterial } from '../materials/pieceMaterial.js'
import { PRESETS } from '../materials/presets.js'
import { makeRng } from './edges.js'
import { scatterExtents } from './geometry.js'

const LIFT = 0.55 // how high a held cluster floats above the table
const TABLE = new Plane(new Vector3(0, 1, 0), 0)

const scratch = {
  a: new Vector3(),
  b: new Vector3(),
  c: new Vector3(),
  pa: new Vector3(),
  pb: new Vector3(),
  err: new Vector3(),
  hit: new Vector3(),
  aim: new Vector3(),
}

/** Rotates a vector about +Y. Pieces only ever yaw, so this is the whole of it. */
const rotY = (v, yaw, out) => {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return out.set(v.x * c + v.z * s, v.y, -v.x * s + v.z * c)
}

/**
 * Renders and runs the pieces.
 *
 * Pieces are magnetic: a piece carries a rigid *cluster*, and when a cluster
 * is dragged near a neighbour it belongs to, it is pulled into alignment and
 * clicks on, sparks and all. From then on the two move as one. A cluster is
 * therefore the unit of state - it owns a yaw and an anchor, and each piece's
 * position is derived from where its own cell sits in that cluster:
 *
 *     pos = rotateY(home - clusterCentre, yaw) + anchor
 *
 * which is what keeps a half-built puzzle rigid for free, with no per-piece
 * offsets to drift.
 *
 * Positions are written straight onto the meshes in useFrame; React is only
 * told the things a human would notice, like how many joins have been made.
 */
export function Pieces({
  puzzle,
  texture,
  preset,
  store,
  sound,
  magnet = true,
  randomRotation,
  autoSolve,
  api,
  sparks,
  onProgress,
}) {
  const { camera, raycaster, pointer, controls, scene } = useThree()

  const pieces = useMemo(() => {
    const list = puzzle.pieces.map((p) => ({
      ...p,
      hover: 0,
      hoverTarget: 0,
      spark: 0,
      sparkTarget: 0,
      mesh: null,
      group: null,
    }))
    const byCell = new Map(list.map((p) => [`${p.col},${p.row}`, p]))
    for (const p of list) {
      p.neighbours = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]
        .map(([dc, dr]) => byCell.get(`${p.col + dc},${p.row + dr}`))
        .filter(Boolean)
    }
    return list
  }, [puzzle])

  const materials = useMemo(
    () => pieces.map((p) => createPieceMaterial(preset, { map: texture, store, seed: p.seed })),
    [pieces, preset, texture, store],
  )
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials])

  useLayoutEffect(() => {
    store.uPuzzle.value.set(puzzle.width, puzzle.height)
    store.uThickness.value = puzzle.depth
  }, [puzzle, store])

  const groups = useRef(new Set())
  const drag = useRef(null)
  const nudge = useRef(0) // id source for the tiny y offsets that stop z-fighting
  const cell = Math.min(puzzle.sx, puzzle.sy)
  const snapRadius = cell * 0.4
  const clickRadius = cell * 0.22 // close enough to click together mid-drag
  const magnetRadius = cell * 0.95

  // ---- cluster bookkeeping ------------------------------------------------
  const centreOf = (members, out) => {
    out.set(0, 0, 0)
    for (const p of members) out.add(p.home)
    return out.divideScalar(members.length)
  }

  const makeGroup = useCallback((members) => {
    const group = {
      members,
      yaw: 0,
      targetYaw: 0,
      anchor: new Vector3(),
      centre: new Vector3(),
      lift: 0,
      wobble: 0,
      held: false,
      y: (nudge.current++ % 24) * 0.0015,
    }
    centreOf(members, group.centre)
    group.anchor.copy(group.centre)
    for (const p of members) p.group = group
    return group
  }, [])

  const posOf = (p, out) => {
    const g = p.group
    rotY(scratch.a.subVectors(p.home, g.centre), g.yaw, out)
    return out.add(g.anchor)
  }

  /** Folds `from` into `to`, keeping every piece exactly where it already is. */
  const absorb = (to, from) => {
    const members = to.members.concat(from.members)
    const centre = centreOf(members, scratch.b.clone())
    rotY(scratch.c.subVectors(centre, to.centre), to.yaw, scratch.a)
    to.anchor.add(scratch.a)
    to.centre.copy(centre)
    for (const p of from.members) p.group = to
    to.members = members
    groups.current.delete(from)
    return to
  }

  /**
   * The best available join for a cluster: the neighbour pairing whose pieces
   * are closest to sitting correctly next to each other.
   */
  const findLink = (g) => {
    let best = null
    for (const p of g.members) {
      for (const q of p.neighbours) {
        const h = q.group
        if (h === g) continue
        if (Math.abs(angleDelta(g.yaw, h.yaw)) > 0.4) continue
        posOf(p, scratch.pa)
        posOf(q, scratch.pb)
        rotY(scratch.a.subVectors(p.home, q.home), h.yaw, scratch.c)
        scratch.err.subVectors(scratch.pa, scratch.pb).sub(scratch.c)
        const d = Math.hypot(scratch.err.x, scratch.err.z)
        // scalars, not a cloned vector: this runs every frame of every drag
        if (!best || d < best.d) best = { d, ex: scratch.err.x, ez: scratch.err.z, host: h, a: p, b: q }
      }
    }
    return best
  }

  const flash = (piece, other, power) => {
    posOf(piece, scratch.pa)
    posOf(other, scratch.pb)
    // fire from the seam itself, just clear of whichever piece is higher -
    // emitting below the slab would just hide the sparks under it
    const y = Math.max(piece.group.lift, other.group.lift) + puzzle.depth + 0.03
    // the joint runs across the line between the two centres
    const dx = scratch.pa.x - scratch.pb.x
    const dz = scratch.pa.z - scratch.pb.z
    const len = Math.hypot(dx, dz) || 1
    sparks.current.burst?.(
      (scratch.pa.x + scratch.pb.x) / 2,
      y,
      (scratch.pa.z + scratch.pb.z) / 2,
      {
        count: 26 + Math.round(20 * power),
        power: 0.85 + power * 0.55,
        seam: [-dz / len, dx / len],
        length: len * 0.8,
      },
    )
    piece.spark = 1
    other.spark = 1
  }

  const report = useCallback(() => {
    const joined = pieces.length - groups.current.size
    onProgress?.(joined)
    return joined
  }, [pieces.length, onProgress])

  /** Snaps g onto its neighbour's lattice and welds the two together. */
  const join = (g, best, loud = true) => {
    g.anchor.x -= best.ex
    g.anchor.z -= best.ez
    g.yaw = best.host.yaw
    g.targetYaw = best.host.targetYaw
    const held = g.held || best.host.held
    const lift = Math.max(g.lift, best.host.lift)
    const merged = absorb(best.host, g)
    merged.wobble = 1
    merged.held = held
    merged.lift = lift // don't let the cluster dip when it takes on a piece
    if (loud) {
      flash(best.a, best.b, Math.min(1, merged.members.length / 6))
      playPiece(preset, 'snap', sound)
    }
    if (report() === pieces.length - 1) {
      playSolved(sound)
      for (const p of merged.members.slice(0, 26)) {
        posOf(p, scratch.pa)
        sparks.current.burst?.(scratch.pa.x, merged.lift + puzzle.depth + 0.04, scratch.pa.z, {
          count: 8,
          color: '#bfe4ff',
          power: 1.3,
        })
      }
    }
    return merged
  }

  // ---- verbs --------------------------------------------------------------
  const scatter = useCallback(
    (spread = 1) => {
      const rng = makeRng((Math.random() * 1e9) | 0)
      const { width, height } = puzzle
      const ext = scatterExtents(puzzle)
      groups.current.clear()
      nudge.current = 0
      for (const p of pieces) {
        const g = makeGroup([p])
        let x = 0
        let z = 0
        for (let i = 0; i < 60; i++) {
          x = (rng() - 0.5) * 2 * ext.x * spread
          z = (rng() - 0.5) * 2 * ext.z * spread
          if (!(Math.abs(x) < width / 2 + 0.7 && Math.abs(z) < height / 2 + 0.7)) break
        }
        g.anchor.set(x, 0, z)
        g.yaw = g.targetYaw = randomRotation ? Math.floor(rng() * 4) * (Math.PI / 2) : 0
        g.wobble = 0.5
        groups.current.add(g)
      }
      drag.current = null
      report()
    },
    [pieces, puzzle, randomRotation, makeGroup, report],
  )

  const solve = useCallback(
    (loud = true) => {
      groups.current.clear()
      nudge.current = 0
      const g = makeGroup(pieces.slice())
      g.anchor.copy(g.centre)
      g.yaw = g.targetYaw = 0
      g.wobble = 0.8
      g.y = 0
      groups.current.add(g)
      drag.current = null
      report()
      if (loud) playSolved(sound)
    },
    [pieces, makeGroup, report, sound],
  )

  const verbs = useRef(null)
  verbs.current = { scatter, solve }
  api.current = verbs.current // the toolbar calls straight through
  // useLayoutEffect, not useEffect: r3f's render loop can fire between commit
  // and a passive effect, and a frame with ungrouped pieces would throw.
  useLayoutEffect(() => {
    if (autoSolve) verbs.current.solve(false)
    else verbs.current.scatter()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces])

  // A handle for driving the puzzle from a script (see scripts/snap-shot.mjs).
  // Stripped from production builds.
  if (import.meta.env.DEV) {
    window.__jigsaw = { pieces, groups: groups.current, posOf, camera, scene, puzzle }
  }

  // ---- pointer + keyboard -------------------------------------------------
  const release = useCallback(() => {
    const held = drag.current
    drag.current = null
    if (controls) controls.enabled = true
    document.body.style.cursor = ''
    if (!held) return
    let g = held.group
    g.held = false

    const best = findLink(g)
    if (best && best.d < snapRadius) {
      g = join(g, best)
      g.held = false
      return
    }
    // or drop into the tray, if the cluster is close to where it belongs
    const home = Math.abs(angleDelta(g.yaw, Math.round(g.yaw / (Math.PI * 2)) * Math.PI * 2)) < 0.4
    if (home && g.anchor.distanceTo(g.centre) < snapRadius) {
      g.anchor.copy(g.centre)
      g.targetYaw = Math.round(g.yaw / (Math.PI * 2)) * Math.PI * 2
      g.y = 0
      g.wobble = 1
      playPiece(preset, 'snap', sound)
      return
    }
    g.wobble = 0.65
    playPiece(preset, 'drop', sound)
  }, [controls, preset, sound, snapRadius])

  useEffect(() => {
    const onKey = (e) => {
      const g = drag.current?.group
      if (!g) return
      if (e.key === 'r' || e.key === 'R') g.targetYaw += Math.PI / 2
      if (e.key === 'q' || e.key === 'Q') g.targetYaw -= Math.PI / 2
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('keydown', onKey)
    }
  }, [release])

  const grab = (event, piece) => {
    if (event.button !== undefined && event.button !== 0) return
    event.stopPropagation()
    // The grab point is taken on the tabletop and dragging keeps using the
    // tabletop: the cluster rises visually but stays glued to the cursor.
    if (!event.ray.intersectPlane(TABLE, scratch.hit)) return
    const group = piece.group
    group.held = true
    // a cluster lifted back out of the tray needs its anti-z-fight offset again
    group.y = group.y || 0.0015
    drag.current = { group, off: new Vector3().subVectors(group.anchor, scratch.hit).setY(0) }
    if (controls) controls.enabled = false
    document.body.style.cursor = 'grabbing'
  }

  // ---- per-frame ----------------------------------------------------------
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    store.uTime.value = state.clock.elapsedTime

    for (const p of pieces) p.sparkTarget = 0

    const held = drag.current
    let velX = 0
    let velZ = 0
    if (held) {
      const g = held.group
      raycaster.setFromCamera(pointer, camera)
      if (raycaster.ray.intersectPlane(TABLE, scratch.hit)) {
        scratch.aim.copy(scratch.hit).add(held.off)
        velX = scratch.aim.x - g.anchor.x
        velZ = scratch.aim.z - g.anchor.z
        g.anchor.lerp(scratch.aim, 1 - Math.exp(-24 * dt))
      }

      if (magnet) {
        const best = findLink(g)
        if (best && best.d < magnetRadius) {
          // close enough to feel the pull, and the two candidate pieces glow
          best.a.sparkTarget = 0.35
          best.b.sparkTarget = 0.35
          if (best.d < clickRadius) {
            const merged = join(g, best)
            // keep dragging what is now one bigger cluster
            held.group = merged
            held.off.subVectors(merged.anchor, scratch.hit).setY(0)
          } else {
            const t = clamp((magnetRadius - best.d) / (magnetRadius - clickRadius), 0, 1)
            const k = 1 - Math.exp(-14 * t * t * dt)
            g.anchor.x -= best.ex * k
            g.anchor.z -= best.ez * k
          }
        } else if (
          Math.abs(angleDelta(g.yaw, Math.round(g.yaw / (Math.PI * 2)) * Math.PI * 2)) < 0.4
        ) {
          // the tray is magnetic too
          const d = g.anchor.distanceTo(g.centre)
          if (d < magnetRadius) {
            const t = clamp((magnetRadius - d) / magnetRadius, 0, 1)
            g.anchor.lerp(g.centre, 1 - Math.exp(-10 * t * t * dt))
          }
        }
      }
    }

    const squash = PRESETS[preset].wobble ?? 0
    for (const g of groups.current) {
      g.lift = damp(g.lift, g.held ? LIFT : 0, 12, dt)
      g.yaw = dampAngle(g.yaw, g.targetYaw, 10, dt)
      g.wobble = Math.max(0, g.wobble - dt * 2.4)
    }

    for (const p of pieces) {
      const mesh = p.mesh
      const g = p.group
      if (!mesh || !g) continue
      posOf(p, scratch.pa)

      p.hover = damp(p.hover, g.held ? 1 : p.hoverTarget, 10, dt)
      p.spark = Math.max(damp(p.spark, 0, 4.5, dt), p.sparkTarget)

      // a held cluster leans into the drag, like something with mass
      const tiltX = g.held ? clamp(-velZ * 1.1, -0.26, 0.26) : 0
      const tiltZ = g.held ? clamp(velX * 1.1, -0.26, 0.26) : 0
      p.tiltX = damp(p.tiltX ?? 0, tiltX, 9, dt)
      p.tiltZ = damp(p.tiltZ ?? 0, tiltZ, 9, dt)

      mesh.position.set(scratch.pa.x, g.lift + g.y, scratch.pa.z)
      mesh.rotation.set(p.tiltX, g.yaw, p.tiltZ)
      const w = g.wobble * squash
      mesh.scale.set(1 + w * 0.1, 1 - w * 0.22, 1 + w * 0.1)
      const u = mesh.material.userData
      u.uPiece.value.set(p.seed, g.wobble, p.hover * (g.held ? 0.85 : 0.5), g.yaw)
      u.uSpark.value = p.spark
    }
  })

  return (
    <group>
      {pieces.map((p, i) => (
        <mesh
          key={p.id}
          ref={(m) => {
            p.mesh = m
            if (m) m.rotation.order = 'YXZ'
          }}
          geometry={p.geometry}
          material={materials[i]}
          castShadow
          receiveShadow
          onPointerDown={(e) => grab(e, p)}
          onPointerOver={() => {
            p.hoverTarget = 1
            if (!drag.current) document.body.style.cursor = 'grab'
          }}
          onPointerOut={() => {
            p.hoverTarget = 0
            if (!drag.current) document.body.style.cursor = ''
          }}
        />
      ))}
    </group>
  )
}
