import { Skia } from '@shopify/react-native-skia'
import { hexToRgb } from '../config.js'

// Skia SkSL translation of the web WebGL "base" genre-field:
// four desaturated radial gradients over a dark base (mingling), dominance
// toward the picker, cursor recess, sparse dots + cursor dot-glow, grain, vignette.
// Skia's fragCoord is top-down, so p = uv directly (no y-flip).
const SKSL = `
uniform float2 u_resolution;
uniform float u_time;
uniform float2 u_cursor;
uniform float u_baseRadius;
uniform float u_dominance;
uniform float u_blobOpacity;
uniform float u_flow;
uniform float u_sat;
uniform float u_bright;
uniform float u_cursorSize;
uniform float u_cursorShadow;
uniform float u_halo;
uniform float u_haloRadius;
uniform float u_haloWidth;
uniform float u_grain;
uniform float u_dotScale;
uniform float u_dotOpacity;
uniform float u_vignette;
uniform float u_dotGlowRadius;
uniform float u_dotGlowBoost;
uniform float u_isMeta;
uniform float3 u_baseColor;
uniform float3 u_colTL;
uniform float3 u_colTR;
uniform float3 u_colBL;
uniform float3 u_colBR;
uniform float3 u_edgeTL;
uniform float3 u_edgeTR;
uniform float3 u_edgeBL;
uniform float3 u_edgeBR;

const float2 cTL = float2(0.0, 0.0);
const float2 cTR = float2(1.0, 0.0);
const float2 cBL = float2(0.0, 1.0);
const float2 cBR = float2(1.0, 1.0);

float hash(float2 p){ return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
float noise(float2 p){
  float2 i = floor(p); float2 f = fract(p);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(float2 p){
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}
float d2(float2 a, float2 b){ float2 d = a - b; return dot(d, d); }

float4 cornerRadii(){
  float kc = 0.2;
  float aTL = exp(-d2(u_cursor, cTL) / kc);
  float aTR = exp(-d2(u_cursor, cTR) / kc);
  float aBL = exp(-d2(u_cursor, cBL) / kc);
  float aBR = exp(-d2(u_cursor, cBR) / kc);
  float aS = aTL + aTR + aBL + aBR;
  return u_baseRadius * (1.0 + u_dominance * float4(aTL, aTR, aBL, aBR) / aS);
}

float3 overBlob(float3 col, float2 sp, float2 c, float R, float3 color, float op){
  float d = distance(sp, c);
  return mix(col, color, clamp(op * exp(-(d * d) / (R * R)), 0.0, 1.0));
}

float2 warpPos(float2 p){
  float t = u_time * 0.06;
  float2 w = float2(fbm(p * 2.0 + float2(0.0, t)), fbm(p * 2.0 + float2(t, 0.0))) - 0.5;
  return p + w * u_flow;
}

float3 radials(float2 sp){
  float4 r = cornerRadii();
  if (u_isMeta > 0.5) {
    // Metaballs: inverse-square influence per corner, lifted out of the base by
    // the total field strength (web effect 2). Each blob is itself a radial
    // gradient — centre colour at its corner, edge colour at its rim.
    float dTL = distance(sp, cTL);
    float dTR = distance(sp, cTR);
    float dBL = distance(sp, cBL);
    float dBR = distance(sp, cBR);
    float iTL = r.x * r.x * 0.12 / (dTL * dTL + 0.02);
    float iTR = r.y * r.y * 0.12 / (dTR * dTR + 0.02);
    float iBL = r.z * r.z * 0.12 / (dBL * dBL + 0.02);
    float iBR = r.w * r.w * 0.12 / (dBR * dBR + 0.02);
    float sum = iTL + iTR + iBL + iBR;
    float3 gTL = mix(u_colTL, u_edgeTL, clamp(dTL / r.x, 0.0, 1.0));
    float3 gTR = mix(u_colTR, u_edgeTR, clamp(dTR / r.y, 0.0, 1.0));
    float3 gBL = mix(u_colBL, u_edgeBL, clamp(dBL / r.z, 0.0, 1.0));
    float3 gBR = mix(u_colBR, u_edgeBR, clamp(dBR / r.w, 0.0, 1.0));
    float3 c = (gTL * iTL + gTR * iTR + gBL * iBL + gBR * iBR) / sum;
    return mix(u_baseColor, c, clamp(smoothstep(0.5, 1.6, sum), 0.0, 1.0));
  }
  float3 col = u_baseColor;
  col = overBlob(col, sp, cBR, r.w, u_colBR, u_blobOpacity);
  col = overBlob(col, sp, cBL, r.z, u_colBL, u_blobOpacity);
  col = overBlob(col, sp, cTL, r.x, u_colTL, u_blobOpacity);
  col = overBlob(col, sp, cTR, r.y, u_colTR, u_blobOpacity);
  return col;
}

half4 main(float2 fragCoord){
  float2 uv = fragCoord / u_resolution;
  float2 p = uv;

  float3 col = radials(warpPos(p));
  float l = dot(col, float3(0.299, 0.587, 0.114));
  col = mix(float3(l), col, u_sat) * u_bright;

  float dc = distance(p, u_cursor);
  col = col * (1.0 - u_cursorShadow * exp(-(dc * dc) / (u_cursorSize * u_cursorSize)));
  col = col + float3(1.0) * exp(-pow((dc - u_haloRadius) / max(u_haloWidth, 0.001), 2.0)) * u_halo;

  float aspect = u_resolution.x / u_resolution.y;
  float2 gf = fract(float2(p.x * aspect, p.y) * u_dotScale) - 0.5;
  float dots = 1.0 - smoothstep(0.04, 0.12, length(gf));
  float dotGlow = smoothstep(u_dotGlowRadius, 0.0, dc) * u_dotGlowBoost;
  col = col + float3(dots) * (u_dotOpacity + dotGlow);

  col = col * mix(1.0 - u_vignette * 0.6, 1.0, smoothstep(1.3, 0.35, distance(uv, float2(0.5))));

  col = col + (hash(fragCoord * 0.5 + u_time * 3.7) - 0.5) * u_grain;

  return half4(col, 1.0);
}
`

