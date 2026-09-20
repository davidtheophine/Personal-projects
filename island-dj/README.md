# Island DJ — genre-grid picker (web prototype)

A prototype of a **Dynamic Island → Spotify DJ** control: instead of typing at the DJ,
you drag a picker around a **2D genre plane**. A live shader gradient blooms around your
finger and the genre label updates as you move — giving the AI a *direction*, not text.

> The real iOS Dynamic Island (Live Activities) can only render static SwiftUI with
> button/toggle taps — it can't host a drag gesture or a live shader. So this is a faithful
> **simulation** of the Island, which is all a prototype needs. Web first to dial in the
> shader + drag feel; an Expo/Skia port comes next.

## Run

```bash
npm install          # uses the WS internal registry on this Mac
npm run dev          # http://localhost:5173  (add -- --host to open on your phone)
```

Headless visual check (system Chrome, swiftshader for WebGL2):

```bash
npm run shot -- http://localhost:5173/ /tmp/island.png
```

## Structure

- `src/data/genres.js` — preset genre map (`x,y` on the plane, color, artist). **Neutral.**
- `src/lib/mapping.js` — pure `nearestGenre(cursor, genres)`. **Neutral, testable.**
- `src/shader/shaders.js` — GLSL ES 3.00 genre-field fragment shader (written close to
  Skia SkSL for the port). `useGenreShader.js` — WebGL2 context + rAF loop; eases a smoothed
  cursor and calls back each frame so the crosshair + label move without React re-renders.
- `src/island/GenreGrid.jsx` — the hero panel: shader plane + quadrant axes + draggable
  crosshair + animated genre label.
- `scripts/shot.mjs` — puppeteer-core screenshot helper.

## Status / next

- [x] Hero: draggable picker, blooming genre-field shader, live genre label.
- [ ] Dynamic Island morph flow: compact pill → expanded now-playing → grid (Motion `layout`).
- [ ] Tap-to-collapse back to the previous state.
- [ ] Polish pass (palette, bloom, crosshair, haptic-style feedback) — likely with DialKit live controls.
- [ ] Expo/Skia port (`island-dj-native/`): reuse `data/` + `lib/` + shader; re-implement rendering.

## Sharing note

`package-lock.json` will reference the WS internal registry (`reposerver.w10external.com`).
Host-swap it to public npm before handing this to friends/CI.
