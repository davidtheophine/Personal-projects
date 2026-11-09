import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'

const canvasTexture = (size, paint) => {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  paint(canvas.getContext('2d'), size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  return texture
}

/** Vertical studio gradient, mapped onto the inside of the backdrop sphere. */
export const makeBackdropTexture = () =>
  canvasTexture(256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s)
    g.addColorStop(0, '#1b2030')
    g.addColorStop(0.45, '#121622')
    g.addColorStop(0.75, '#0a0c13')
    g.addColorStop(1, '#05060a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  })

/** Dark felt tabletop: flat colour, a soft pool of light, and a little tooth. */
export const makeTableTexture = () =>
  canvasTexture(1024, (ctx, s) => {
    ctx.fillStyle = '#090a0e'
    ctx.fillRect(0, 0, s, s)
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.62)
    g.addColorStop(0, 'rgba(110,124,156,0.14)')
    g.addColorStop(0.55, 'rgba(58,64,82,0.07)')
    g.addColorStop(1, 'rgba(0,0,0,0.45)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    ctx.globalAlpha = 0.028
    for (let i = 0; i < 14000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000'
      ctx.fillRect(Math.random() * s, Math.random() * s, 1.2, 1.2)
    }
  })
