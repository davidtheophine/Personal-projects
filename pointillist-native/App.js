import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Dimensions,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { GLView } from 'expo-gl'
import * as Haptics from 'expo-haptics'
import * as MediaLibrary from 'expo-media-library'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  CAMERA_TEXTURE_ASPECT,
  CONTROLS,
  DEFAULT_ORIENTATION,
  LOOK,
  PAPERS,
  SNAPSHOT_FLIP,
  toDevicePx,
} from './src/config'
import { createRenderer } from './src/gl/renderer'
import { ORIENTATIONS } from './src/lib/camera-transform'
import DevPanel from './src/components/DevPanel'
import PointSlider from './src/components/PointSlider'
import ReviewOverlay from './src/components/ReviewOverlay'
import ShutterButton from './src/components/ShutterButton'

// Module scope keeps these stable across renders, same reason as the setters.
const formatSize = (v) => `${v.toFixed(1)}pt`
const formatColour = (v) => (v < 0.02 ? 'mono' : v.toFixed(2))
const formatPalette = (v) => (v > 16 ? 'full' : `${Math.round(v)}`)

const toSurface = ({ width, height }) => ({
  width: PixelRatio.getPixelSizeForLayoutSize(width || 0),
  height: PixelRatio.getPixelSizeForLayoutSize(height || 0),
})

