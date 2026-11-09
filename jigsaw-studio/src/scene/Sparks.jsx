import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color } from 'three'

const MAX = 420
const GRAVITY = -7.5
const DRAG = 2.4

/**
 * A single pooled Points cloud for every spark in the scene.
 *
 * Particles are stepped on the CPU - at a few hundred of them that is cheaper
 * than the bookkeeping a GPU simulation would need, and it keeps the burst API
 * a plain function call from the snap handler.
 */
export function Sparks({ api }) {
  const state = useMemo(() => {
    const position = new Float32Array(MAX * 3)
    const color = new Float32Array(MAX * 3)
    const life = new Float32Array(MAX)
    const size = new Float32Array(MAX)
    const vel = new Float32Array(MAX * 3)
    const decay = new Float32Array(MAX)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(position, 3))
    geometry.setAttribute('aColor', new BufferAttribute(color, 3))
    geometry.setAttribute('aLife', new BufferAttribute(life, 1))
    geometry.setAttribute('aSize', new BufferAttribute(size, 1))
    geometry.boundingSphere = null
    return { geometry, position, color, life, size, vel, decay, cursor: 0, alive: 0 }
  }, [])

  useEffect(() => () => state.geometry.dispose(), [state])

  const tint = useMemo(() => new Color(), [])

  /**
   * @param seam  optional [dx, dz] unit vector along which to spread the
   *              burst, with `length` - a snap sprays along the joint, not
   *              out of a single point.
   */
  api.current.burst = (
    x,
    y,
    z,
    { count = 26, color = '#ffd79a', power = 1, seam = null, length = 0 } = {},
  ) => {
    tint.set(color)
    for (let i = 0; i < count; i++) {
      const n = state.cursor
      state.cursor = (state.cursor + 1) % MAX
      const along = seam ? (Math.random() - 0.5) * length : 0
      const a = Math.random() * Math.PI * 2
      const speed = (0.9 + Math.random() * 2.6) * power
      // sideways kick is across the joint, so the spray straddles the seam
      const kick = (Math.random() - 0.5) * 2.4 * power
      state.position[n * 3] = x + (seam ? seam[0] * along : 0) + (Math.random() - 0.5) * 0.05
      state.position[n * 3 + 1] = y + Math.random() * 0.04
      state.position[n * 3 + 2] = z + (seam ? seam[1] * along : 0) + (Math.random() - 0.5) * 0.05
      state.vel[n * 3] = seam ? -seam[1] * kick + Math.cos(a) * speed * 0.35 : Math.cos(a) * speed
      state.vel[n * 3 + 1] = (0.5 + Math.random() * 1.7) * power
      state.vel[n * 3 + 2] = seam ? seam[0] * kick + Math.sin(a) * speed * 0.35 : Math.sin(a) * speed
      const hot = Math.random()
      state.color[n * 3] = tint.r + hot * 0.5
      state.color[n * 3 + 1] = tint.g + hot * 0.4
      state.color[n * 3 + 2] = tint.b + hot * 0.3
      state.life[n] = 1
      state.decay[n] = 1.1 + Math.random() * 1.5
      state.size[n] = (1.1 + Math.random() * 2.2) * power
    }
    state.alive = MAX
  }

  if (import.meta.env.DEV) window.__sparks = { api: api.current, state }

  useFrame((_, delta) => {
    if (state.alive === 0) return
    const dt = Math.min(delta, 0.05)
    const damp = Math.exp(-DRAG * dt)
    let alive = 0
    for (let n = 0; n < MAX; n++) {
      const l = state.life[n]
      if (l <= 0) continue
      const next = l - state.decay[n] * dt
      state.life[n] = next > 0 ? next : 0
      if (next <= 0) continue
      alive++
      const i = n * 3
      state.vel[i] *= damp
      state.vel[i + 1] = state.vel[i + 1] * damp + GRAVITY * dt
      state.vel[i + 2] *= damp
      state.position[i] += state.vel[i] * dt
      state.position[i + 1] += state.vel[i + 1] * dt
      state.position[i + 2] += state.vel[i + 2] * dt
      if (state.position[i + 1] < 0.01) {
        // skitter along the table instead of sinking through it
        state.position[i + 1] = 0.01
        state.vel[i + 1] *= -0.35
      }
    }
    state.alive = alive
    state.geometry.attributes.position.needsUpdate = true
    state.geometry.attributes.aLife.needsUpdate = true
    state.geometry.attributes.aColor.needsUpdate = true
    state.geometry.attributes.aSize.needsUpdate = true
  })

  return (
    <points geometry={state.geometry} frustumCulled={false} renderOrder={10}>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        vertexShader={/* glsl */ `
          attribute float aLife;
          attribute float aSize;
          attribute vec3 aColor;
          varying float vLife;
          varying vec3 vColor;
          void main() {
            vLife = aLife;
            vColor = aColor;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (170.0 / max(-mv.z, 0.1)) * (0.3 + 0.7 * aLife);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={/* glsl */ `
          varying float vLife;
          varying vec3 vColor;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            // a hot core with a soft halo - additive blending does the rest
            float halo = smoothstep(0.5, 0.0, d);
            float core = pow(halo, 6.0);
            float a = (halo * 0.45 + core) * (0.25 + 0.75 * vLife);
            if (a <= 0.002) discard;
            gl_FragColor = vec4(vColor * (0.7 + 2.2 * vLife) + core * vLife, a);
          }
        `}
      />
    </points>
  )
}
