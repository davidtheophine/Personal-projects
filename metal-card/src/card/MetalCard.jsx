import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { easing } from 'maath'
import { cardBodyGeometry, cardFaceGeometry, roundedTopRectGeometry } from './geometry.js'
import {
  makeCardMaps,
  makeBrushedMatcap,
  makeChromeMatcap,
  makeChipMaps,
  makeEtchMaps,
} from './proceduralMaps.js'
import { CARD, MATERIAL } from './cardConfig.js'

// Placement on the card (local units), tuned against the references.
const BIRD = { w: 0.42, h: 0.54, x: 1.42, y: 0.24 } // back, upper-left (aligned with text)
const CHIP = { w: 0.46, h: 0.36, x: -0.86, y: 0.16 } // front, left
const STRIP_H = CARD.height * 0.22 // glossy black strip across the back top

const HOLO_VERT = /* glsl */ `
  varying vec3 vNormalV;
  varying vec2 vUv;
  void main() {
    vUv = vec2(1.0 - uv.x, uv.y); // face inward after the plane's Y-flip
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const HOLO_FRAG = /* glsl */ `
  uniform sampler2D uMatcap;
  uniform sampler2D uMask;
  uniform float uTime, uHolo, uChrome, uHueScale, uShimmer;
  varying vec3 vNormalV;
  varying vec2 vUv;
  vec3 hue2rgb(float h) {
    vec3 p = abs(fract(vec3(h) + vec3(0.0, 0.6667, 0.3333)) * 6.0 - 3.0);
    return clamp(p - 1.0, 0.0, 1.0);
  }
  void main() {
    float mask = texture2D(uMask, vUv).a;
    if (mask < 0.08) discard;
    vec3 n = normalize(vNormalV);
    // fake a little curvature so the chrome isn't a flat sample on the plane
    vec2 muv = clamp(n.xy * 0.5 + 0.5 + (vUv - 0.5) * 0.6, 0.0, 1.0);
    vec3 chrome = texture2D(uMatcap, muv).rgb * uChrome;
    float fres = pow(1.0 - clamp(abs(n.z), 0.0, 1.0), 2.0);
    // smooth spatial rainbow that sweeps as the card tilts
    float hue = fract(vUv.x * uHueScale + vUv.y * uHueScale * 0.7 + (n.x - n.y) * 1.5 + fres + uTime * uShimmer);
    vec3 rainbow = hue2rgb(hue);
    vec3 col = chrome + rainbow * uHolo * (0.3 + 0.7 * fres);
    gl_FragColor = vec4(col, mask);
  }
