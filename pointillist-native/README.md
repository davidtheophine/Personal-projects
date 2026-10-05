# Pointillist

See the world through a pointillist lens. The live camera is resolved into a grid of coloured
dots, each one the average of everything beneath it — so the bigger the dots, the more the scene
generalises. Take a photo and it saves to your camera roll as the painting, not the photograph.

Runs in **Expo Go** on SDK 57. No dev build, no native modules to compile.

```bash
cd pointillist-native
npm install     # first time only
npm start       # prints a QR code — scan it with Expo Go
```

> **Only ever use `npm start` (or `npx expo start`).**
>
> `npx expo run` — and its `run:ios` / `run:android` forms — is a different command that
> compiles a *native* app. It needs Xcode or Android Studio plus CocoaPods, and before it
> fails it will prebuild: generating `ios/` and `android/` directories and rewriting your
> `package.json` and `app.json`. The error it leaves behind is
> `The sandbox is not in sync with the Podfile.lock`, which has nothing to do with this
> project. Nothing here needs a native build.
>
> If you ran it by accident: `git checkout -- package.json app.json && rm -rf ios android`

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

## Running it on another machine

The code lives on the `pointillist-camera-app` branch of
[davidtheophine/Personal-projects](https://github.com/davidtheophine/Personal-projects). You need
Node and the **Expo Go** app on your phone — nothing else. No Xcode, no Android Studio.

```bash
git clone https://github.com/davidtheophine/Personal-projects.git
cd Personal-projects
git checkout pointillist-camera-app
cd pointillist-native
npm install
npx expo start
```

Scan the QR code with the iOS camera app, or from inside Expo Go on Android. The phone and the
computer have to be on the same Wi-Fi; if they are not, use `npx expo start --tunnel`.

`npm install` is only needed the first time, and after anyone changes `package.json`.

## Saving your work back

```bash
git pull                      # get anyone else's changes first
git add -A                    # stage everything you changed
git commit -m "what you did"  # record it locally
git push                      # send it to GitHub
```

`git status` shows what has changed, `git log --oneline` shows recent commits. If `git push`
complains that the branch has no upstream, it will print the exact command to run — copy it.
