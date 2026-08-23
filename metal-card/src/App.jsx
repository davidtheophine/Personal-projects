import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, SMAA } from '@react-three/postprocessing'
import { DialRoot, useDialKit } from 'dialkit'
import 'dialkit/styles.css'
import { easing } from 'maath'
import * as THREE from 'three'
import MetalCard from './card/MetalCard.jsx'
import { CARD, MATERIAL, TILT, POST } from './card/cardConfig.js'
import { useDeviceTilt } from './tilt/useDeviceTilt.js'
import { PermissionButton } from './ui/PermissionButton.jsx'

const query = new URLSearchParams(typeof location !== 'undefined' ? location.search : '')
const START_FLIPPED = query.has('flip')
const START_MATCAP = query.has('matcap')
const START_LIGHT = query.has('light')
const BARE = query.has('bare') // hide the panel + hint for clean captures

// Debounce heavy values (texture regen, env rebuild) so dragging a slider
// doesn't rebuild every intermediate frame.
function useDebounced(value, ms = 200) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

function TiltDamper({ tilt, target, smooth }) {
  useFrame((_, dt) => {
    easing.damp(tilt.current, 'x', target.current.x, smooth, dt)
    easing.damp(tilt.current, 'y', target.current.y, smooth, dt)
  })
  return null
}

// Rotate the image-based lighting from tilt so reflections/streaks/iridescence
// sweep across the card. A slow idle drift keeps it alive with no input.
function EnvRotator({ tilt, amount, idle, idleSpeed }) {
  useFrame((state) => {
    const t = state.clock.elapsedTime
    state.scene.environmentRotation.set(
      -tilt.current.y * amount + Math.sin(t * idleSpeed) * idle,
      tilt.current.x * amount + Math.cos(t * idleSpeed * 0.8) * idle * 1.2,
      0,
    )
  })
  return null
}

function FitCamera({ w = 3.4, h = 2.14, margin = 1.35 }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const fov = (camera.fov * Math.PI) / 180
    const fitH = h * margin * 0.5 / Math.tan(fov / 2)
    const fitW = w * margin * 0.5 / Math.tan(fov / 2) / aspect
    camera.position.set(0, 0, Math.max(fitH, fitW))
    camera.updateProjectionMatrix()
  }, [camera, size, w, h, margin])
  return null
}

function GradientBackdrop({ light }) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 512
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(256, 170, 30, 256, 260, 380)
    const stops = light
      ? ['#fbfcfe', '#e4e8f0', '#c7ccd6']
      : ['#241f1a', '#100d0b', '#060505'] // warm charcoal
    g.addColorStop(0, stops[0])
    g.addColorStop(0.55, stops[1])
    g.addColorStop(1, stops[2])
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 512)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [light])
  return (
    <mesh position={[0, 0, -10]} scale={[46, 30, 1]}>
      <planeGeometry />
      <meshBasicMaterial map={texture} toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

// Studio softbox rig built from area lights (no external HDRI). Keyed by the
// caller on the lighting values so intensity edits rebuild the env map.
function StudioEnv({ light }) {
  return (
    <Environment resolution={512}>
      {/* warm key + soft neutral fill */}
      <Lightformer form="rect" intensity={light.key} color="#fff0da" scale={[12, 6, 1]} position={[0, 5.5, 3]} rotation={[-Math.PI / 2.5, 0, 0]} />
      <Lightformer form="rect" intensity={light.fill} color="#cac4b8" scale={[16, 11, 1]} position={[0, 1, 7]} target={[0, 0, 0]} />
      {/* streak bars: one cool, two warm -> the gold sweep on the metal */}
      <Lightformer form="rect" intensity={light.streak} color="#eaf1ff" scale={[0.45, 13, 1]} position={[-4.5, 1, 3.5]} rotation={[0, Math.PI / 7, 0]} />
      <Lightformer form="rect" intensity={light.streak * 0.9} color="#ffb066" scale={[0.4, 13, 1]} position={[-1.5, -1.5, 3.5]} rotation={[0, Math.PI / 10, 0]} />
      <Lightformer form="rect" intensity={light.streak * 0.8} color="#ffd7a0" scale={[0.35, 13, 1]} position={[4, 2, 3.5]} rotation={[0, -Math.PI / 7, 0]} />
      {/* warm ambient back + a gold rim glint */}
      <Lightformer form="rect" intensity={light.back} color="#6e6153" scale={[16, 16, 1]} position={[0, 0, -7]} />
      <Lightformer form="ring" intensity={light.key * 0.7} color="#ff9d4d" scale={[3, 3, 1]} position={[5.5, 3.5, -1]} />
    </Environment>
  )
}

function Hint() {
  return (
    <div
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 16, textAlign: 'center',
        padding: '0 16px', color: '#7d7f88',
        font: '13px -apple-system, system-ui, sans-serif', letterSpacing: '0.02em',
        pointerEvents: 'none',
      }}
    >
      Move your cursor to sweep the light · click the card to flip · on mobile, tap “Enable motion”
    </div>
  )
}

