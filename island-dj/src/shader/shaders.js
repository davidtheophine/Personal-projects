// WebGL2 / GLSL ES 3.00 genre-field shader with a switchable EFFECT (u_effect):
// 0 Base · 1 Dither · 2 Metaballs · 3 Chromatic · 4 Caustics · 5 Bloom
// 6 Specular · 7 Fresnel · 8 Curl flow.  Base = four desaturated radial gradients
// alpha-composited over a dark base (mingling), dominance toward the picker, a
// cursor recess (elevation), sparse dots, grain, vignette. Close to Skia SkSL.

export const VERT = /* glsl */ `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`

export const FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform vec2  u_resolution;
uniform float u_time;
uniform vec2  u_cursor;
uniform float u_baseRadius, u_dominance, u_blobOpacity, u_flow, u_sat, u_bright;
uniform float u_cursorSize, u_cursorShadow, u_halo, u_haloRadius, u_haloWidth, u_grain;
uniform float u_dotScale, u_dotOpacity, u_vignette;
uniform float u_dotGlowRadius, u_dotGlowBoost;
uniform vec3  u_baseColor, u_colTL, u_colTR, u_colBL, u_colBR;
uniform int   u_effect;
uniform float u_effectAmt;

out vec4 fragColor;

const vec2 cTL = vec2(0.0, 0.0), cTR = vec2(1.0, 0.0), cBL = vec2(0.0, 1.0), cBR = vec2(1.0, 1.0);

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }
float d2(vec2 a, vec2 b){ vec2 d = a - b; return dot(d, d); }

void corners(out float rTL, out float rTR, out float rBL, out float rBR){
  float kc = 0.2;
  float aTL = exp(-d2(u_cursor, cTL) / kc), aTR = exp(-d2(u_cursor, cTR) / kc);
  float aBL = exp(-d2(u_cursor, cBL) / kc), aBR = exp(-d2(u_cursor, cBR) / kc);
  float aS = aTL + aTR + aBL + aBR; aTL /= aS; aTR /= aS; aBL /= aS; aBR /= aS;
  rTL = u_baseRadius * (1.0 + u_dominance * aTL);
  rTR = u_baseRadius * (1.0 + u_dominance * aTR);
  rBL = u_baseRadius * (1.0 + u_dominance * aBL);
  rBR = u_baseRadius * (1.0 + u_dominance * aBR);
}

vec3 overBlob(vec3 col, vec2 sp, vec2 c, float R, vec3 color, float op){
  float d = distance(sp, c);
  return mix(col, color, clamp(op * exp(-(d * d) / (R * R)), 0.0, 1.0));
}

vec2 warpPos(vec2 p, bool curl){
  float t = u_time * 0.06;
  if (curl){
    float e = 0.01;
    float n0 = fbm(p * 3.0 + t), nx = fbm((p + vec2(e, 0.0)) * 3.0 + t), ny = fbm((p + vec2(0.0, e)) * 3.0 + t);
    vec2 g = vec2(nx - n0, ny - n0) / e;
    return p + vec2(g.y, -g.x) * u_flow * 0.12;
  }
  vec2 w = vec2(fbm(p * 2.0 + vec2(0.0, t)), fbm(p * 2.0 + vec2(t, 0.0))) - 0.5;
  return p + w * u_flow;
}

vec3 radials(vec2 sp, bool meta){
  float rTL, rTR, rBL, rBR; corners(rTL, rTR, rBL, rBR);
  if (meta){
    float iTL = rTL * rTL * 0.12 / (d2(sp, cTL) + 0.02);
    float iTR = rTR * rTR * 0.12 / (d2(sp, cTR) + 0.02);
    float iBL = rBL * rBL * 0.12 / (d2(sp, cBL) + 0.02);
    float iBR = rBR * rBR * 0.12 / (d2(sp, cBR) + 0.02);
    float sum = iTL + iTR + iBL + iBR;
    vec3 c = (u_colTL * iTL + u_colTR * iTR + u_colBL * iBL + u_colBR * iBR) / sum;
    return mix(u_baseColor, c, clamp(smoothstep(0.5, 1.6, sum), 0.0, 1.0));
  }
  vec3 col = u_baseColor;
  col = overBlob(col, sp, cBR, rBR, u_colBR, u_blobOpacity);
  col = overBlob(col, sp, cBL, rBL, u_colBL, u_blobOpacity);
  col = overBlob(col, sp, cTL, rTL, u_colTL, u_blobOpacity);
  col = overBlob(col, sp, cTR, rTR, u_colTR, u_blobOpacity);
  return col;
}