export const genreEffect = Skia.RuntimeEffect.Make(SKSL)
if (!genreEffect) {
  console.error('[genreField] SkSL failed to compile')
}

// Non-animated uniform values from a params object (colors → [r,g,b]).
export function staticUniforms(params) {
  return {
    u_baseRadius: params.baseRadius,
    u_dominance: params.dominance,
    u_blobOpacity: params.blobOpacity,
    u_flow: params.flow,
    u_sat: params.sat,
    u_bright: params.bright,
    u_cursorSize: params.cursorSize,
    u_cursorShadow: params.cursorShadow,
    u_halo: params.halo,
    u_haloRadius: params.haloRadius,
    u_haloWidth: params.haloWidth,
    u_grain: params.grain,
    u_dotScale: params.dotScale,
    u_dotOpacity: params.dotOpacity,
    u_vignette: params.vignette,
    u_dotGlowRadius: params.dotGlowRadius,
    u_dotGlowBoost: params.dotGlowBoost,
    u_isMeta: params.effect === 'Metaballs' ? 1 : 0,
    u_baseColor: hexToRgb(params.baseColor),
    u_colTL: hexToRgb(params.colTL),
    u_colTR: hexToRgb(params.colTR),
    u_colBL: hexToRgb(params.colBL),
    u_colBR: hexToRgb(params.colBR),
    u_edgeTL: hexToRgb(params.edgeTL ?? params.colTL),
    u_edgeTR: hexToRgb(params.edgeTR ?? params.colTR),
    u_edgeBL: hexToRgb(params.edgeBL ?? params.colBL),
    u_edgeBR: hexToRgb(params.edgeBR ?? params.colBR),
  }
}
