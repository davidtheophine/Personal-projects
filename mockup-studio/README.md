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
- One-click **WebM** export, baked from the same renderer that draws the live preview

## Stack
Vite 6 · React 19 · Tailwind v4 · shadcn/ui (Base UI) · TypeScript · vitest

The whole scene is composited by one pure function,
`renderFrame(ctx, project, video, t)` (`src/render/render-frame.ts`), which powers the
live preview, the timeline thumbnails, and the exporter — so what you see is exactly
what you export.

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
Later milestones: crisp **H.264 MP4** export via WebCodecs + `mp4-muxer`, **GIF** export,
more device models/colours, and keyboard shortcuts + undo/redo.
