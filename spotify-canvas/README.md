# spotify-canvas

An **infinite-canvas music discovery** proof-of-concept. Start at one song, hit **More**, and
five *similar-yet-deliberately-different* songs fan out as connected cards. Keep going from any
card to wander a pannable, zoomable **web of music** — play cards, like them, and (soon) stream
full tracks + save to a real Spotify playlist.

> Why not "just call Spotify"? Spotify deprecated its Recommendations / Audio-Features /
> Related-Artists endpoints (Nov 2024) and locked down dev-mode access (Feb 2026). So the
> discovery **"brain" is a hand-authored curated graph**, and playback/save use the still-supported
> Web Playback SDK + playlist API (a later layer). See `docs` in the plan for the full rationale.

## Run it

```bash
npm install
npm run dev          # http://127.0.0.1:5173  (loopback literal, not "localhost")
```

No accounts, keys, or setup needed for the demo: playback is a **simulated** progress bar and likes
go to a local "Liked" tray. Real full-track playback + playlist saves are the next layer (below).

```bash
npm test             # unit tests for the platform-neutral core (Vitest)
npm run build        # production build
node scripts/shot.mjs [url]   # dev-only headless screenshots (uses system Chrome)
```

## Architecture

The split is deliberate so an Expo port reuses the logic and only re-implements rendering:

- **`src/core/` + `src/data/` — platform-neutral (no DOM).** The song model + catalog, the
  `RecommendationProvider` (curated-graph diversity picker), radial fan-out math, the
  "give-me-more" graph expansion (prefer-unseen; link-back to existing cards), the simulated
  playback controller, and the local save store. All unit-tested.
- **`src/web/` + `src/auth/` — web-only.** React Flow canvas + `SongCardNode`, floating edges,
  artwork resolver (iTunes, with a gradient fallback), and — coming next — Spotify OAuth (PKCE),
  the Web Playback SDK controller, and playlist save.

Stack: Vite + React 19 + `@xyflow/react` (React Flow), plain JS/JSX.

## Real Spotify playback + save (next layer)

Optional; the demo works fully without it. When wired up it needs a one-time setup:

1. Create an app in the Spotify Developer Dashboard; copy the **Client ID** into `.env`
   (`VITE_SPOTIFY_CLIENT_ID`, see `.env.example`). **No client secret** (PKCE).
2. Add the redirect URI **exactly** `http://127.0.0.1:5173/callback` (loopback literal — Spotify
   now bans `http://localhost`).
3. Add your own Spotify account under **User Management** (dev mode allows **5 users**, all must be
   **Premium** for real audio — a Premium Family membership qualifies).

Scopes: `streaming user-read-email user-read-private user-modify-playback-state
playlist-modify-private`. Playback starts via `PUT /me/player/play`; saves via
`POST /me/playlists` + `POST /playlists/{id}/items`. Non-Premium / logged-out sessions fall back to
the simulated player automatically.

## Roadmap

- **Phase 1 — browser POC** ✅ interaction, canvas, simulated playback, local likes.
- **Phase 1b — real Spotify** (next): OAuth/PKCE, Web Playback SDK, playlist save, graceful fallback.
- **Phase 2 — Expo Go**: reuse `core/` + `data/`, re-implement the canvas with
  gesture-handler + reanimated + react-native-svg; simulated audio + local save only.
- **Phase 3 — hosted, real users**: "connect your Spotify," seed from your Liked Songs. Feasible for
  a small circle (Spotify dev mode caps at 5 Premium users; a true public launch needs Extended
  Quota Mode — a business + ~250k-MAU review).
