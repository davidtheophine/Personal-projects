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
import * as ScreenOrientation from 'expo-screen-orientation'
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

// iOS pins the capture connection to portrait (see expo-gl's EXGLCameraObject),
// so the texture never rotates with the device — we have to rotate the sampling
// to match. Android's SurfaceTexture matrix behaves the same way in practice.
const DEVICE_ROTATION = {
  [ScreenOrientation.Orientation.PORTRAIT_UP]: 0,
  [ScreenOrientation.Orientation.LANDSCAPE_LEFT]: 90,
  [ScreenOrientation.Orientation.PORTRAIT_DOWN]: 180,
  [ScreenOrientation.Orientation.LANDSCAPE_RIGHT]: 270,
}

const toSurface = ({ width, height }) => ({
  width: PixelRatio.getPixelSizeForLayoutSize(width || 0),
  height: PixelRatio.getPixelSizeForLayoutSize(height || 0),
})

function Studio() {
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const [camPerm, requestCamPerm] = useCameraPermissions()
  MediaLibrary.usePermissions({ writeOnly: true, granularPermissions: ['photo'] })

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
    deviceRotation: 0,
    snapshotFlip: SNAPSHOT_FLIP,
    ...LOOK,
  })

  const [facing, setFacing] = useState('back')
  const [controlsOpen, setControlsOpen] = useState(true)
  const [paperIndex, setPaperIndex] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [textureReady, setTextureReady] = useState(false)
  const [glReady, setGlReady] = useState(false)
  const [shot, setShot] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [saveError, setSaveError] = useState(null)
  const [error, setError] = useState(null)

  // The colour under the middle of the frame, read straight off the grid
  // texture. Started life as a debug probe; it earns its place as a readout.
  const [centre, setCentre] = useState(null)
  const centreRef = useRef('')
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

  const applyOrientation = useCallback((deviceDegrees) => {
    const base = ORIENTATIONS[stateRef.current.orientationIndex]
    stateRef.current.deviceRotation = deviceDegrees
    stateRef.current.orientation = { ...base, rot: (base.rot + deviceDegrees) % 360 }
  }, [])

  useEffect(() => {
    let cancelled = false
    const handle = (orientation) => {
      if (cancelled) return
      applyOrientation(DEVICE_ROTATION[orientation] ?? 0)
    }
    ScreenOrientation.getOrientationAsync().then(handle).catch(() => {})
    const sub = ScreenOrientation.addOrientationChangeListener((e) =>
      handle(e.orientationInfo.orientation),
    )
    return () => {
      cancelled = true
      ScreenOrientation.removeOrientationChangeListener(sub)
    }
  }, [applyOrientation])

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

      const pixel = rendererRef.current?.probe()
      const key = pixel ? pixel.join(',') : ''
      if (key !== centreRef.current) {
        centreRef.current = key
        setCentre(pixel)
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
      setSaveError(null)
      setShot(snapshot)
    } catch (e) {
      pausedRef.current = false
      Alert.alert('Could not capture', e.message)
    }
  }, [draw])

  const discard = useCallback(() => {
    setShot(null)
    setSaveStatus('idle')
    setSaveError(null)
    pausedRef.current = false
  }, [])

  const save = useCallback(async () => {
    setSaveStatus('saving')
    setSaveError(null)
    try {
      // Ask the module directly rather than through the hook: the hook's cached
      // response can be a render behind, and "add photos only" is exactly the
      // access this needs.
      let permission = await MediaLibrary.getPermissionsAsync(true, ['photo'])
      if (!permission.granted && permission.canAskAgain) {
        permission = await MediaLibrary.requestPermissionsAsync(true, ['photo'])
      }
      if (!permission.granted) {
        setSaveStatus('idle')
        setSaveError('Photos access is off. Enable "Add Photos Only" for Expo Go in Settings.')
        return
      }

      await MediaLibrary.Asset.create(shot.localUri || shot.uri)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setSaveStatus('saved')
      // Back to the viewfinder on its own — a capture should never dead-end.
      setTimeout(discard, 1200)
    } catch (e) {
      setSaveStatus('idle')
      // Shown in the review bar rather than an alert: an alert can be dismissed
      // without reading it, which is how a failing save looks like a no-op.
      setSaveError(e?.message ? String(e.message) : 'Could not save to the camera roll.')
    }
  }, [discard, shot])

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
      applyOrientation(stateRef.current.deviceRotation)
      stateRef.current.texAspect = next.texAspect
      stateRef.current.snapshotFlip = next.snapshotFlip
      stateRef.current.stagger = next.stagger
      canvasTestRef.current = next.canvasTest
      return next
    })
  }, [applyOrientation])

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
      {/* Order matters and `zIndex` must not be used anywhere in this tree.
          React Native implements zIndex on iOS by reordering subviews, which
          calls `removeFromSuperview` — and expo-gl's GLView destroys its GL
          context there, deleting the framebuffer it presents from. The symptom
          is vicious: our own offscreen pass keeps working, so the pipeline
          looks healthy while nothing ever reaches the screen. Plain document
          order already stacks these correctly. */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onCameraReady={() => setCameraReady(true)}
      />
      <GLView
        ref={glViewRef}
        style={StyleSheet.absoluteFill}
        onLayout={onCanvasLayout}
        onContextCreate={onContextCreate}
      />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
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
          <Pressable
            onPress={() => setControlsOpen((open) => !open)}
            hitSlop={8}
            style={styles.pill}
            accessibilityRole="button"
            accessibilityLabel={controlsOpen ? 'Hide controls' : 'Show controls'}
          >
            <Text style={styles.pillText}>{controlsOpen ? 'Hide' : 'Adjust'}</Text>
          </Pressable>
        </View>
        {centre ? (
          <View style={styles.readout}>
            <View style={[styles.readoutSwatch, { backgroundColor: `rgb(${centre.join(',')})` }]} />
            <Text style={styles.readoutText}>{centre.join(' · ')}</Text>
          </View>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={[styles.dock, controlsOpen && styles.dockOpen, { paddingBottom: insets.bottom + 18 }]}>
        {dev ? (
          <DevPanel state={dev} set={setDevValue} stats={stats} onClose={closeDev} />
        ) : null}

        {controlsOpen ? (
          <View style={styles.sliders}>
            <PointSlider {...CONTROLS.dotSize} onChange={setDotSize} format={formatSize} />
            <PointSlider {...CONTROLS.colour} onChange={setSaturation} format={formatColour} />
            <PointSlider {...CONTROLS.palette} onChange={setLevels} format={formatPalette} />
          </View>
        ) : null}

        <View style={styles.shutterRow}>
          <ShutterButton onPress={capture} busy={!textureReady} />
        </View>
      </View>

      {shot ? (
        <ReviewOverlay
          shot={shot}
          status={saveStatus}
          error={saveError}
          onSave={save}
          onDiscard={discard}
        />
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
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  headerActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  readout: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  readoutSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  readoutText: {
    color: '#fff',
    opacity: 0.8,
    fontSize: 10,
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
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
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  dockOpen: { backgroundColor: 'rgba(0,0,0,0.42)' },
  sliders: { gap: 2 },
  shutterRow: { alignItems: 'center', paddingTop: 4 },
  errorBox: {
    position: 'absolute',
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
