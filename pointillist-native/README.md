# Pointillist

See the world through a pointillist lens. The live camera is resolved into a grid of coloured
dots, each one the average of everything beneath it — so the bigger the dots, the more the scene
generalises. Take a photo and it saves to your camera roll as the painting, not the photograph.

Runs in **Expo Go** on SDK 57. No dev build, no native modules to compile.

```bash
npm install
npx expo start      # scan the QR code with Expo Go (add --tunnel if off Wi-Fi)
```

## Controls

| Control | What it does |
| --- | --- |
| **Size** | Dot diameter, 2–40pt. Small reads as a halftone print; large abstracts the scene into blocks of colour. |
| **Colour** | Saturation, 0–2. At `0` you get graphite; at `1` true colour; above that the hues push past life. |
| **Palette** | Quantises each channel to 2–16 levels, the way a painter works from a limited set of mixed pigments. Hard right is continuous. |
| **Paper** (top right) | The colour showing through the gaps — Snow, Paper, Ink, Slate. |
| **Flip** | Front / back camera. |
| Shutter | Freezes the frame, then offers **Save to camera roll** or **Retake**. Saving returns you to the viewfinder; the cross top-right discards. |

Everything renders on-device. Nothing is uploaded; photos leave the app only when you save them.

## The slider is a placeholder

`src/components/PointSlider.jsx` is deliberately swappable. It is built from the same dots the
app is about — the track swells left to right so the control previews its own effect — but it
exists to be replaced. Keep the prop contract and the rest of the app does not care:

```jsx
<PointSlider label min max step value onChange={(next) => …} format={(v) => '…'} />
```

Dragging never re-renders React: the track runs on an `Animated.Value` and `onChange` writes
straight into the render loop's ref, so a redesign cannot cost you frames.

## Tuning the look

`npm run lab` opens a browser harness at http://localhost:5177/shader-lab/ that runs the *same*
renderer against your webcam, a photo, or a procedural test scene. Fixed constants (dot fill,
grid stagger, jitter, tonal swell) live in `LOOK` in `src/config.js`.

Worth trying: `stagger: 0.5` turns the square grid into brickwork rows, which reads more like
hand-placed dabs and less like a print screen.

## Layout

```
App.js                        screen, permissions, render loop, capture
src/shader/pointillist.js     both fragment shaders — the look lives here
src/gl/renderer.js            program/FBO setup and the two-pass draw
src/lib/camera-transform.js   screen space -> camera uv (rotation, mirror, cover crop)
src/config.js                 slider ranges, fixed look constants, papers
src/components/               PointSlider, ShutterButton, ReviewOverlay, DevPanel
shader-lab/                   browser harness running the same renderer
```

`src/gl/` and `src/lib/` are free of React Native imports so the lab can load them directly.

## If the preview comes up sideways

The camera texture's orientation differs by platform and cannot be queried from GL. Long-press
the **paper chip** (top right) to open the dev panel, tap *Orientation* until it looks right,
and paste the printed values into `DEFAULT_ORIENTATION` / `CAMERA_TEXTURE_ASPECT` in
`src/config.js`. The panel also toggles snapshot flip, grid stagger, and shows dot count and fps.