function Studio() {
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const [camPerm, requestCamPerm] = useCameraPermissions()
  const [libPerm, requestLibPerm] = MediaLibrary.usePermissions({
    writeOnly: true,
    granularPermissions: ['photo'],
  })

  const cameraRef = useRef(null)
  const glViewRef = useRef(null)
  const glRef = useRef(null)
  const rendererRef = useRef(null)
  const textureRef = useRef(null)
  const rafRef = useRef(null)
  const pausedRef = useRef(false)
  // Dev switch: paint flat paper and ignore the camera entirely. If the screen
  // changes colour with this on, the canvas is on screen and the camera is the
  // problem; if it stays black, the canvas is not being composited.
  const canvasTestRef = useRef(false)
  // Device-pixel size of the GL surface. The canvas fills the window, so the
  // window is a reliable source that is available on the very first render —
  // `onLayout` only ever refines it. Kept in a ref so it survives a context
  // (and therefore renderer) recreation.
  const surfaceRef = useRef(toSurface(Dimensions.get('window')))

  // Everything the render loop reads lives in a ref, so dragging a slider never
  // re-renders React — it just changes what the next frame draws.
  const stateRef = useRef({
    dotSize: toDevicePx(CONTROLS.dotSize.value),
    saturation: CONTROLS.colour.value,
    levels: CONTROLS.palette.value,
    paper: PAPERS[0].colour,
    mirror: false,
    texAspect: CAMERA_TEXTURE_ASPECT,
    orientation: ORIENTATIONS[DEFAULT_ORIENTATION],
    orientationIndex: DEFAULT_ORIENTATION,
    snapshotFlip: SNAPSHOT_FLIP,
    ...LOOK,
  })

  const [facing, setFacing] = useState('back')
  const [paperIndex, setPaperIndex] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [textureReady, setTextureReady] = useState(false)
  const [glReady, setGlReady] = useState(false)
  const [shot, setShot] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [error, setError] = useState(null)

  const [status, setStatus] = useState('starting')
  const statusRef = useRef('starting')
  const [dev, setDev] = useState(null) // null = hidden
  const devOpenRef = useRef(false)
  const [stats, setStats] = useState({ cols: 0, rows: 0, fps: 0 })

  useEffect(() => {
    if (!camPerm) return
    if (!camPerm.granted && camPerm.canAskAgain) requestCamPerm()
  }, [camPerm, requestCamPerm])

  useEffect(() => {
    stateRef.current.mirror = facing === 'front'
  }, [facing])

  // --- GL ------------------------------------------------------------------

  // Both calls report whether they actually drew: until the view has been laid
  // out the surface is 0x0 and there is nothing to present.
  const draw = useCallback(() => {
    const gl = glRef.current
    const renderer = rendererRef.current
    if (!gl || !renderer) return null
    if (!textureRef.current || canvasTestRef.current) {
      if (renderer.clear(stateRef.current.paper)) gl.endFrameEXP()
      return null
    }
    const grid = renderer.render({ ...stateRef.current, cameraTexture: textureRef.current })
    if (grid) gl.endFrameEXP()
    return grid
  }, [])

  const onContextCreate = useCallback(
    (gl) => {
      glRef.current = gl
      // A fresh context invalidates everything built on the old one — this
      // fires again if the surface is torn down and recreated.
      rendererRef.current?.dispose()
      textureRef.current = null
      setTextureReady(false)
      try {
        const renderer = createRenderer(gl)
        // Layout may well have landed before the context did.
        renderer.setSize(surfaceRef.current.width, surfaceRef.current.height)
        rendererRef.current = renderer
        setGlReady(true)
      } catch (e) {
        setError(e.message)
      }
    },
    [],
  )

  // The camera texture can only be created once both the GL surface and the
  // camera session exist, which happen in an unpredictable order.
  useEffect(() => {
    if (!glReady || !cameraReady || textureRef.current) return
    let cancelled = false
    ;(async () => {
      // The native camera view can register a beat after `onCameraReady`, so
      // give it a few tries before declaring failure.
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        try {
          const texture = await glViewRef.current.createCameraTextureAsync(cameraRef.current)
          if (cancelled) return
          textureRef.current = texture
          setTextureReady(true)
          return
        } catch (e) {
          if (attempt === 3) setError(`camera texture: ${e.message}`)
          else await new Promise((r) => setTimeout(r, 350))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [glReady, cameraReady])

  useEffect(() => {
    if (!glReady) return
    let frames = 0
    let since = Date.now()

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      if (pausedRef.current) return
      const grid = draw()

      // Numbers, not adjectives — this chip is how a broken frame gets diagnosed.
      const surface = rendererRef.current?.size() ?? { width: 0, height: 0 }
      const pixel = rendererRef.current?.probe()
      const next = [
        `gl ${rendererRef.current ? 'ok' : '--'}`,
        `cam ${textureRef.current ? 'ok' : '--'}`,
        `${surface.width}x${surface.height}`,
        grid ? `${grid.cols}x${grid.rows}` : 'no dots',
        pixel ? `rgb ${pixel.join(',')}` : 'rgb --',
      ].join(' · ')
      if (next !== statusRef.current) {
        statusRef.current = next
        setStatus(next)
      }

      frames += 1
      const now = Date.now()
      if (now - since > 700) {
        // Only publish stats while the dev panel is up: a setState here would
        // re-render the dock mid-drag for no visible benefit.
        if (grid && devOpenRef.current) {
          setStats({ ...grid, fps: Math.round((frames * 1000) / (now - since)) })
        }
        frames = 0
        since = now
      }
    }
    tick()
    return () => cancelAnimationFrame(rafRef.current)
  }, [draw, glReady])

  useEffect(() => () => rendererRef.current?.dispose(), [])

  // expo-gl cannot report its own surface size, so we tell it. Window dimensions
  // land immediately and survive rotation; `onLayout` refines them if the view
  // ever stops being exactly full screen.
  const applySize = useCallback((size) => {
    if (!(size.width > 0 && size.height > 0)) return
    surfaceRef.current = size
    rendererRef.current?.setSize(size.width, size.height)
  }, [])

  useEffect(() => {
    applySize(toSurface(window))
  }, [applySize, window])

  const onCanvasLayout = useCallback(
    (e) => applySize(toSurface(e.nativeEvent.layout)),
    [applySize],
  )

  // --- capture -------------------------------------------------------------

  const capture = useCallback(async () => {
    const renderer = rendererRef.current
    if (!renderer || !textureRef.current) return
    const { width, height } = renderer.size()
    if (width <= 0 || height <= 0) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    pausedRef.current = true
    try {
      draw() // make sure the framebuffer holds a fresh frame before reading it
      const snapshot = await glViewRef.current.takeSnapshotAsync({
        format: 'png',
        flip: stateRef.current.snapshotFlip,
        // Explicit rect: left to itself expo-gl snapshots the ambient GL
        // viewport, i.e. whatever the last draw call happened to leave bound.
        rect: { x: 0, y: 0, width, height },
      })
      setSaveStatus('idle')
      setShot(snapshot)
    } catch (e) {
      pausedRef.current = false
      Alert.alert('Could not capture', e.message)
    }
  }, [draw])

  const discard = useCallback(() => {
    setShot(null)
    setSaveStatus('idle')
    pausedRef.current = false
  }, [])

  const save = useCallback(async () => {
    setSaveStatus('saving')
    try {
      let permission = libPerm
      if (!permission?.granted) permission = await requestLibPerm()
      if (!permission?.granted) {
        setSaveStatus('idle')
        Alert.alert('Photos access needed', 'Allow adding photos to save your pointillist shots.')
        return
      }
      await MediaLibrary.Asset.create(shot.localUri || shot.uri)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setSaveStatus('saved')
      // Back to the viewfinder on its own — a capture should never dead-end.
      setTimeout(discard, 850)
    } catch (e) {
      setSaveStatus('idle')
      Alert.alert('Could not save', e.message)
    }
  }, [discard, libPerm, requestLibPerm, shot])

  // --- dev panel -----------------------------------------------------------

  const openDev = useCallback(() => {
    const { orientationIndex, texAspect, snapshotFlip, stagger } = stateRef.current
    devOpenRef.current = true
    setDev({ orientationIndex, texAspect, snapshotFlip, stagger, canvasTest: canvasTestRef.current })
  }, [])

  const closeDev = useCallback(() => {
    devOpenRef.current = false
    setDev(null)
  }, [])

  // Stable identities: a new callback each render would rebuild every slider's
  // PanResponder, which can drop a drag in progress.
  const setDotSize = useCallback((v) => {
    stateRef.current.dotSize = toDevicePx(v)
  }, [])
  const setSaturation = useCallback((v) => {
    stateRef.current.saturation = v
  }, [])
  const setLevels = useCallback((v) => {
    stateRef.current.levels = v
  }, [])

  const setDevValue = useCallback((patch) => {
    setDev((prev) => {
      const next = { ...prev, ...patch }
      stateRef.current.orientationIndex = next.orientationIndex
      stateRef.current.orientation = ORIENTATIONS[next.orientationIndex]
      stateRef.current.texAspect = next.texAspect
      stateRef.current.snapshotFlip = next.snapshotFlip
      stateRef.current.stagger = next.stagger
      canvasTestRef.current = next.canvasTest
      return next
    })
  }, [])

  // --- render --------------------------------------------------------------

  if (camPerm && !camPerm.granted) {
    return (
      <View style={styles.gate}>
        <Text style={styles.gateTitle}>Pointillist needs the camera</Text>
        <Text style={styles.gateBody}>
          Everything is rendered on-device. Nothing is uploaded, and photos only leave the app when
          you save them to your camera roll.
        </Text>
        <Pressable onPress={requestCamPerm} style={styles.gateButton}>
          <Text style={styles.gateButtonText}>Allow camera</Text>
        </Pressable>
      </View>
    )
  }

  const paper = PAPERS[paperIndex]

  return (
    <View style={styles.root}>
      {/* The camera only exists to feed the GL texture. It is left completely
          vanilla — full size, fully opaque — because anything clever here risks
          the capture session not starting, and it is simply covered: the canvas
          sits above it and always presents an opaque frame. */}
      <View style={styles.cameraHost} pointerEvents="none">
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          onCameraReady={() => setCameraReady(true)}
        />
      </View>
      <GLView
        ref={glViewRef}
        style={styles.canvas}
        onLayout={onCanvasLayout}
        onContextCreate={onContextCreate}
      />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {status ? <Text style={styles.status}>{status}</Text> : <View />}
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              const next = (paperIndex + 1) % PAPERS.length
              setPaperIndex(next)
              stateRef.current.paper = PAPERS[next].colour
            }}
            onLongPress={openDev}
            delayLongPress={600}
            hitSlop={8}
            style={styles.pill}
          >
            <View style={[styles.swatch, { backgroundColor: paper.colour }]} />
            <Text style={styles.pillText}>{paper.name}</Text>
          </Pressable>
          <Pressable
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            hitSlop={8}
            style={styles.pill}
          >
            <Text style={styles.pillText}>Flip</Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={[styles.dock, { paddingBottom: insets.bottom + 18 }]}>
        {dev ? (
          <DevPanel state={dev} set={setDevValue} stats={stats} onClose={closeDev} />
        ) : null}

        <View style={styles.sliders}>
          <PointSlider {...CONTROLS.dotSize} onChange={setDotSize} format={formatSize} />
          <PointSlider {...CONTROLS.colour} onChange={setSaturation} format={formatColour} />
          <PointSlider {...CONTROLS.palette} onChange={setLevels} format={formatPalette} />
        </View>

        <View style={styles.shutterRow}>
          <ShutterButton onPress={capture} busy={!textureReady} />
        </View>
      </View>

      {shot ? (
        <ReviewOverlay shot={shot} status={saveStatus} onSave={save} onDiscard={discard} />
      ) : null}

      <StatusBar style="light" />
    </View>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Studio />
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute',
    zIndex: 2,
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cameraHost: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  canvas: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  status: {
    color: '#fff',
    fontSize: 11,
    letterSpacing: 1.6,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  swatch: { width: 11, height: 11, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  pillText: { color: '#fff', fontSize: 11, letterSpacing: 0.8 },
  dock: {
    position: 'absolute',
    zIndex: 2,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  sliders: { gap: 2 },
  shutterRow: { alignItems: 'center', paddingTop: 4 },
  errorBox: {
    position: 'absolute',
    zIndex: 3,
    left: 20,
    right: 20,
    top: '45%',
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(120,20,16,0.85)',
  },
  errorText: { color: '#fff', fontSize: 12, lineHeight: 18 },
  gate: { flex: 1, backgroundColor: '#0a0a0b', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  gateTitle: { color: '#fff', fontSize: 19, letterSpacing: 0.2 },
  gateBody: { color: '#fff', opacity: 0.6, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  gateButton: { marginTop: 10, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 13, paddingHorizontal: 28 },
  gateButtonText: { color: '#0a0a0b', fontSize: 14, fontWeight: '600' },
})
