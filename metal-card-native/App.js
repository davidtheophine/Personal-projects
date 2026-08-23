import { useEffect } from 'react'
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import {
  Canvas,
  Group,
  RoundedRect,
  Shader,
  Skia,
  Text,
  matchFont,
  vec,
} from '@shopify/react-native-skia'
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { DeviceMotion } from 'expo-sensors'
import { StatusBar } from 'expo-status-bar'

// SkSL: fine sandblasted gunmetal with a broad specular sheen that sweeps as
// the phone tilts, plus a subtle holographic tint riding the highlight. The
// back face (u_face=1) gets a top strip and a stronger hologram.
const SKSL = `
uniform float2 u_origin;
uniform float2 u_res;
uniform float2 u_tilt;   // -1..1
uniform float  u_time;
uniform float  u_face;   // 0 front, 1 back

float hash(float2 p){
  p = fract(p * float2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
float vnoise(float2 p){
  float2 i = floor(p);
  float2 f = fract(p);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float3 hue(float h){
  float3 p = abs(fract(float3(h) + float3(0.0, 0.66667, 0.33333)) * 6.0 - 3.0);
  return clamp(p - 1.0, 0.0, 1.0);
}
half4 main(float2 fragcoord){
  float2 local = fragcoord - u_origin;
  float2 uv = local / u_res;
  float2 p = uv - 0.5;

  // fine sandblast grain
  float grain = vnoise(local * 1.5) - 0.5;
  float3 col = float3(0.085, 0.09, 0.10) + grain * 0.05;
  col += (0.5 - uv.y) * 0.025;

  // broad specular sheen that sweeps with tilt
  float2 L = normalize(float2(0.35, 0.9) + u_tilt * 1.3);
  float d = dot(p, L);
  float centre = -u_tilt.y * 0.35 + u_tilt.x * 0.12;
  float band = smoothstep(0.55, 0.0, abs(d - centre));
  float spec = pow(band, 2.5) * 0.40;
  col += spec;

  // holographic tint on the highlight (stronger on the back)
  float3 rain = hue(d * 1.6 + u_tilt.x * 0.7 + u_time * 0.04);
  col += rain * spec * (0.3 + 0.5 * u_face);

  // back face: darker glossy top strip
  if (u_face > 0.5) {
    float strip = smoothstep(0.27, 0.25, uv.y);
    col = mix(col, float3(0.03, 0.03, 0.035) + spec * 0.6, strip);
  }

  // soft edge falloff
  float r = length(p * float2(1.0, u_res.y / u_res.x));
  col *= 1.0 - smoothstep(0.5, 0.82, r) * 0.2;

  return half4(col.r, col.g, col.b, 1.0);
}
`

const effect = Skia.RuntimeEffect.Make(SKSL)

export default function App() {
  const { width, height } = useWindowDimensions()
  const cw = Math.min(width * 0.9, 440)
  const ch = cw / 1.586
  const cx = (width - cw) / 2
  const cy = (height - ch) / 2
  const r = ch * 0.09

  const tiltX = useSharedValue(0)
  const tiltY = useSharedValue(0)
  const time = useSharedValue(0)
  const progress = useSharedValue(0) // 0 front, 1 back

  // continuous clock (also keeps the canvas re-rendering each frame)
  useFrameCallback((info) => {
    'worklet'
    time.value = info.timeSinceFirstFrame / 1000
  })

  // gyroscope -> tilt uniforms
  useEffect(() => {
    let sub
    ;(async () => {
      try {
        await DeviceMotion.requestPermissionsAsync()
      } catch {}
      DeviceMotion.setUpdateInterval(16)
      sub = DeviceMotion.addListener((data) => {
        const rot = data.rotation
        if (!rot) return
        const gx = Math.max(-1, Math.min(1, (rot.gamma || 0) / 0.7))
        const gy = Math.max(-1, Math.min(1, ((rot.beta || 0) - 0.4) / 0.7))
        tiltX.value = withTiming(gx, { duration: 120 })
        tiltY.value = withTiming(gy, { duration: 120 })
      })
    })()
    return () => sub && sub.remove()
  }, [])

  const uniforms = useDerivedValue(() => ({
    u_origin: [cx, cy],
    u_res: [cw, ch],
    u_tilt: [tiltX.value, tiltY.value],
    u_time: time.value,
    u_face: progress.value > 0.5 ? 1 : 0,
  }))

  // flip: scaleX 1 -> -1 about the card centre
  const flipTransform = useDerivedValue(() => [
    { scaleX: Math.cos(progress.value * Math.PI) },
  ])

  const wFont = matchFont({
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    fontSize: ch * 0.3,
    fontWeight: '700',
  })
  const visaFont = matchFont({
    fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
    fontSize: ch * 0.13,
    fontStyle: 'italic',
    fontWeight: '900',
  })

  const flip = () => {
    progress.value = withTiming(progress.value > 0.5 ? 0 : 1, { duration: 600 })
  }

  if (!effect) {
    return <View style={styles.bg} />
  }

  return (
    <Pressable style={styles.bg} onPress={flip}>
      <Canvas style={{ flex: 1 }}>
        <Group origin={vec(cx + cw / 2, cy + ch / 2)} transform={flipTransform}>
          <RoundedRect x={cx} y={cy} width={cw} height={ch} r={r}>
            <Shader source={effect} uniforms={uniforms} />
          </RoundedRect>
          {wFont && (
            <Text x={cx + cw * 0.68} y={cy + ch * 0.34} text="W" font={wFont} color="rgba(18,18,22,0.85)" />
          )}
          {visaFont && (
            <Text x={cx + cw * 0.6} y={cy + ch * 0.88} text="VISA" font={visaFont} color="rgba(18,18,22,0.8)" />
          )}
        </Group>
      </Canvas>
      <StatusBar style="light" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0a0a0c' },
})
