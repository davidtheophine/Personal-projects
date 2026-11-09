# Jigsaw Studio

Drop in any picture and it is cut into a real jigsaw — chunky 3D pieces with
proper interlocking knobs, lying on a table you can orbit around. Drag a piece
near one of its neighbours and it is pulled in, clicks home with a spray of
sparks, and from then on the two move as one.

Then change what the pieces are made of. Wood, jelly, gummy, metal, glass or
plain cardboard — each one re-renders the picture *as* that substance rather
than printing it on top, so the same painting arrives stained into the grain,
suspended in a wobbling slab, or bitten into anodised aluminium.

Six public-domain paintings ship with it; drop a file anywhere on the window to
use your own.

```bash
npm install
npm run dev
```

## How it works

**The cut** (`src/puzzle/edges.js`, `geometry.js`). Every internal edge of the
grid is generated once as a bezier chain with a proper undercut neck, and both
pieces either side of it are built from that same list of points — one of them
walking it backwards. That is what makes pieces interlock exactly instead of
leaving hairline gaps. Each outline becomes an `ExtrudeGeometry` with a milled
chamfer, laid flat on the XZ plane.

UVs come from each vertex's position in the whole-puzzle plane, not from the
piece. A tab reaches into its neighbour's cell and has to carry the bit of the
painting that lives there, and every shader gets to address the image through
one varying.

**The magnets** (`src/puzzle/Pieces.jsx`). A piece belongs to a rigid *cluster*
which owns a yaw and an anchor; a piece's position is derived from where its
own cell sits inside that cluster:

```
pos = rotateY(home - clusterCentre, yaw) + anchor
```

so a half-built puzzle stays rigid for free, with no per-piece offsets to
drift. While you drag, the best available join is found each frame; inside the
magnet's reach the cluster is reeled towards alignment, and close enough it
welds, sparks and keeps following your cursor as one bigger cluster.

**The materials** (`src/materials/`). One `MeshPhysicalMaterial` per piece,
each patched through `onBeforeCompile` with a per-preset block that replaces
`<map_fragment>` and writes the roughness, metalness, relief and emission the
rest of the shader then uses. All the pieces of a preset share a single
compiled program (`customProgramCacheKey`); the separate material instances
exist only so each piece can carry its own uniforms — seed, wobble, hover,
yaw, snap flash — which three only re-uploads when the material changes
between draw calls.

Procedural patterns are addressed in world planar coordinates, so a wood grain
runs continuously across the whole board as if the puzzle were cut from one
plank, at the same physical scale whatever the piece count.

**The lighting** (`src/scene/Stage.jsx`). A studio built from `Lightformer`
panels rather than an HDRI, so nothing is fetched at runtime. A flat slab seen
from the default camera mirrors whatever sits about 40° up and behind it, so
that is exactly where the key panel goes — narrow and bright, because a
uniformly lit sky turns both metal and glass into white cardboard.

**The camera** (`src/scene/Rig.jsx`) projects the four corners of the scatter
area and binary-searches the distance that just fits them inside the part of
the window the UI is not sitting on, then slides the look-at point until the
content is centred in what is left.

## Controls

| | |
|---|---|
| drag a piece | move it; neighbours snap on contact |
| <kbd>R</kbd> / <kbd>Q</kbd> | rotate the held cluster (with **Rotate** on) |
| drag the background | orbit |
| Scatter / Re-cut / Solve it | bottom toolbar |

URL parameters, handy for sharing a look: `?material=glass&pieces=6&image=the-kiss&solved=1`.

## Scripts

```bash
npm run paintings            # re-fetch the starter paintings from Wikimedia
node scripts/shot.mjs        # still of the running app, via system Chrome
node scripts/snap-shot.mjs   # drives a real drag and shoots the snap
```

## Credits

The bundled paintings are public domain, pulled from Wikimedia Commons;
`public/paintings/credits.json` records the source file and licence for each.
