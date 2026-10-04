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
the in-app dev panel (long-press the title) cycles them, printing the exact `src/config.js` line
to paste back. If the preview comes up sideways on a device, that is the two-tap fix — not a bug
to debug in the shader.

## Verifying

- `npm run export` must succeed — that is the bundling check.
- Visuals are verified in `shader-lab/` first, then on-device with `npx expo start` and the QR
  code (add `--tunnel` if you are not on the same Wi-Fi).
- GL does not work under remote JS debugging. If the screen is black, check that first.
