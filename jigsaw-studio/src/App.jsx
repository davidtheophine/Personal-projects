import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ACESFilmicToneMapping } from 'three'
import { loadImageTexture } from './lib/texture.js'
import { createUniformStore } from './materials/pieceMaterial.js'
import { DEFAULT_PARAMS, PRESETS } from './materials/presets.js'
import { buildPuzzle, disposePuzzle } from './puzzle/geometry.js'
import { Pieces } from './puzzle/Pieces.jsx'
import { Rig } from './scene/Rig.jsx'
import { Sparks } from './scene/Sparks.jsx'
import { Stage, Tray } from './scene/Stage.jsx'
import { ImagePicker, MaterialPicker, Panel, Slider, Toggle } from './ui/Controls.jsx'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// A few URL params, handy for sharing a look and for grabbing stills:
//   ?material=glass&pieces=6&image=the-kiss&solved=1
const query = new URLSearchParams(window.location.search)
const asInt = (key, fallback) => {
  const n = Number(query.get(key))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export default function App() {
  const [paintings, setPaintings] = useState([])
  const [image, setImage] = useState(null) // { texture, aspect, label, file }
  const [preset, setPreset] = useState(PRESETS[query.get('material')] ? query.get('material') : 'wood')
  const [cols, setCols] = useState(clamp(asInt('pieces', 5), 2, 10))
  const [tab, setTab] = useState(1)
  const [depth, setDepth] = useState(0.22)
  const [seed, setSeed] = useState(7)
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [randomRotation, setRandomRotation] = useState(false)
  const [magnet, setMagnet] = useState(true)
  const [ghost, setGhost] = useState(true)
  const [sound, setSound] = useState(true)
  const [joined, setJoined] = useState(0)
  const [busy, setBusy] = useState(true)

  const store = useMemo(createUniformStore, [])
  const api = useRef({})
  const sparks = useRef({})

  // ---- image --------------------------------------------------------------
  useEffect(() => {
    let alive = true
    fetch('paintings/credits.json')
      .then((r) => r.json())
      .then(async (list) => {
        if (!alive) return
        setPaintings(list)
        const wanted = query.get('image')
        const first = list.find((p) => p.file.startsWith(wanted ?? '\u0000')) ?? list[0]
        const { texture, aspect } = await loadImageTexture(`paintings/${first.file}`)
        if (!alive) return
        setImage({ texture, aspect, label: `${first.name} - ${first.artist}`, file: first.file })
        setBusy(false)
      })
      .catch(() => setBusy(false))
    return () => {
      alive = false
    }
  }, [])

  const swapImage = useCallback(async (source, meta) => {
    setBusy(true)
    try {
      const { texture, aspect } = await loadImageTexture(source)
      setImage((prev) => {
        prev?.texture.dispose()
        return { texture, aspect, ...meta }
      })
    } finally {
      setBusy(false)
    }
  }, [])

  // ---- puzzle -------------------------------------------------------------
  const aspect = image?.aspect ?? 1
  const rows = clamp(Math.round(cols / aspect), 2, 16)
  const puzzle = useMemo(
    () => buildPuzzle({ cols, rows, aspect, seed, tab, depth }),
    [cols, rows, aspect, seed, tab, depth],
  )
  useEffect(() => () => disposePuzzle(puzzle), [puzzle])

  const setParam = (uniform, value) => {
    store[uniform].value = value // straight to the GPU, no re-render needed
    setParams((p) => ({ ...p, [uniform]: value }))
  }

  const total = puzzle.pieces.length
  const links = total - 1
  const solved = joined >= links

  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        if (file?.type.startsWith('image/')) swapImage(file, { label: file.name, file: null })
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 8.2, 9.4], fov: 38, near: 0.1, far: 120 }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
          // glass and jelly refract through one shared half-res backbuffer
          gl.transmissionResolutionScale = 0.6
        }}
      >
        <Rig puzzle={puzzle} />
        <Sparks api={sparks} />
        <Stage shadowIntensity={PRESETS[preset].shadowIntensity} />
        <Tray puzzle={puzzle} texture={image?.texture} ghost={ghost ? 0.1 : 0} />
        {image && (
          <Pieces
            key={image.file ?? image.label}
            puzzle={puzzle}
            texture={image.texture}
            preset={preset}
            store={store}
            sound={sound}
            randomRotation={randomRotation}
            magnet={magnet}
            autoSolve={query.has('solved')}
            api={api}
            sparks={sparks}
            onProgress={setJoined}
          />
        )}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={3.5}
          maxDistance={26}
          maxPolarAngle={Math.PI * 0.49}
        />
      </Canvas>

      <header className="masthead">
        <h1>Jigsaw Studio</h1>
        <p>{image ? image.label : 'loading…'}</p>
      </header>

      <aside className="dock">
        <Panel title="Picture">
          <ImagePicker
            paintings={paintings}
            value={image?.file}
            onPick={(p) =>
              swapImage(`paintings/${p.file}`, { label: `${p.name} - ${p.artist}`, file: p.file })
            }
            onUpload={(file) => swapImage(file, { label: file.name, file: null })}
          />
          <p className="hint">Drop an image anywhere, or pick a painting.</p>
        </Panel>

        <Panel title="Material">
          <MaterialPicker value={preset} onChange={setPreset} />
          {PRESETS[preset].controls.map((c) => (
            <Slider
              key={c.uniform}
              label={c.label}
              min={c.min}
              max={c.max}
              step={c.step}
              value={params[c.uniform]}
              onChange={(v) => setParam(c.uniform, v)}
            />
          ))}
        </Panel>

        <Panel title="Cut">
          <Slider
            label="Pieces"
            min={2}
            max={10}
            step={1}
            value={cols}
            onChange={setCols}
            format={() => `${cols} x ${rows}`}
          />
          <Slider label="Knobs" min={0.4} max={1.4} value={tab} onChange={setTab} />
          <Slider label="Thickness" min={0.06} max={0.5} value={depth} onChange={setDepth} />
          <div className="row">
            <Toggle label="Magnets" checked={magnet} onChange={setMagnet} />
            <Toggle label="Ghost" checked={ghost} onChange={setGhost} />
          </div>
          <div className="row">
            <Toggle label="Rotate" checked={randomRotation} onChange={setRandomRotation} />
            <Toggle label="Sound" checked={sound} onChange={setSound} />
          </div>
        </Panel>
      </aside>

      <div className="toolbar">
        <button type="button" onClick={() => api.current.scatter?.()}>
          Scatter
        </button>
        <button type="button" onClick={() => setSeed((s) => s + 1)}>
          Re-cut
        </button>
        <button type="button" className="ghost" onClick={() => api.current.solve?.()}>
          Solve it
        </button>
      </div>

      <footer className="status">
        <span className={solved ? 'done' : ''}>
          {solved ? `solved - ${total} pieces` : `${joined} / ${links} joined`}
        </span>
        <span className="keys">
drag a piece near its neighbour and it snaps · <kbd>R</kbd>/<kbd>Q</kbd> rotate · drag the background to orbit
        </span>
      </footer>

      {busy && <div className="busy">preparing pieces…</div>}
    </div>
  )
}
