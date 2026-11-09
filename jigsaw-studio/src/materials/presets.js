import { Color } from 'three'

// Each preset is three things: the MeshPhysicalMaterial parameters that set up
// the lighting response, a GLSL block that re-renders the painting *as* that
// substance, and the handful of knobs worth exposing in the UI.
//
// The GLSL block runs in place of <map_fragment>, after chunks.PREAMBLE, and
// is expected to write diffuseColor plus the gRough / gMetal / gBump /
// gEmissive globals.

const control = (uniform, label, min, max, value, step = 0.01) => ({
  uniform,
  label,
  min,
  max,
  value,
  step,
})

export const PRESETS = {
  cardboard: {
    label: 'Cardboard',
    hint: 'the honest original: matte board, paper fibres, true colour',
    swatch: 'linear-gradient(140deg,#d8c7a6,#b59a6f)',
    bump: 0.9,
    shadowIntensity: 1,
    material: {
      roughness: 0.82,
      metalness: 0,
      sheen: 0.25,
      sheenRoughness: 0.9,
      sheenColor: new Color('#fff3df'),
      envMapIntensity: 0.55,
      clearcoat: 0,
    },
    controls: [control('uPaperFibre', 'Fibre', 0, 2, 0.8), control('uPaperWear', 'Edge wear', 0, 1, 0.35)],
    glsl: /* glsl */ `
      vec3 img = texture2D(map, puv).rgb;
      float fibre = jsFbm(wp * 55.0) * 0.6 + jsNoise(wp * vec2(260.0, 14.0)) * 0.4;
      float flute = 0.5 + 0.5 * sin(vLocal.y / max(uThickness, 0.001) * 18.0);
      vec3 board = vec3(0.74, 0.66, 0.53) * (0.72 + 0.4 * fibre);
      // print sits on the board: fibres break the ink up a little
      vec3 face = img * (0.9 + 0.2 * fibre);
      // the cut edge shows raw board, more so where the knife tore it
      float wear = uPaperWear * smoothstep(0.35, 0.0, top);
      face = mix(face, board, wear);
      diffuseColor.rgb = mix(board * (0.85 + 0.3 * flute), face, top);
      gRough = mix(0.95, 0.8 - 0.1 * fibre, top);
      gMetal = 0.0;
      gBump = fibre * 0.05 * uPaperFibre;
    `,
  },

  wood: {
    label: 'Wood',
    hint: 'image soaked into the grain like a stain, not painted on top',
    swatch: 'linear-gradient(140deg,#c08a4e,#5b3415)',
    bump: 1,
    shadowIntensity: 1,
    material: {
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.35,
      sheen: 0,
      envMapIntensity: 0.8,
    },
    controls: [
      control('uWoodGrain', 'Grain', 0.2, 4, 1.1),
      control('uWoodStain', 'Stain', 0, 1, 0.9),
      control('uWoodRelief', 'Relief', 0, 1, 0.45),
    ],
    glsl: /* glsl */ `
      vec3 img = texture2D(map, puv).rgb;
      // rings stretched along +x and warped so the stock wanders like real timber
      float warp = jsFbm(wp * vec2(0.4, 1.0) * uWoodGrain) * 2.4;
      float rings = sin((wp.y * 2.4 * uWoodGrain + warp) * 3.14159);
      float grain = pow(0.5 + 0.5 * rings, 2.4);
      float fibre = jsNoise(wp * vec2(3.0, 110.0)) * 0.6 + jsNoise(wp * vec2(1.5, 26.0)) * 0.4;
      float pores = smoothstep(0.80, 1.0, jsNoise(wp * vec2(70.0, 230.0)));
      vec3 pale = vec3(0.72, 0.52, 0.29);
      vec3 deep = vec3(0.16, 0.085, 0.04);

      // A stain can only go darker and warmer, never brighter or bluer - so
      // the painting is mapped onto the wood's own range, from bare pale
      // stock to burnt, and only part of its hue survives. Grain stays on top
      // as a multiply, which is why the picture still reads as timber.
      float value = pow(clamp(jsLum(img), 0.0, 1.0), 1.0);
      vec3 chroma = img / max(jsLum(img), 0.05);
      float bare = clamp(grain * 0.9 + fibre * 0.14, 0.0, 1.0);
      vec3 tone = mix(deep, pale, mix(bare, value, uWoodStain));
      vec3 face = tone * mix(vec3(1.0), chroma, 0.45 * uWoodStain) * (0.78 + 0.44 * grain);
      face *= 1.0 - pores * 0.22;

      // walls show end grain - layers across the thickness of the slab
      float endg = 0.5 + 0.5 * sin(vLocal.y / max(uThickness, 0.001) * 26.0 + jsNoise(wp * 40.0) * 5.0);
      vec3 side = mix(deep, pale, 0.3 + 0.35 * endg);
      diffuseColor.rgb = mix(side, face, top);
      gRough = mix(0.75, 0.46 - 0.18 * grain, top);
      gMetal = 0.0;
      gBump = (grain * 0.5 + fibre * 0.3 + pores * 0.8) * 0.045 * uWoodRelief;
    `,
  },

  jelly: {
    label: 'Jelly',
    hint: 'image suspended inside a wobbling translucent slab',
    swatch: 'linear-gradient(140deg,#ff7aa8,#7d3cff)',
    bump: 0,
    shadowIntensity: 0.35,
    wobble: 1,
    material: {
      roughness: 0.14, // a touch softer than glass: a fatter, wetter highlight
      metalness: 0,
      transmission: 0.62,
      thickness: 0.7,
      ior: 1.36,
      attenuationDistance: 0.9,
      attenuationColor: new Color('#ff9ec4'),
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      sheen: 0.22,
      sheenColor: new Color('#ffd9e8'),
      envMapIntensity: 1.1,
    },
    controls: [
      control('uJellyGlow', 'Inner glow', 0, 1.5, 0.7),
      control('uJellySat', 'Juice', 0.5, 2, 1.35),
      control('uJellyWobble', 'Wobble', 0, 2, 1),
    ],
    glsl: /* glsl */ `
      // the picture floats a slab-thickness below the surface, so it shifts
      // under the refracted view ray as the camera moves
      vec2 off = jsToPlane(refract(-V, N, 1.0 / 1.36), uPiece.w) * uThickness * 2.2 / uPuzzle;
      vec3 img = texture2D(map, puv + off).rgb;
      vec3 c = jsSat(pow(clamp(img, 0.0, 1.0), vec3(0.92)), uJellySat);
      float thick = mix(0.45, 1.0, top);
      diffuseColor.rgb = c * mix(1.5, 0.95, thick);
      // stand-in for subsurface: thin edges catch light, the body glows faintly
      gEmissive = c * (rim * 0.8 + 0.1) * uJellyGlow;
      gRough = 0.12;
      gMetal = 0.0;
    `,
  },

  gummy: {
    label: 'Gummy',
    hint: 'waxy, sugar-dusted, colours pushed to candy',
    swatch: 'linear-gradient(140deg,#ffd166,#ef476f)',
    bump: 1,
    shadowIntensity: 0.6,
    wobble: 0.45,
    material: {
      roughness: 0.42,
      metalness: 0,
      transmission: 0.35,
      thickness: 0.5,
      ior: 1.42,
      attenuationDistance: 0.8,
      attenuationColor: new Color('#ffb703'),
      clearcoat: 0.6,
      clearcoatRoughness: 0.4,
      sheen: 0.18,
      sheenColor: new Color('#fff2cc'),
      envMapIntensity: 0.9,
    },
    controls: [
      control('uGummySugar', 'Sugar dust', 0, 1, 0.4),
      control('uGummySat', 'Candy', 0.5, 2, 1.6),
      control('uGummyGlow', 'Inner glow', 0, 1.5, 0.45),
    ],
    glsl: /* glsl */ `
      vec2 off = jsToPlane(refract(-V, N, 1.0 / 1.42), uPiece.w) * uThickness * 1.2 / uPuzzle;
      vec3 img = texture2D(map, puv + off).rgb;
      // Deep, syrupy colour: a thick gummy is darker than the print it was
      // made from, and only lets go of its colour at the edges.
      vec3 c = jsSat(pow(clamp(img, 0.0, 1.0), vec3(1.15)), uGummySat) * 0.92;
      // sugar reads as scattered roughness far more than as white pixels
      float sugar = smoothstep(0.80, 0.99, jsNoise(wp * 300.0)) * uGummySugar;
      diffuseColor.rgb = c * (1.0 + 0.1 * sugar);
      gEmissive = c * (rim * 0.5 + 0.04) * uGummyGlow;
      gRough = mix(0.55, 0.32, top) + 0.5 * sugar;
      gMetal = 0.0;
      gBump = sugar * 0.06 + jsNoise(wp * 90.0) * 0.01;
    `,
  },

  metal: {
    label: 'Metal',
    hint: 'anodised and etched: the image survives as hue and relief',
    swatch: 'linear-gradient(140deg,#e8eaee,#6d7078 45%,#babfc7)',
    bump: 1,
    shadowIntensity: 1,
    material: {
      roughness: 0.25,
      metalness: 1,
      anisotropy: 0.8,
      anisotropyRotation: Math.PI / 2,
      clearcoat: 0,
      envMapIntensity: 0.95,
    },
    controls: [
      control('uMetalBrush', 'Brushing', 0, 1.5, 0.7),
      control('uMetalEtch', 'Etch depth', 0, 1.5, 0.65),
      control('uMetalSat', 'Anodising', 0, 1.5, 0.75),
    ],
    glsl: /* glsl */ `
      vec3 img = texture2D(map, puv).rgb;
      float lum = jsLum(img);
      // the acid bites broad shapes, not pixels: read the relief from a
      // blurred copy of the painting so the etch doesn't turn into sparkle
      float lumSoft = jsLum(texture2D(map, puv, 3.5).rgb);
      float brush = jsNoise(wp * vec2(5.0, 620.0)) * 0.65 + jsNoise(wp * vec2(2.0, 210.0)) * 0.35;
      // Anodising keeps the painting's hue and value but not its paint: the
      // picture survives as tint plus polish, so the darks read as bitten,
      // frosted metal and the lights as mirror.
      vec3 hue = img / max(lum, 0.06);
      vec3 tint = mix(vec3(1.0), hue, clamp(uMetalSat * 0.6, 0.0, 1.0));
      vec3 face = tint * mix(0.14, 0.58, pow(lum, 0.75));
      diffuseColor.rgb = mix(vec3(0.33, 0.34, 0.37), face, top);
      gMetal = 1.0;
      gRough = clamp(mix(0.5, 0.56 - 0.46 * pow(lum, 0.8) + 0.3 * brush * uMetalBrush, top), 0.045, 0.95);
      // the darks are bitten deeper by the acid, so the image is also relief
      gBump = mix(0.0, (1.0 - lumSoft) * 0.085 * uMetalEtch, top) + brush * 0.01;
    `,
  },

  glass: {
    label: 'Glass',
    hint: 'real refraction, dispersion, image as stained-glass tint',
    swatch: 'linear-gradient(140deg,#dff3ff,#9fc6d8 50%,#eaf7ff)',
    bump: 1,
    shadowIntensity: 0.22,
    material: {
      roughness: 0.03,
      metalness: 0,
      transmission: 0.72, // leave some diffuse behind or the painting vanishes
      thickness: 0.9,
      ior: 1.52,
      dispersion: 2.5,
      specularIntensity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.6,
    },
    controls: [
      control('uGlassTint', 'Tint', 0, 1, 0.85),
      control('uGlassFrost', 'Frost', 0, 1, 0),
      control('uGlassDepth', 'Image depth', 0, 4, 2.2),
    ],
    glsl: /* glsl */ `
      vec2 off = jsToPlane(refract(-V, N, 1.0 / 1.52), uPiece.w) * uThickness * uGlassDepth / uPuzzle;
      // split the channels so the suspended image disperses too
      vec3 img;
      img.r = texture2D(map, puv + off * 1.08).r;
      img.g = texture2D(map, puv + off).g;
      img.b = texture2D(map, puv + off * 0.92).b;
      vec3 tint = mix(vec3(1.0), jsSat(clamp(img * 1.2, 0.0, 1.4), 1.25), uGlassTint);
      // in transmission, diffuseColor tints whatever comes through the slab
      diffuseColor.rgb = tint * mix(0.92, 1.15, top);
      // the suspended picture catches its own light, the way colour in glass does
      gEmissive = tint * (rim * 0.35 + 0.16);
      float frost = jsFbm(wp * 160.0);
      gRough = 0.03 + uGlassFrost * (0.25 + 0.3 * frost);
      gMetal = 0.0;
      gBump = uGlassFrost * frost * 0.03;
    `,
  },
}

export const PRESET_KEYS = Object.keys(PRESETS)

/** Flat map of every control's default, used to seed the uniform set. */
export const DEFAULT_PARAMS = Object.fromEntries(
  PRESET_KEYS.flatMap((k) => PRESETS[k].controls.map((c) => [c.uniform, c.value])),
)