export default function App() {
  const [flipped, setFlipped] = useState(START_FLIPPED)

  const material = useDialKit('Material', {
    matcap: START_MATCAP,
    color: { type: 'color', default: MATERIAL.color },
    roughness: [MATERIAL.roughness, 0, 1, 0.01],
    anisotropy: [MATERIAL.anisotropy, 0, 1, 0.01],
    anisotropyRotation: [MATERIAL.anisotropyRotation, -Math.PI, Math.PI, 0.01],
    clearcoat: [MATERIAL.clearcoat, 0, 1, 0.01],
    clearcoatRoughness: [MATERIAL.clearcoatRoughness, 0, 1, 0.01],
    envMapIntensity: [MATERIAL.envMapIntensity, 0, 4, 0.05],
    normalScale: [MATERIAL.normalScale, 0, 2, 0.05],
    logoSheen: [0.35, 0, 1, 0.01],
  })

  const texture = useDialKit('Textures', {
    brushStrength: [0.06, 0, 1.5, 0.02], // near-0 = fine sandblast, not brushed
    sandStrength: [0.9, 0, 1.5, 0.02],
    brushDensity: [340, 40, 800, 5],
    embossDepth: [0.7, 0, 1.5, 0.02], // deeper engraved W / VISA
    logoRoughness: [0.14, 0.02, 1, 0.01],
  })

  const bird = useDialKit('Bird (hologram)', {
    holo: [0.9, 0, 2, 0.02],
    chrome: [1.1, 0, 2.5, 0.05],
    hueScale: [1.6, 0.2, 6, 0.1],
    shimmer: [0.05, 0, 0.4, 0.01],
  })

  const light = useDialKit('Lighting', {
    key: [5, 0, 12, 0.1],
    fill: [2.6, 0, 8, 0.1],
    streak: [6, 0, 16, 0.1],
    back: [1.6, 0, 6, 0.1],
  })

  const motion = useDialKit('Motion', {
    tiltStrength: [1, 0, 2, 0.05],
    sweep: [1, 0, 2.5, 0.05],
    parallax: [0.5, 0, 1.5, 0.01],
    follow: [0.1, 0.02, 0.6, 0.01], // lower = snappier / less damped
    flip: [0.18, 0.05, 0.8, 0.01],
    idle: [0.04, 0, 0.25, 0.005],
    idleSpeed: [0.14, 0, 1, 0.01],
  })

  const view = useDialKit('View', {
    zoom: [0.65, 0.4, 1.2, 0.01], // reduce to shrink the card
    lightMode: START_LIGHT, // dark / light background
    chip: true, // show the front chip
  })

  useEffect(() => {
    document.documentElement.style.background = view.lightMode ? '#e9ecf2' : '#050506'
  }, [view.lightMode])

  const post = useDialKit('Post', {
    postFX: POST.postFX,
    bloom: [POST.bloom, 0, 2, 0.05],
    vignette: [POST.vignette, 0, 1.5, 0.05],
  })

  useDialKit('Card', { flipCard: { type: 'action', label: 'Flip card' } }, {
    onAction: (a) => {
      if (a === 'flipCard') setFlipped((f) => !f)
    },
  })

  const { tilt, target } = useDeviceTilt({ strength: motion.tiltStrength })

  // Debounce the values that trigger a rebuild.
  const textureD = useDebounced(texture, 220)
  const lightD = useDebounced(light, 180)
  const envKey = `${lightD.key}|${lightD.fill}|${lightD.streak}|${lightD.back}`

  return (
    <>
      {!BARE && <DialRoot position="top-right" theme={view.lightMode ? 'light' : 'dark'} />}
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 7], fov: 30 }}
        gl={{ alpha: true, antialias: true }}
        style={{ position: 'fixed', inset: 0, display: 'block' }}
      >
        <FitCamera />
        <TiltDamper tilt={tilt} target={target} smooth={motion.follow} />
        <EnvRotator tilt={tilt} amount={motion.sweep} idle={motion.idle} idleSpeed={motion.idleSpeed} />
        <GradientBackdrop light={view.lightMode} />
        <StudioEnv key={envKey} light={lightD} />
        <MetalCard
          tilt={tilt}
          flipped={flipped}
          material={material}
          texture={textureD}
          bird={bird}
          parallax={motion.parallax}
          flipDamp={motion.flip}
          scale={view.zoom}
          showChip={view.chip}
        />
        {/* invisible interaction surface: the card only reacts while the cursor
            is over it; a click flips it. (Card meshes carry no handlers.) */}
        <mesh
          scale={view.zoom}
          onPointerMove={(e) => {
            if (!e.uv) return // tilt by position ON the card (symmetric L/R)
            target.current.x = (e.uv.x * 2 - 1) * motion.tiltStrength
            target.current.y = (1 - e.uv.y * 2) * motion.tiltStrength
          }}
          onPointerOut={() => {
            target.current.x = 0
            target.current.y = 0
          }}
          onClick={() => setFlipped((f) => !f)}
        >
          <planeGeometry args={[CARD.width * 1.06, CARD.height * 1.06]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {post.postFX && (
          <EffectComposer>
            <Bloom intensity={post.bloom} luminanceThreshold={0.65} luminanceSmoothing={0.25} mipmapBlur />
            <Vignette eskil={false} offset={0.28} darkness={post.vignette} />
            <SMAA />
          </EffectComposer>
        )}
      </Canvas>
      {!BARE && <Hint />}
      <PermissionButton />
    </>
  )
}
