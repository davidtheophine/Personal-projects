import * as THREE from 'three'

// Cheap, fast integer hash -> [0,1). No trig, so we can afford ~1M samples.
function hash(x, y) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return (n >>> 0) / 4294967295
}

// Smooth value noise.
function vnoise(x, y) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi)
  const b = hash(xi + 1, yi)
  const c = hash(xi, yi + 1)
  const d = hash(xi + 1, yi + 1)
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v
}

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x)
const mix = (a, b, t) => a + (b - a) * t

// Per-face debossed features drawn on a 2D canvas. Returns a height delta
// (<= 0, engraved), a roughness delta, and a `logoMask` (0..1) marking where
// the printed logos are — the mask drives metalness (logos become a matte,
// opaque, NON-metallic dielectric, unlike the metal around them). `mirror`
// pre-flips X for the back, which the mesh rotates 180deg about Y.
function drawFeatures(face, w, h, mirror) {
  const height = new Float32Array(w * h)
  const roughAdd = new Float32Array(w * h)
  const logoMask = new Float32Array(w * h)
  if (face !== 'front' && face !== 'back') return { height, roughAdd, logoMask }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, w, h)
  if (mirror) {
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
  }

  // Front: high-contrast serif "W" top-right; "VISA" + superscript "*" +
  // "Infinite" bottom-right. Positions/sizes measured from the reference card.
  if (face === 'front') {
    ctx.fillStyle = '#ffffff'
    ctx.filter = 'blur(1px)' // tiny bevel on the engraved edge
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${Math.round(h * 0.31)}px Didot, "Bodoni 72", "Playfair Display", Georgia, serif`
    ctx.fillText('W', w * 0.9, h * 0.224) // right edge aligned with VISA
    // VISA: the classic bold-italic logotype (slanted, heavy) + superscript *
    ctx.textAlign = 'right'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `italic 900 ${Math.round(h * 0.135)}px "Helvetica Neue", Arial, sans-serif`
    ctx.fillText('VISA', w * 0.9, h * 0.82)
    ctx.textAlign = 'left'
    ctx.font = `italic 700 ${Math.round(h * 0.05)}px "Helvetica Neue", Arial, sans-serif`
    ctx.fillText('*', w * 0.907, h * 0.735)
    ctx.textAlign = 'right'
    ctx.font = `400 ${Math.round(h * 0.05)}px "Helvetica Neue", Arial, sans-serif`
    ctx.letterSpacing = '1px'
    ctx.fillText('Infinite', w * 0.9, h * 0.905)
    ctx.letterSpacing = '0px'
    ctx.filter = 'none'

    const a = ctx.getImageData(0, 0, w, h).data
    for (let i = 0; i < w * h; i++) {
      const al = a[i * 4 + 3] / 255
      logoMask[i] = al
      height[i] = -al // slight deboss
    }
  }

  return { height, roughAdd, logoMask }
}

// Build the brushed-metal maps for one card face: normalMap, roughnessMap, and
// (for logo faces) a metalnessMap. The "brush" is anisotropic value noise (low
// frequency across the streak axis, high along it) layered with fine isotropic
// "sandblast" grain; logos are composited as matte non-metallic areas.
export function makeCardMaps({
  face = 'body',
  w = 1024,
  h = 640,
  brushFreqX = 6,
  brushFreqY = 340,
  sandFreq = 520,
  sandOctaves = 3,
  brushStrength = 0.06,
  sandStrength = 0.9,
  embossDepth = 0.4,
  roughBase = 0.36,
  roughVar = 0.09,
  logoRough = 0.14, // glossy black: dark, with crisp highlights (reference look)
  normalStrength = 2.4,
} = {}) {
  const { height: feat, roughAdd, logoMask } = drawFeatures(
    face,
    w,
    h,
    face === 'back',
  )

  const height = new Float32Array(w * h)
  const sandNorm = 1 / (2 - Math.pow(0.5, sandOctaves - 1))
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i
      const uu = i / w
      const vv = j / h
      const brush = vnoise(uu * brushFreqX, vv * brushFreqY)
      let sand = 0
      let amp = 1
      let f = sandFreq
      for (let o = 0; o < sandOctaves; o++) {
        sand += vnoise(uu * f, vv * f) * amp
        amp *= 0.5
        f *= 2.13
      }
      sand *= sandNorm
      // Grain is suppressed under logos so they read smooth & matte.
      const grain = (brush * brushStrength + sand * sandStrength) * (1 - 0.85 * logoMask[idx])
      height[idx] = grain + feat[idx] * embossDepth
    }
  }

  const hasLogos = face === 'front'
  const nImg = new ImageData(w, h)
  const rImg = new ImageData(w, h)
  const mImg = hasLogos ? new ImageData(w, h) : null
  const cImg = hasLogos ? new ImageData(w, h) : null

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i
      const l = height[j * w + Math.max(i - 1, 0)]
      const r = height[j * w + Math.min(i + 1, w - 1)]
      const d = height[Math.max(j - 1, 0) * w + i]
      const u = height[Math.min(j + 1, h - 1) * w + i]

      let nx = -(r - l) * normalStrength
      let ny = -(u - d) * normalStrength
      let nz = 1
      const len = Math.hypot(nx, ny, nz) || 1
      const p = idx * 4
      nImg.data[p] = (nx / len * 0.5 + 0.5) * 255
      nImg.data[p + 1] = (ny / len * 0.5 + 0.5) * 255
      nImg.data[p + 2] = (nz / len * 0.5 + 0.5) * 255
      nImg.data[p + 3] = 255

      let rough = clamp(roughBase + (0.5 - height[idx]) * roughVar * 2 + roughAdd[idx], 0.04, 1)
      rough = mix(rough, logoRough, logoMask[idx]) // satin logos
      const rv = rough * 255
      rImg.data[p] = rv
      rImg.data[p + 1] = rv
      rImg.data[p + 2] = rv
      rImg.data[p + 3] = 255

      if (mImg) {
        // metalness: 1 for metal, 0 under the (dielectric) logos
        const mv = (1 - logoMask[idx]) * 255
        mImg.data[p] = mv
        mImg.data[p + 1] = mv
        mImg.data[p + 2] = mv
        mImg.data[p + 3] = 255
      }
      if (cImg) {
        // albedo: white for metal (tinted by material.color), near-black for
        // the logos so they read matte-opaque with only a faint dielectric sheen
        const cv = mix(255, 12, logoMask[idx])
        cImg.data[p] = cv
        cImg.data[p + 1] = cv
        cImg.data[p + 2] = cv
        cImg.data[p + 3] = 255
      }
    }
  }

  const normalMap = toTexture(nImg, THREE.NoColorSpace)
  const roughnessMap = toTexture(rImg, THREE.NoColorSpace)
  const metalnessMap = mImg ? toTexture(mImg, THREE.NoColorSpace) : null
  const colorMap = cImg ? toTexture(cImg, THREE.SRGBColorSpace) : null
  return { normalMap, roughnessMap, metalnessMap, colorMap }
}

function toTexture(imageData, colorSpace) {
  const c = document.createElement('canvas')
  c.width = imageData.width
  c.height = imageData.height
  c.getContext('2d').putImageData(imageData, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = colorSpace
  t.anisotropy = 8
  return t
}

// A baked "brushed studio" matcap: a metal sphere lit from upper-left with
// anisotropic horizontal streaks. Drives MeshMatcapMaterial as an A/B look and
// as the Expo/native fallback (needs no environment map or PMREM).
export function makeBrushedMatcap({ size = 512 } = {}) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#050609'
  ctx.fillRect(0, 0, size, size)
  ctx.save()
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  const g = ctx.createRadialGradient(size * 0.36, size * 0.3, size * 0.04, size * 0.5, size * 0.52, size * 0.62)
  g.addColorStop(0, '#d7deea')
  g.addColorStop(0.22, '#69707c')
  g.addColorStop(0.55, '#262a31')
  g.addColorStop(1, '#0a0b0e')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 900; i++) {
    const y = Math.random() * size
    ctx.strokeStyle = `rgba(210,220,235,${Math.random() * 0.05})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(size, y)
    ctx.stroke()
  }
  ctx.restore()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// A bright polished-chrome matcap for the holographic dove shader.