vec3 field(vec2 p, vec2 uv, int effect){
  vec3 col = radials(warpPos(p, effect == 8), effect == 2);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, u_sat) * u_bright;

  float dc = distance(p, u_cursor);
  col *= 1.0 - u_cursorShadow * exp(-(dc * dc) / (u_cursorSize * u_cursorSize));
  col += vec3(1.0) * exp(-pow((dc - u_haloRadius) / max(u_haloWidth, 0.001), 2.0)) * u_halo;

  float aspect = u_resolution.x / u_resolution.y;
  vec2 gf = fract(vec2(p.x * aspect, p.y) * u_dotScale) - 0.5;
  float dots = 1.0 - smoothstep(0.04, 0.12, length(gf));
  float dotGlow = smoothstep(u_dotGlowRadius, 0.0, dc) * u_dotGlowBoost; // dots brighten near the picker
  col += vec3(dots) * (u_dotOpacity + dotGlow);

  col *= mix(1.0 - u_vignette * 0.6, 1.0, smoothstep(1.3, 0.35, distance(uv, vec2(0.5))));
  return col;
}

float caustic(vec2 p){
  float t = u_time * 0.35;
  vec2 q = p * 6.0;
  float a = sin(q.x + fbm(q + t) * 2.0) + sin(q.y + fbm(q.yx - t) * 2.0);
  return pow(abs(a) * 0.5, 3.0);
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = vec2(uv.x, 1.0 - uv.y);
  int e = u_effect;

  vec3 col;
  if (e == 3){ // chromatic aberration
    float amt = 0.010 * u_effectAmt * (0.25 + distance(uv, vec2(0.5)));
    vec2 dir = normalize(p - vec2(0.5) + vec2(1e-4));
    col = vec3(field(p + dir * amt, uv, e).r, field(p, uv, e).g, field(p - dir * amt, uv, e).b);
  } else {
    col = field(p, uv, e);
  }

  if (e == 5){ // bloom
    vec3 b = vec3(0.0);
    for (int i = 0; i < 6; i++){
      float a = float(i) / 6.0 * 6.2831853;
      b += field(p + vec2(cos(a), sin(a)) * 0.03, uv, e);
    }
    b /= 6.0;
    col += b * smoothstep(0.35, 0.9, max(max(b.r, b.g), b.b)) * u_effectAmt * 1.2;
  } else if (e == 4){ // caustics
    col += vec3(0.55, 0.8, 1.0) * caustic(p) * u_effectAmt * 0.6;
  } else if (e == 6){ // specular sweep
    float pos = (p.x + (1.0 - p.y)) * 0.5;
    col += vec3(1.0) * smoothstep(0.05, 0.0, abs(pos - fract(u_time * 0.14))) * u_effectAmt * 0.5;
  } else if (e == 7){ // fresnel edge glow
    float m = min(min(p.x, 1.0 - p.x), min(p.y, 1.0 - p.y));
    col += mix(vec3(0.6, 0.9, 1.0), col, 0.3) * (1.0 - smoothstep(0.0, 0.28, m)) * u_effectAmt * 0.6;
  } else if (e == 1){ // dither (posterize + noise)
    float levels = mix(20.0, 5.0, clamp(u_effectAmt, 0.0, 1.0));
    col = floor(col * levels + 0.5 + (hash(gl_FragCoord.xy) - 0.5)) / levels;
  }

  col += (hash(gl_FragCoord.xy * 0.5 + u_time * 3.7) - 0.5) * u_grain;
  fragColor = vec4(col, 1.0);
}`
