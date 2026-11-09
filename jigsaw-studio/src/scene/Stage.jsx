import { Environment, Lightformer } from '@react-three/drei'
import { useMemo } from 'react'
import { BackSide } from 'three'
import { makeBackdropTexture, makeTableTexture } from './textures.js'

/**
 * Studio lighting for the table.
 *
 * The environment is built from Lightformers rather than an HDRI so the app
 * stays self-contained (no CDN fetch) - and it is what sells metal and glass,
 * which are almost entirely reflection.
 */
export function Stage({ shadowIntensity = 1 }) {
  const backdrop = useMemo(makeBackdropTexture, [])
  const table = useMemo(makeTableTexture, [])

  return (
    <>
      <mesh scale={70} renderOrder={-1}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial map={backdrop} side={BackSide} depthWrite={false} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position-y={-0.004} receiveShadow>
        <planeGeometry args={[46, 46]} />
        <meshStandardMaterial map={table} roughness={0.92} metalness={0} />
      </mesh>

      <ambientLight intensity={0.3} />
      <directionalLight
        castShadow
        position={[5.5, 9, 4.5]}
        intensity={2.4}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-intensity={shadowIntensity}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={0.5}
        shadow-camera-far={34}
      />
      <directionalLight position={[-6, 4, -5]} intensity={0.5} color="#9fb6ff" />

      <Environment resolution={256} frames={1}>
        {/* Three softbox tubes over a dark room. Narrow bright strips with
            dark between them are what make metal look like metal and glass
            look wet - a uniformly bright sky just turns both to white. */}
        {[-3.2, 0, 3.2].map((z) => (
          <Lightformer
            key={z}
            form="rect"
            intensity={4.5}
            position={[0, 7, z]}
            rotation-x={Math.PI / 2}
            scale={[11, 1.1, 1]}
          />
        ))}
        <Lightformer
          form="rect"
          intensity={0.85}
          color="#cfe0ff"
          position={[-8, 3, 2]}
          rotation-y={Math.PI / 2}
          scale={[8, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.6}
          color="#ffd7ad"
          position={[8, 2.5, -1]}
          rotation-y={-Math.PI / 2}
          scale={[7, 5, 1]}
        />
        {/* Two bright panels behind and above. A flat slab viewed from the
            front mirrors whatever sits behind it at the same angle, so these
            - not the overhead tubes - are what put a highlight on a piece. */}
        {/* A flat slab seen from the default camera mirrors whatever sits
            about 40 degrees up and behind it, so that is where the key panel
            goes. The environment is sampled by direction, so only the angle
            matters, not the distance. */}
        <Lightformer form="rect" intensity={7} position={[0, 6.5, -8]} scale={[7, 0.45, 1]} />
        <Lightformer
          form="rect"
          intensity={4}
          color="#ffeedd"
          position={[5, 4.6, -7]}
          scale={[2.5, 0.4, 1]}
        />
        <Lightformer form="circle" intensity={3.5} position={[2.5, 5, 6]} scale={1.8} />
        <mesh scale={40}>
          <sphereGeometry args={[1, 24, 12]} />
          <meshBasicMaterial color="#070910" side={BackSide} />
        </mesh>
      </Environment>
    </>
  )
}

/**
 * The tray the puzzle is assembled in: a recessed panel plus an optional ghost
 * of the image, which is the difference between "a pile of pieces" and
 * "a puzzle you can actually finish".
 */
export function Tray({ puzzle, texture, ghost = 0.12 }) {
  const { width, height } = puzzle
  const pad = Math.min(puzzle.sx, puzzle.sy) * 0.22
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.001} receiveShadow>
        <planeGeometry args={[width + pad * 2, height + pad * 2]} />
        <meshStandardMaterial color="#090a0f" roughness={0.75} metalness={0.1} />
      </mesh>
      {ghost > 0 && texture && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.0025}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} transparent opacity={ghost} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