export function makeChromeMatcap({ size = 512 } = {}) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#0a0b0e'
  ctx.fillRect(0, 0, size, size)
  ctx.save()
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  const g = ctx.createRadialGradient(size * 0.38, size * 0.32, size * 0.02, size * 0.5, size * 0.5, size * 0.62)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.25, '#d2d8e2')
  g.addColorStop(0.55, '#8b95a2')
  g.addColorStop(0.8, '#3c424c')
  g.addColorStop(1, '#12151b')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = 'lighter'
  const g2 = ctx.createRadialGradient(size * 0.7, size * 0.76, size * 0.01, size * 0.7, size * 0.76, size * 0.36)
  g2.addColorStop(0, 'rgba(190,205,235,0.55)')
  g2.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, size, size)
  ctx.restore()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Realistic metallic EMV chip maps: a gold body with the contact-pad grooves
// as actual beveled relief (normal-mapped), darkened in the grooves, cut to the
// chip's rounded shape. Reads as embossed metal rather than a flat graphic.
export function makeChipMaps({ w = 512, h = 420 } = {}) {
  const rr = (ctx, x, y, ww, hh, rad) => {
    ctx.beginPath()
    ctx.moveTo(x + rad, y)
    ctx.arcTo(x + ww, y, x + ww, y + hh, rad)
    ctx.arcTo(x + ww, y + hh, x, y + hh, rad)
    ctx.arcTo(x, y + hh, x, y, rad)
    ctx.arcTo(x, y, x + ww, y, rad)
    ctx.closePath()
  }
  const drawPattern = (ctx) => {
    const fx = w * 0.14, fy = h * 0.15, fw = w * 0.72, fh = h * 0.7
    const y1 = h * 0.41, y2 = h * 0.59
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 12
    rr(ctx, fx, fy, fw, fh, 26)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(fx, y1); ctx.lineTo(fx + fw, y1)
    ctx.moveTo(fx, y2); ctx.lineTo(fx + fw, y2)
    ctx.moveTo(w * 0.5, fy); ctx.lineTo(w * 0.5, y1)
    ctx.moveTo(w * 0.5, y2); ctx.lineTo(w * 0.5, fy + fh)
    ctx.stroke()
  }

  // chip shape (alpha)
  const shapeC = document.createElement('canvas'); shapeC.width = w; shapeC.height = h
  const sc = shapeC.getContext('2d')
  sc.fillStyle = '#fff'; rr(sc, 6, 6, w - 12, h - 12, 46); sc.fill()
  const shapeA = sc.getImageData(0, 0, w, h).data

  // height field: body high, grooves low -> blurred for a bevel
  const hc = document.createElement('canvas'); hc.width = w; hc.height = h
  const hx = hc.getContext('2d')
  hx.fillStyle = '#000'; hx.fillRect(0, 0, w, h)
  hx.fillStyle = '#fff'; rr(hx, 18, 18, w - 36, h - 36, 40); hx.fill()
  hx.strokeStyle = '#000'; drawPattern(hx)
  const hb = document.createElement('canvas'); hb.width = w; hb.height = h
  const hbx = hb.getContext('2d'); hbx.filter = 'blur(2.2px)'; hbx.drawImage(hc, 0, 0)
  const H = hbx.getImageData(0, 0, w, h).data

  // gold color, darkened in grooves, alpha = shape
  const cC = document.createElement('canvas'); cC.width = w; cC.height = h
  const cx = cC.getContext('2d')
  const grad = cx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#ecd9a4'); grad.addColorStop(0.5, '#bd9f63'); grad.addColorStop(1, '#8c7038')
  cx.fillStyle = grad; cx.fillRect(0, 0, w, h)
  const cimg = cx.getImageData(0, 0, w, h)

  const nImg = new ImageData(w, h)
  const strength = 3.0
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i
      const hL = H[(j * w + Math.max(i - 1, 0)) * 4] / 255
      const hR = H[(j * w + Math.min(i + 1, w - 1)) * 4] / 255
      const hD = H[(Math.max(j - 1, 0) * w + i) * 4] / 255
      const hU = H[(Math.min(j + 1, h - 1) * w + i) * 4] / 255
      const hgt = H[idx * 4] / 255
      let nx = -(hR - hL) * strength
      let ny = -(hU - hD) * strength
      const len = Math.hypot(nx, ny, 1) || 1
      const p = idx * 4
      nImg.data[p] = (nx / len * 0.5 + 0.5) * 255
      nImg.data[p + 1] = (ny / len * 0.5 + 0.5) * 255
      nImg.data[p + 2] = (1 / len * 0.5 + 0.5) * 255
      nImg.data[p + 3] = 255
      const shade = 0.4 + 0.6 * hgt
      cimg.data[p] *= shade
      cimg.data[p + 1] *= shade
      cimg.data[p + 2] *= shade
      cimg.data[p + 3] = shapeA[p + 3]
    }
  }
  cx.putImageData(cimg, 0, 0)
  const nC = document.createElement('canvas'); nC.width = w; nC.height = h
  nC.getContext('2d').putImageData(nImg, 0, 0)

  const colorMap = new THREE.CanvasTexture(cC)
  colorMap.colorSpace = THREE.SRGBColorSpace
  colorMap.anisotropy = 8
  const normalMap = new THREE.CanvasTexture(nC)
  normalMap.colorSpace = THREE.NoColorSpace
  normalMap.anisotropy = 8
  return { colorMap, normalMap }
}

