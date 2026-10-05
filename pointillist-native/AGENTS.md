# Pointillist — notes for whoever works on this next

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.
Install packages with `npx expo install <pkg>` so versions stay matched to Expo Go.

Stack is matched to **Expo Go SDK 57** — there is no dev build and there does not need to be:
`expo ~57`, `expo-gl ~57.0.2`, `expo-camera ~57.0.6`, `expo-media-library ~57.0.5`.

Two SDK 57 details that are easy to get wrong:

- `MediaLibrary.saveToLibraryAsync` still exists as an export but **throws at runtime**. The
  live API is `MediaLibrary.Asset.create(fileUri)`. Same for `createAssetAsync` and friends —
  see `node_modules/expo-media-library/build/legacyWarnings.js` for the full list.
- `GLView#createCameraTextureAsync` is undocumented but present and working. It needs the
  native camera view to conform to `EXCameraInterface` (iOS) / `CameraViewInterface` (Android);
  `expo-camera`'s `CameraView` does. It must be called *after* `onCameraReady` fires.

## How the effect works

`src/shader/pointillist.js` holds both fragment shaders and is the single source of truth for
the look. The pipeline is two passes, and the split is the whole performance story:

1. **Cell pass** renders one fragment per *dot* into a small off-screen texture, box-averaging
   the camera over that dot's footprint and grading the colour. "Bigger dots = more generalised"
   is literally this average widening.
2. **Dot pass** renders full screen, reads that texture with `NEAREST`, and paints the dabs.

Averaging once per dot instead of once per pixel is what keeps the preview at 60fps and makes
dot size free to change. The grid texture is allocated once at `MIN_DOT_PX` resolution and used
as a sub-rect, so dragging the size slider never reallocates.

## shader-lab/

`npm run lab` → http://localhost:5177/shader-lab/

A browser harness that imports `src/gl/renderer.js` **unmodified** and runs it against a webcam,
a photo, or a procedural scene. This is how the look was tuned and how it should be tuned again —
iterating here takes seconds and needs no device. `src/gl/` and `src/lib/` must therefore stay
free of React Native imports; anything RN-flavoured belongs in `src/config.js` or a component.

The lab's dev server resolves extensionless imports the way Metro does, so `src/` keeps
idiomatic React Native import paths.

## Camera orientation

The camera texture's rotation and mirroring cannot be queried from GL and differ by platform.
Rather than guess, `src/lib/camera-transform.js` enumerates every rotation/flip combination and
the in-app dev panel (long-press the paper chip) cycles them, printing the exact `src/config.js`
line to paste back. If the preview comes up sideways on a device, that is the two-tap fix — not a bug
to debug in the shader.

## Verifying

- `npm run export` must succeed — that is the bundling check.
- Visuals are verified in `shader-lab/` first, then on-device with `npx expo start` and the QR
  code (add `--tunnel` if you are not on the same Wi-Fi).
- GL does not work under remote JS debugging. If the screen is black, check that first.

## The camera view must stay invisible

`CameraView` exists only to feed the GL texture. Left visible, its preview composites *above*
the `GLView` on iOS regardless of sibling order, and the symptom is nasty to read: the viewfinder
shows a plain camera feed while captures come out correctly pointillist, because the snapshot
reads the GL framebuffer rather than the screen. It lives in an `opacity: 0` host with an
explicit `zIndex` below the canvas. Do not "simplify" that away.

For the same reason `draw()` clears to the paper colour and still calls `endFrameEXP()` when
there is no camera texture yet: an opaque surface means a missing camera reads as blank paper,
not as a working camera app.

## `gl.drawingBufferWidth` is a trap — take the size from layout

expo-gl sets `drawingBufferWidth`/`drawingBufferHeight` **once**, at context creation, from
`glGetIntegerv(GL_VIEWPORT)` (see `common/EXWebGLRenderer.cpp` and `EXGLNativeContext.cpp`).
They are plain static JS properties and are never updated afterwards.

`onContextCreate` can fire before the `GLView` is laid out, in which case both read `0` — and
they stay `0` for the life of the context. Re-reading them per frame does not help. The result is
a zero-sized grid texture, a zero-sized viewport, a black screen, and `takeSnapshotAsync`
rejecting with `E_GL_INVALID_VIEWPORT` (with no `rect` it snapshots the ambient GL viewport, and
rejects when width or height is 0).

So the surface size is pushed in from React Native layout: `onLayout` on the `GLView`, through
`PixelRatio.getPixelSizeForLayoutSize`, into `renderer.setSize()`. It is held in a ref because
layout and context creation race, and because a context recreation builds a fresh renderer that
needs the size again. Capture passes an explicit `rect`.

## Never put `zIndex` in the view tree around the GLView

React Native implements `zIndex` on iOS by reordering subviews, which calls `removeFromSuperview`.
`expo-gl`'s `GLView.removeFromSuperview` **destroys the GL context** (`GLView.swift`), and
`glContextWillDestroy` runs `deleteViewBuffers()`, zeroing `viewFramebuffer` and `msaaFramebuffer`.
`glContextGetDefaultFramebuffer()` returns `msaaFramebuffer`, so every later
`bindFramebuffer(FRAMEBUFFER, null)` targets a deleted object and `drawGL` presents nothing.

The symptom is deceptive and cost several rounds to find: framebuffers we create ourselves keep
working, so the offscreen cell pass still renders and `readPixels` still returns live camera
colours — the pipeline looks perfectly healthy while nothing ever reaches the screen.

Plain document order already stacks this tree correctly: camera, canvas, header, dock, review.
Leave it that way.

## Orientation in Expo Go

`app.json`'s `orientation` field does nothing in Expo Go — the interface stays locked to portrait
unless `ScreenOrientation.unlockAsync()` is called at runtime. Until it is, `getOrientationAsync`
always reports `PORTRAIT_UP`, so any rotation correction keyed off it silently never fires, and
two opposite mappings produce identical behaviour. That cost a round of debugging; if rotation
work ever looks inert, check the unlock first.

The texture itself never rotates: iOS forces `AVCaptureVideoOrientationPortrait` (and
`videoMirrored: YES`) on every sample buffer in `EXGLCameraObject`, so the device angle has to be
folded into the sampling transform. The in-app **⟳** control adds a manual quarter turn on top,
because the handedness of that composition is not observable from JS.