`

// The portable core: geometry + per-face materials + chip + holographic dove +
// flip/tilt/zoom. `tilt` is a ref mutated each frame by the app shell, so
// motion never triggers React re-renders. `texture` is debounced upstream.
export default function MetalCard({
  tilt,
  flipped,
  material,
  texture,
  bird,
  parallax = 0.5,
  flipDamp = 0.18,
  scale = 1,
  showChip = true,
  onFlip,
}) {
  const group = useRef()

  const geoBody = useMemo(
    () => cardBodyGeometry(CARD.width, CARD.height, CARD.radius, CARD.depth),
    [],
  )
  const geoFace = useMemo(
    () =>
      cardFaceGeometry(
        CARD.width - CARD.inset,
        CARD.height - CARD.inset,
        CARD.radius - CARD.inset * 0.5,
      ),
    [],
  )
  const geoStrip = useMemo(
    () => roundedTopRectGeometry(CARD.width - CARD.inset, STRIP_H, CARD.radius - CARD.inset * 0.5),
    [],
  )

  // Rebuild the maps only when a texture param changes (debounced upstream).
  const maps = useMemo(() => {
    const t = {
      brushStrength: texture.brushStrength,
      sandStrength: texture.sandStrength,
      brushFreqY: texture.brushDensity,
      embossDepth: texture.embossDepth,
      logoRough: texture.logoRoughness,
    }
    return {
      body: makeCardMaps({ face: 'body', ...t }),
      front: makeCardMaps({ face: 'front', ...t }),
      back: makeCardMaps({ face: 'back', ...t }),
    }
  }, [
    texture.brushStrength,
    texture.sandStrength,
    texture.brushDensity,
    texture.embossDepth,
    texture.logoRoughness,
  ])

  const matcap = useMemo(() => makeBrushedMatcap(), [])

  // Holographic dove: a shape-masked plane shaded by a procedural chrome +
  // rainbow fragment shader (no static iridescence image).
  const birdMat = useMemo(() => {
    const mask = new THREE.TextureLoader().load('/logos/bird.png')
    mask.colorSpace = THREE.SRGBColorSpace
    mask.anisotropy = 8
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      uniforms: {
        uMatcap: { value: makeChromeMatcap() },
        uMask: { value: mask },
        uTime: { value: 0 },
        uHolo: { value: 0.9 },
        uChrome: { value: 1.1 },
        uHueScale: { value: 1.6 },
        uShimmer: { value: 0.05 },
      },
      vertexShader: HOLO_VERT,
      fragmentShader: HOLO_FRAG,
    })
  }, [])

  // Metallic EMV chip (front, left) with beveled contact-groove relief.
  const chipMat = useMemo(() => {
    const { colorMap, normalMap } = makeChipMaps()
    const m = new THREE.MeshPhysicalMaterial({
      map: colorMap,
      normalMap,
      metalness: 1,
      roughness: 0.3,
      transparent: true,
      alphaTest: 0.5,
      envMapIntensity: 1.9,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    m.normalScale.set(0.9, 0.9)
    m.anisotropy = 0.4
    return m
  }, [])

  // Back: glossy black top strip (metal) + light laser-etched details.
  const stripMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#060608'),
        metalness: 1,
        roughness: 0.12,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
        side: THREE.FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      }),
    [],
  )

  const etchMat = useMemo(() => {
    const { colorMap, normalMap } = makeEtchMaps()
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      map: colorMap,
      normalMap, // beveled engrave -> catches light as the card tilts
      metalness: 0.15,
      roughness: 0.4,
      transparent: true,
      alphaTest: 0.28,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    })
    m.normalScale.set(1, 1)
    return m
  }, [])

  const physical = useMemo(() => {
    const make = (m, polygonOffset) =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(MATERIAL.color),
        metalness: 1,
        roughness: 0.34,
        map: m.colorMap, // near-black albedo under the logos
        normalMap: m.normalMap,
        roughnessMap: m.roughnessMap,
        metalnessMap: m.metalnessMap, // logos -> metalness 0 (matte dielectric)
        specularIntensity: 0.35, // dims the dielectric (logo) sheen only
        clearcoat: 0.4,
        clearcoatRoughness: 0.5,
        polygonOffset,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    return {
      body: make(maps.body, false),
      front: make(maps.front, true),
      back: make(maps.back, true),
    }
  }, [maps])

  const matcapMats = useMemo(() => {
    const make = (m, polygonOffset) =>
      new THREE.MeshMatcapMaterial({
        color: new THREE.Color('#ffffff'),
        matcap,
        normalMap: m.normalMap,
        polygonOffset,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    return {
      body: make(maps.body, false),
      front: make(maps.front, true),
      back: make(maps.back, true),
    }
  }, [maps, matcap])

  useFrame((state, dt) => {
    for (const key of ['body', 'front', 'back']) {
      const m = physical[key]
      m.color.set(material.color)
      m.roughness = material.roughness
      m.anisotropy = material.anisotropy
      m.anisotropyRotation = material.anisotropyRotation
      m.clearcoat = material.clearcoat
      m.clearcoatRoughness = material.clearcoatRoughness
      m.envMapIntensity = material.envMapIntensity
      m.specularIntensity = material.logoSheen
      m.normalScale.set(material.normalScale, material.normalScale)
      matcapMats[key].normalScale.set(material.normalScale, material.normalScale)
    }

    const u = birdMat.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uHolo.value = bird.holo
    u.uChrome.value = bird.chrome
    u.uHueScale.value = bird.hueScale
    u.uShimmer.value = bird.shimmer

    const g = group.current
    if (!g) return
    // Tilt so the card "faces" the cursor: the corner under the cursor dips
    // away (into the screen), the opposite corner comes forward.
    const targetY = CARD.homeTiltY + (flipped ? Math.PI : 0) + tilt.current.x * parallax
    const targetX = CARD.homeTiltX + tilt.current.y * parallax
    easing.damp(g.rotation, 'y', targetY, flipDamp, dt)
    easing.damp(g.rotation, 'x', targetX, flipDamp, dt)
  })

  const mats = material.matcap ? matcapMats : physical
  const eps = CARD.depth / 2 + 0.002

  return (
    <group ref={group} scale={scale}>
      <mesh geometry={geoBody} material={mats.body} />
      <mesh geometry={geoFace} material={mats.front} position={[0, 0, eps]} />
      {showChip && (
        <mesh material={chipMat} position={[CHIP.x, CHIP.y, eps + 0.002]}>
          <planeGeometry args={[CHIP.w, CHIP.h]} />
        </mesh>
      )}
      <mesh
        geometry={geoFace}
        material={mats.back}
        position={[0, 0, -eps]}
        rotation={[0, Math.PI, 0]}
      />
      <mesh
        geometry={geoStrip}
        material={stripMat}
        position={[0, (CARD.height - CARD.inset) / 2 - STRIP_H / 2, -(CARD.depth / 2 + 0.003)]}
        rotation={[0, Math.PI, 0]}
      />
      <mesh
        material={etchMat}
        position={[0, 0, -(CARD.depth / 2 + 0.005)]}
        rotation={[0, Math.PI, 0]}
      >
        <planeGeometry args={[CARD.width - CARD.inset, CARD.height - CARD.inset]} />
      </mesh>
      <mesh
        material={birdMat}
        position={[BIRD.x, BIRD.y, -(CARD.depth / 2 + 0.004)]}
        rotation={[0, Math.PI, 0]}
      >
        <planeGeometry args={[BIRD.w, BIRD.h]} />
      </mesh>
    </group>
  )
}
