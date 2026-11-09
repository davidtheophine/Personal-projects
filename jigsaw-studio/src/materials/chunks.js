// GLSL helpers shared by every piece material.
//
// Everything procedural is addressed in *world planar* coordinates (`wp`), i.e.
// the piece's spot on the table in world units, not in UV units - so grain and
// brushing keep the same physical scale whatever the image's aspect ratio or
// the piece count, and a wood grain runs continuously across the whole board
// as if the puzzle had been cut out of one plank.

export const NOISE = /* glsl */ `
float jsHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float jsNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = jsHash(i);
  float b = jsHash(i + vec2(1.0, 0.0));
  float c = jsHash(i + vec2(0.0, 1.0));
  float d = jsHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float jsFbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * jsNoise(p);
    p *= 2.07;
    a *= 0.5;
  }
  return s;
}
float jsLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 jsSat(vec3 c, float amount) {
  return clamp(mix(vec3(jsLum(c)), c, amount), 0.0, 1.0);
}
// A world-space direction expressed in the piece's own image plane, undoing
// the piece's yaw - lets a refracted view ray be turned into a UV offset so
// the picture looks like it is suspended *inside* the slab.
vec2 jsToPlane(vec3 d, float yaw) {
  float c = cos(yaw), s = sin(yaw);
  return vec2(d.x * c - d.z * s, -(d.x * s + d.z * c));
}
`

export const VARYINGS = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorldPos;
varying vec3 vWorldNrm;
varying float vUp;
uniform float uTime;
uniform vec2 uPuzzle;
uniform float uThickness;
uniform vec4 uPiece; // x seed, y wobble, z highlight, w yaw
uniform float uSpark; // magnet glow / snap flash
`

/** Scratch globals written by the material block, read by the hooks below it. */
export const GLOBALS = /* glsl */ `
float gRough;
float gMetal;
float gBump;
vec3 gEmissive;
`

export const BUMP_HOOK = /* glsl */ `
#ifdef JS_BUMP
  {
    // Derivative bump mapping: no tangents needed, so procedural height works
    // the same on the lid, the chamfer and the walls.
    vec3 surf = -vViewPosition;
    vec3 dpdx = dFdx(surf), dpdy = dFdy(surf);
    float dhdx = dFdx(gBump), dhdy = dFdy(gBump);
    vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
    float det = dot(dpdx, r1);
    vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
    normal = normalize(abs(det) * normal - grad);
  }
#endif
`

/** Runs before every material block; sets up the frame of reference. */
export const PREAMBLE = /* glsl */ `
  vec2 puv = vMapUv;
  vec2 wp = puv * uPuzzle;
  vec3 N = normalize(vWorldNrm);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float rim = pow(1.0 - ndv, 3.0);
  float top = smoothstep(0.1, 0.55, vUp); // 1 on the lid, 0 on walls and back
  gRough = roughness;
  gMetal = metalness;
  gBump = 0.0;
  gEmissive = vec3(0.0);
`
