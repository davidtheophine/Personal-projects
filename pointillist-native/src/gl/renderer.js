import { SCREEN_TRIANGLE, SCREEN_VERT, CELL_FRAG, DOT_FRAG } from '../shader/pointillist'
import { cameraTransform } from '../lib/camera-transform'
import { MIN_DOT_PX } from '../lib/constants'

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`shader failed to compile: ${gl.getShaderInfoLog(shader)}`)
  }
  return shader
}

function link(gl, fragSource, uniformNames) {
  const program = gl.createProgram()
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, SCREEN_VERT))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragSource))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`program failed to link: ${gl.getProgramInfoLog(program)}`)
  }
  const u = {}
  for (const name of uniformNames) u[name] = gl.getUniformLocation(program, name)
  return { program, u, aPos: gl.getAttribLocation(program, 'aPos') }
}

const hexToRgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/**
 * Owns every GL object for the effect. Call `render(state)` once per frame and
 * `dispose()` when the view goes away.
 *
 * The surface size must be pushed in via `setSize` from React Native layout.
 * `gl.drawingBufferWidth`/`Height` look like the obvious source but are a trap:
 * expo-gl sets them once, at context creation, from `glGetIntegerv(GL_VIEWPORT)`,
 * and never updates them. If `onContextCreate` fires before the view is laid out
 * they read 0 permanently — no amount of re-reading recovers — which yields a
 * zero-sized grid texture, a black screen, and a `takeSnapshotAsync` that
 * rejects with `E_GL_INVALID_VIEWPORT`.
 */
export function createRenderer(gl) {
  const cellPass = link(gl, CELL_FRAG, [
    'uCamera', 'uGrid', 'uCamXform', 'uCamCenter', 'uStagger', 'uSaturation', 'uLevels',
  ])
  const dotPass = link(gl, DOT_FRAG, [
    'uCells', 'uResolution', 'uGrid', 'uGridMax', 'uFill', 'uStagger', 'uJitter',
    'uLumaSize', 'uPaper', 'uPaperTint',
  ])

  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, SCREEN_TRIANGLE, gl.STATIC_DRAW)

  const cellTexture = gl.createTexture()
  const cellTarget = gl.createFramebuffer()

  let width = 0
  let height = 0
  let gridMax = [0, 0]

  const ready = () => width > 0 && height > 0

  /**
   * Set the drawing buffer size, in device pixels. Safe to call every layout —
   * it only reallocates when the size actually changes.
   * @returns true once the grid is allocated and rendering can proceed.
   */
  function setSize(w, h) {
    w = Math.floor(w) || 0
    h = Math.floor(h) || 0
    if (w <= 0 || h <= 0) return ready()
    if (w === width && h === height) return true

    width = w
    height = h
    // Sized for the smallest dot, then used as a sub-rect, so dragging the size
    // slider never reallocates.
    gridMax = [Math.ceil(w / MIN_DOT_PX), Math.ceil(h / MIN_DOT_PX)]

    gl.bindTexture(gl.TEXTURE_2D, cellTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gridMax[0], gridMax[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // NEAREST: every pixel of a dab must take exactly one grid cell's colour.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    gl.bindFramebuffer(gl.FRAMEBUFFER, cellTarget)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, cellTexture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return true
  }

  function bindQuad(pass) {
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.enableVertexAttribArray(pass.aPos)
    gl.vertexAttribPointer(pass.aPos, 2, gl.FLOAT, false, 0, 0)
  }

  function render(state) {
    if (!ready()) return null
    const {
      cameraTexture, dotSize, saturation, levels, fill, stagger, jitter,
      lumaSize, paper, paperTint, orientation, mirror, texAspect,
    } = state
    if (!cameraTexture) return null

    // Clamped so the grid can never outgrow the texture allocated above.
    const cell = Math.max(MIN_DOT_PX, dotSize)
    const cols = Math.min(gridMax[0], Math.max(1, Math.round(width / cell)))
    const rows = Math.min(gridMax[1], Math.max(1, Math.round(height / cell)))
    const { xform, centre } = cameraTransform({
      ...orientation,
      mirror,
      viewAspect: width / height,
      texAspect,
    })

    // Pass 1 — one fragment per dot, into the lower-left sub-rect of the grid.
    gl.bindFramebuffer(gl.FRAMEBUFFER, cellTarget)
    gl.viewport(0, 0, cols, rows)
    gl.useProgram(cellPass.program)
    bindQuad(cellPass)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, cameraTexture)
    gl.uniform1i(cellPass.u.uCamera, 0)
    gl.uniform2f(cellPass.u.uGrid, cols, rows)
    gl.uniformMatrix2fv(cellPass.u.uCamXform, false, xform)
    gl.uniform2fv(cellPass.u.uCamCenter, centre)
    gl.uniform1f(cellPass.u.uStagger, stagger)
    gl.uniform1f(cellPass.u.uSaturation, saturation)
    gl.uniform1f(cellPass.u.uLevels, levels)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // Pass 2 — paint the dabs onto the paper.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, width, height)
    gl.useProgram(dotPass.program)
    bindQuad(dotPass)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, cellTexture)
    gl.uniform1i(dotPass.u.uCells, 0)
    gl.uniform2f(dotPass.u.uResolution, width, height)
    gl.uniform2f(dotPass.u.uGrid, cols, rows)
    gl.uniform2f(dotPass.u.uGridMax, gridMax[0], gridMax[1])
    gl.uniform1f(dotPass.u.uFill, fill)
    gl.uniform1f(dotPass.u.uStagger, stagger)
    gl.uniform1f(dotPass.u.uJitter, jitter)
    gl.uniform1f(dotPass.u.uLumaSize, lumaSize)
    gl.uniform3fv(dotPass.u.uPaper, hexToRgb(paper))
    gl.uniform1f(dotPass.u.uPaperTint, paperTint)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    return { cols, rows }
  }

  /**
   * Used when there is no camera texture yet. Presenting a flat sheet of paper
   * rather than nothing keeps the GL surface opaque, so a missing camera reads
   * as blank paper instead of silently showing whatever sits behind the view.
   */
  function clear(paper) {
    if (!ready()) return false
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, width, height)
    const [r, g, b] = hexToRgb(paper)
    gl.clearColor(r, g, b, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    return true
  }

  /** Drawing buffer size, or zeroes until the view has been laid out. */
  const size = () => ({ width, height })

  function dispose() {
    gl.deleteFramebuffer(cellTarget)
    gl.deleteTexture(cellTexture)
    gl.deleteBuffer(quad)
    gl.deleteProgram(cellPass.program)
    gl.deleteProgram(dotPass.program)
  }

  // Seed from the context's own idea of its size; `setSize` corrects it as soon
  // as React Native reports a layout.
  setSize(gl.drawingBufferWidth, gl.drawingBufferHeight)

  return { render, clear, setSize, size, dispose }
}
