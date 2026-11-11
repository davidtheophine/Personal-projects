# Mockup Studio

Turn a raw mobile **screen recording** into a polished, shareable clip — entirely in the
browser, with no upload and no backend. Drop in a recording, see it inside a realistic
iPhone frame on a nice background, add tap ripples and zoom-to-highlight moments,
trim/split it, then export a video.

Everything runs client-side, so recordings never leave your machine.

## Features
- Import a screen recording (`.mov` / `.mp4`) by drag-and-drop
- Procedurally-rendered iPhone device frame (no image assets required)
- Backgrounds: an uploaded image (with exposure / blur / contrast / saturation /
  vignette / tint), a user-definable gradient, or a solid colour
- Zoom-to-highlight track (spring-eased) and manually-placed tap ripples
- Trim + split; aspect-ratio presets (9:16 / 1:1 / 16:9)
- One-click **MP4** export (H.264/AAC), baked from the same renderer that draws the live preview —
  typically ~10× faster than real time (see [Export](#export))

## Stack
Vite 6 · React 19 · Tailwind v4 · shadcn/ui (Base UI) · three.js · [Mediabunny](https://mediabunny.dev) (WebCodecs) · TypeScript · vitest

The whole scene is composited by one pure function,
`renderFrame(ctx, project, video, t)` (`src/render/render-frame.ts`), which powers the
live preview, the timeline thumbnails, and the exporter — so what you see is exactly
what you export.

## Export
`exportVideo()` (`src/export/export.ts`) has two paths:

- **Fast path (default)** — `src/export/fast-export.ts`. Decodes each clip with WebCodecs (via
  Mediabunny), renders every output frame at exactly *t = i / 30* with `renderFrame`, and encodes it with
  the hardware H.264 encoder. It runs as fast as the machine allows (a 30 s recording exports in ~3 s on an
  M-series Mac), is frame-exact (no dropped or repeated frames), keeps going in a background tab, and every
  step is guarded by a stall watchdog. Audio: only the kept regions are decoded, sped-up/slowed clips are
  time-stretched with their pitch kept, and everything is mixed offline at 48 kHz. Output is MP4
  (H.264/AAC), or WebM (VP9/Opus) in browsers that can't encode AAC. Mediabunny is loaded on first export.
- **Compatibility path** — `src/export/export-webm.ts`. Plays the timeline through `MediaRecorder` in real
  time. Used only where WebCodecs is missing (or if the fast path fails mid-way); the UI then shows
  "keep this tab open", because a hidden tab pauses it.

Frame rate and bitrates are constants at the top of `fast-export.ts` (`EXPORT_FPS = 30`). The whole file is
assembled in memory, which is fine for screen-recording-length clips but not for hour-long ones.

## Develop
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run preview  # serve the production build locally
npm test         # vitest unit tests
```

## Hosting (Vercel)
It's a static SPA (`vite.config.ts` sets `base: "./"`, so it works served from any path).
The repo-root `vercel.json` tells Vercel to build this `mockup-studio/` subfolder and
serve its `dist/`, so importing `Personal-projects` into Vercel works with no extra
configuration. Every push to `main` auto-deploys.

## Roadmap
Later milestones: **GIF** export, more device models/colours, and keyboard shortcuts + undo/redo.
