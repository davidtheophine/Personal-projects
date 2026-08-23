# Metal Card — native (Expo + Skia)

A **React Native Skia** re-implementation of the metal card, built to run in
**Expo Go** so you can prototype **SkSL shaders** on a real phone with the
gyroscope.

This is a fresh, 2D-shader take (not a port of the web/Three.js 3D version):
the card is a rounded rect filled by an **SkSL runtime shader** (fine
sandblasted gunmetal + a specular sheen + a holographic tint) that **responds to
the device gyroscope**, with tap-to-flip.

## Run it in Expo Go

```bash
cd metal-card-native
npm install          # if you haven't already
npx expo start       # add --tunnel if your phone isn't on the same Wi-Fi
```

- **iOS:** scan the QR with the Camera app → opens in **Expo Go**.
- **Android:** scan the QR from inside the **Expo Go** app.
- Tilt the phone → the sheen/hologram sweeps across the metal. **Tap** the card
  to flip.

Skia is bundled inside Expo Go (SDK 57), so **no development build is needed** —
plain Expo Go works.

## Where the shader lives

Everything is in **`App.js`**:

- `SKSL` — the fragment shader (SkSL, Skia's GLSL-like language). This is the
  thing to iterate on: grain, the `spec` sheen, the `hue()` hologram, the back
  strip. Uniforms: `u_tilt` (gyro, −1..1), `u_time`, `u_face` (0 front / 1 back),
  `u_origin`/`u_res` (card rect).
- **Gyro** → `expo-sensors` `DeviceMotion` writes `tiltX`/`tiltY` (reanimated
  shared values), damped with `withTiming`.
- **Animation/uniforms** run on the UI thread via reanimated (`useFrameCallback`
  clock, `useDerivedValue` uniforms) — required by Skia 2.x.
- **Flip** — a `scaleX` transform driven by `progress`, swapping `u_face`.

## Stack (versions matched to Expo Go SDK 57)

`expo ~57`, `@shopify/react-native-skia 2.6.2`, `react-native-reanimated 4.5.1`
+ `react-native-worklets 0.10.1` (babel plugin in `babel.config.js`),
`expo-sensors ~57`. Install everything with `npx expo install <pkg>` so the
versions keep matching what Expo Go bundles.

## Status / what to expect

It **bundles cleanly** (`npx expo export --platform ios` → 1217 modules, no
errors). The visuals/gyro/flip are best verified **on-device** — the SkSL
compiles at runtime and the gyro mapping + flip feel are tuned by eye. Likely
next tuning passes once you see it on your phone:

- gyro sensitivity / neutral pose (the `/ 0.7` and `beta - 0.4` mapping)
- sheen width + hologram strength in the shader
- flip: currently a 2D `scaleX` flip; can be made a faux-3D perspective flip
- logos: `W` / `VISA` are system-font text placeholders (Skia `matchFont`);
  swap for real glyphs/SVG paths for an exact match

The polished **web** version (3D, Three.js) lives in the sibling `metal-card/`.