// Light laser-etched text for the card back (name / number / EXP / CVV) as a
// color map (transparent elsewhere) + a normal map, so the text reads as
// engraved metal with beveled edges that catch light as the card tilts.
export function makeEtchMaps({
  w = 1024,
  h = 640,
  name = 'DAVID THEOPHINE',
  number = '4024 0071 2345 8183',
  exp = '05/29',
  cvv = '917',
} = {}) {
  const ink = '#c4c9d1'
  const dim = '#8b909a'
  const L = w * 0.075
  const render = (g, colored) => {
    g.textAlign = 'left'
    g.textBaseline = 'alphabetic'
    g.fillStyle = colored ? ink : '#ffffff'
    g.font = `300 ${Math.round(h * 0.052)}px "Helvetica Neue", "Segoe UI", Arial, sans-serif`
    g.letterSpacing = '2px'
    g.fillText(name, L, h * 0.8)
    g.font = `300 ${Math.round(h * 0.046)}px "Helvetica Neue", "Segoe UI", Arial, sans-serif`
    g.letterSpacing = '3px'
    g.fillText(number, L, h * 0.88)
    g.letterSpacing = '1px'
    const col = (label, value, x) => {
      g.fillStyle = colored ? dim : '#cccccc'
      g.font = `400 ${Math.round(h * 0.034)}px "Helvetica Neue", "Segoe UI", Arial, sans-serif`
      g.fillText(label, x, h * 0.785)
      g.fillStyle = colored ? ink : '#ffffff'
      g.font = `300 ${Math.round(h * 0.046)}px "Helvetica Neue", "Segoe UI", Arial, sans-serif`
      g.fillText(value, x, h * 0.88)
    }
    col('EXP', exp, w * 0.64)
    col('CVV', cvv, w * 0.8)
    g.letterSpacing = '0px'
  }

  const cc = document.createElement('canvas'); cc.width = w; cc.height = h
  const cx = cc.getContext('2d'); cx.clearRect(0, 0, w, h)
  render(cx, true)
  const colorMap = new THREE.CanvasTexture(cc)
  colorMap.colorSpace = THREE.SRGBColorSpace
  colorMap.anisotropy = 8

  // height (white text on black), blurred -> debossed normal
  const hc = document.createElement('canvas'); hc.width = w; hc.height = h
  const hx = hc.getContext('2d'); hx.fillStyle = '#000'; hx.fillRect(0, 0, w, h)
  render(hx, false)
  const hb = document.createElement('canvas'); hb.width = w; hb.height = h
  const hbx = hb.getContext('2d'); hbx.filter = 'blur(1.6px)'; hbx.drawImage(hc, 0, 0)
  const Hd = hbx.getImageData(0, 0, w, h).data
  const nImg = new ImageData(w, h)
  const strength = 2.4
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i
      const hL = -Hd[(j * w + Math.max(i - 1, 0)) * 4] / 255
      const hR = -Hd[(j * w + Math.min(i + 1, w - 1)) * 4] / 255
      const hD = -Hd[(Math.max(j - 1, 0) * w + i) * 4] / 255
      const hU = -Hd[(Math.min(j + 1, h - 1) * w + i) * 4] / 255
      const nx = -(hR - hL) * strength
      const ny = -(hU - hD) * strength
      const len = Math.hypot(nx, ny, 1) || 1
      const p = idx * 4
      nImg.data[p] = (nx / len * 0.5 + 0.5) * 255
      nImg.data[p + 1] = (ny / len * 0.5 + 0.5) * 255
      nImg.data[p + 2] = (1 / len * 0.5 + 0.5) * 255
      nImg.data[p + 3] = 255
    }
  }
  const nc = document.createElement('canvas'); nc.width = w; nc.height = h
  nc.getContext('2d').putImageData(nImg, 0, 0)
  const normalMap = new THREE.CanvasTexture(nc)
  normalMap.colorSpace = THREE.NoColorSpace
  normalMap.anisotropy = 8

  return { colorMap, normalMap }
}
