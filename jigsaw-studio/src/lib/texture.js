import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Texture } from 'three'

const MAX_EDGE = 2048 // plenty for piece-sized detail, keeps VRAM sane

/**
 * Loads a URL, blob or File into a texture, downscaling anything huge so a
 * 6000px phone photo doesn't cost 140 MB of VRAM. Returns the aspect ratio
 * alongside, since the puzzle's shape follows the image's.
 */
export async function loadImageTexture(source) {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source)
  try {
    const bitmap = await createImageBitmap(await (await fetch(url)).blob())
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    const texture = new Texture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.magFilter = LinearFilter
    texture.minFilter = LinearMipmapLinearFilter
    texture.generateMipmaps = true
    texture.anisotropy = 8
    texture.needsUpdate = true
    return { texture, aspect: w / h }
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url)
  }
}
