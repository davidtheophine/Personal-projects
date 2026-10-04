// The whole look lives here. Two passes:
//
//   1. `CELL_FRAG` renders one fragment per dot into a tiny off-screen grid
//      texture, box-averaging the camera over that dot's footprint and grading
//      the colour. This is where "bigger dots = more generalised" happens — a
//      dot is literally the mean of everything underneath it.
//   2. `DOT_FRAG` renders full screen, reads the grid texture with NEAREST and
//      paints the dabs onto the paper.
//
// Splitting it this way means the expensive averaging runs once per dot instead
// of once per pixel, so dot size is free and the preview stays at 60fps.
//
// Shared by the Expo app and `shader-lab/` — keep it dependency-free ES module
// syntax so both can import it.

/** Oversized triangle covering clip space; avoids a quad + index buffer. */
export const SCREEN_TRIANGLE = new Float32Array([-1, -1, 3, -1, -1, 3])

export const SCREEN_VERT = `
precision highp float;
attribute vec2 aPos;
varying vec2 vScreen;
void main() {
  vScreen = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

// ---------------------------------------------------------------------------
// Pass 1 — average the camera over each dot, then grade
// ---------------------------------------------------------------------------

export const CELL_FRAG = `
precision highp float;
varying vec2 vScreen;

uniform sampler2D uCamera;
uniform vec2  uGrid;        // active dot columns / rows
uniform mat2  uCamXform;    // screen space -> camera uv (rotation, flips, cover crop)
uniform vec2  uCamCenter;
uniform float uStagger;     // 0 = square grid, 0.5 = brickwork rows
uniform float uSaturation;  // 0 = graphite, 1 = true colour, >1 = pushed
uniform float uLevels;      // palette steps per channel; outside [2, 16] means continuous

vec2 toCamera(vec2 screenUv) {
  return uCamXform * (screenUv - 0.5) + uCamCenter;
}

void main() {
  // One fragment == one dot. gl_FragCoord is the dot's grid index + 0.5.
  vec2 id = floor(gl_FragCoord.xy);
  float shift = mod(id.y, 2.0) * uStagger;
  vec2 screenUv = (id + 0.5 - vec2(shift, 0.0)) / uGrid;

  // 4x4 box average across this dot's own footprint. The camera transform is
  // affine, so one cell in screen uv is a constant step in camera uv.
  vec2 cellStep = abs(uCamXform * (1.0 / uGrid));
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 4; i++) {
      vec2 o = (vec2(float(i), float(j)) - 1.5) * 0.25 * cellStep;
      acc += texture2D(uCamera, toCamera(screenUv) + o).rgb;
    }
  }
  vec3 c = acc * (1.0 / 16.0);

  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 graded = mix(vec3(luma), c, uSaturation);

  // Posterise towards a limited palette, the way a painter works from a set
  // number of mixed pigments rather than a continuous gradient.
  if (uLevels > 1.5 && uLevels < 16.5) {
    float steps = uLevels - 1.0;
    graded = floor(graded * steps + 0.5) / steps;
  }

  // Alpha carries the ungraded luminance so pass 2 can size dots by tone even
  // when the colour slider is at zero.
  gl_FragColor = vec4(clamp(graded, 0.0, 1.0), luma);
}
`

// ---------------------------------------------------------------------------
// Pass 2 — paint the dabs
// ---------------------------------------------------------------------------

export const DOT_FRAG = `
precision highp float;
varying vec2 vScreen;

uniform sampler2D uCells;
uniform vec2  uResolution;  // drawing buffer, device px
uniform vec2  uGrid;        // active dot columns / rows
uniform vec2  uGridMax;     // allocated size of uCells
uniform float uFill;        // dot diameter as a fraction of its cell
uniform float uStagger;
uniform float uJitter;      // per-dot size wobble, so it reads as hand-placed
uniform float uLumaSize;    // how much darker tones swell the dab
uniform vec3  uPaper;
uniform float uPaperTint;   // bleed of dot colour into the gaps

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 cellPx = uResolution / uGrid;
  float radiusBase = 0.5 * min(cellPx.x, cellPx.y) * uFill;

  // Walk the 3x3 neighbourhood rather than just this fragment's own cell, so
  // dabs are allowed to overlap (uFill > 1) instead of being clipped square.
  vec2 baseId = floor(frag / cellPx);
  float bestCover = 0.0;
  vec3 bestColour = vec3(0.0);
  vec3 nearColour = vec3(0.0);
  float nearDist = 1e9;

  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 id = baseId + vec2(float(dx), float(dy));
      if (id.x < 0.0 || id.y < 0.0 || id.x >= uGrid.x || id.y >= uGrid.y) continue;

      float shift = mod(id.y, 2.0) * uStagger;
      vec2 centre = (id + 0.5 - vec2(shift, 0.0)) * cellPx;
      vec4 cell = texture2D(uCells, (id + 0.5) / uGridMax);

      float swell = 1.0 + uLumaSize * (0.5 - cell.a) * 2.0;
      float wobble = 1.0 + uJitter * (hash(id) - 0.5) * 2.0;
      float radius = radiusBase * swell * wobble;

      float d = distance(frag, centre);
      float cover = 1.0 - smoothstep(radius - 1.0, radius + 1.0, d);
      if (cover > bestCover) {
        bestCover = cover;
        bestColour = cell.rgb;
      }
      if (d < nearDist) {
        nearDist = d;
        nearColour = cell.rgb;
      }
    }
  }

  vec3 paper = mix(uPaper, nearColour, uPaperTint);
  gl_FragColor = vec4(mix(paper, bestColour, bestCover), 1.0);
}
`
