import { useEffect } from 'react'
import { VERT, FRAG } from './shaders.js'
import { hexToRgb } from '../config.js'

function compile(gl, type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('shader compile error:\n' + gl.getShaderInfoLog(s))
    gl.deleteShader(s)
    return null
  }
  return s
}

/**
 * Owns the WebGL2 context + render loop for a genre-field canvas.
 * Eases a smoothed cursor toward `cursorTargetRef`, reads all feel-params from
 * `paramsRef` each frame (DialKit), and calls `onSmoothed(x,y)` to move the
 * reticle + update the label.
 */
export function useGenreShader({ canvasRef, cursorTargetRef, paramsRef, onSmoothed }) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false })
    if (!gl) {
      console.error('WebGL2 not available')
      return
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return
    const prog = gl.createProgram()
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('program link error:\n' + gl.getProgramInfoLog(prog))
      return
    }
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const u = (n) => gl.getUniformLocation(prog, n)
    const F = [
      'baseRadius', 'dominance', 'blobOpacity', 'flow', 'sat', 'bright',
      'cursorSize', 'cursorShadow', 'halo', 'haloRadius', 'haloWidth', 'grain',
      'dotScale', 'dotOpacity', 'vignette', 'dotGlowRadius', 'dotGlowBoost',
    ]
    const UF = Object.fromEntries(F.map((k) => [k, u('u_' + k)]))
    const U = {
      res: u('u_resolution'), time: u('u_time'), cursor: u('u_cursor'),
      baseColor: u('u_baseColor'),
      colTL: u('u_colTL'), colTR: u('u_colTR'), colBL: u('u_colBL'), colBR: u('u_colBR'),
      effect: u('u_effect'), effectAmt: u('u_effectAmt'),
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    function resize() {
      const W = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const H = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W
        canvas.height = H
      }
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    let raf
    const start = performance.now()
    const sm = { x: cursorTargetRef.current.x, y: cursorTargetRef.current.y }
    function frame(now) {
      const tgt = cursorTargetRef.current
      sm.x += (tgt.x - sm.x) * 0.18
      sm.y += (tgt.y - sm.y) * 0.18
      const p = paramsRef.current

      gl.uniform2f(U.res, canvas.width, canvas.height)
      gl.uniform1f(U.time, (now - start) / 1000)
      gl.uniform2f(U.cursor, sm.x, sm.y)
      for (const k of F) gl.uniform1f(UF[k], p[k])
      gl.uniform1i(U.effect, p.effect | 0)
      gl.uniform1f(U.effectAmt, p.effectAmt)
      gl.uniform3fv(U.baseColor, hexToRgb(p.baseColor))
      gl.uniform3fv(U.colTL, hexToRgb(p.colTL))
      gl.uniform3fv(U.colTR, hexToRgb(p.colTR))
      gl.uniform3fv(U.colBL, hexToRgb(p.colBL))
      gl.uniform3fv(U.colBR, hexToRgb(p.colBR))

      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (onSmoothed) onSmoothed(sm.x, sm.y)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [canvasRef, cursorTargetRef, paramsRef, onSmoothed])
}
