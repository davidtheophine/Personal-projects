/** Analysis/synthesis window (s). 40 ms suits speech and UI sounds. */
const FRAME_SECONDS = 0.04;
/** How far (±s) each window may slide to line up with the previous one. */
const SEARCH_SECONDS = 0.012;

/**
 * Change the duration of audio by `rate` (2 = twice as fast / half as long)
 * WITHOUT changing its pitch — what `<video>.playbackRate` does in the real-time
 * exporter (preservesPitch), so sped-up or slowed clips sound the same in both.
 *
 * WSOLA: Hann windows overlap-added at a fixed 50% output hop, each read from
 * the input near `position × rate`, nudged within ±SEARCH_SECONDS to the offset
 * that best continues the previous window's waveform (cross-correlation), so
 * the overlaps add in phase instead of cancelling.
 */
export function timeStretch(channels: Float32Array[], rate: number, sampleRate: number): Float32Array[] {
  const n = channels[0]?.length ?? 0;
  if (n === 0 || Math.abs(rate - 1) < 1e-6) return channels.map((c) => c.slice());
  const outLen = Math.round(n / rate);
  const W = 2 * Math.round((sampleRate * FRAME_SECONDS) / 2); // even
  const hop = W / 2;
  const tol = Math.round(sampleRate * SEARCH_SECONDS);
  // Too short to analyse (a few tens of ms): a plain resample is inaudible there.
  if (n < W + 2 * tol + hop) return channels.map((c) => resampleLinear(c, outLen));

  // Periodic Hann: windows at a 50% hop sum to exactly 1.
  const win = new Float32Array(W);
  for (let i = 0; i < W; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / W);
  // Align on the mono mix so every channel gets the same cut points.
  const mono = new Float32Array(n);
  for (const c of channels) for (let i = 0; i < n; i++) mono[i] += c[i];

  const acc = channels.map(() => new Float32Array(outLen + W));
  const norm = new Float32Array(outLen + W);
  let prev = -1;
  for (let outPos = 0; outPos < outLen; outPos += hop) {
    const nominal = Math.min(n - W, Math.max(0, Math.round(outPos * rate)));
    let pos = nominal;
    if (prev >= 0) {
      const target = prev + hop; // where the previous window "naturally" continues
      if (target + hop <= n) {
        const lo = Math.max(0, nominal - tol);
        const hi = Math.min(n - W, nominal + tol);
        let best = -Infinity;
        for (let c = lo; c <= hi; c++) {
          let s = 0;
          for (let j = 0; j < hop; j += 4) s += mono[c + j] * mono[target + j];
          if (s > best) {
            best = s;
            pos = c;
          }
        }
      }
    }
    for (let ch = 0; ch < channels.length; ch++) {
      const src = channels[ch];
      const dst = acc[ch];
      for (let j = 0; j < W; j++) dst[outPos + j] += src[pos + j] * win[j];
    }
    for (let j = 0; j < W; j++) norm[outPos + j] += win[j];
    prev = pos;
  }
  return acc.map((dst) => {
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) out[i] = norm[i] > 1e-3 ? dst[i] / norm[i] : 0;
    return out;
  });
}

function resampleLinear(a: Float32Array, len: number): Float32Array {
  const out = new Float32Array(len);
  if (a.length === 0 || len === 0) return out;
  const step = len > 1 ? (a.length - 1) / (len - 1) : 0;
  for (let i = 0; i < len; i++) {
    const x = i * step;
    const k = Math.floor(x);
    const f = x - k;
    out[i] = a[k] * (1 - f) + a[Math.min(k + 1, a.length - 1)] * f;
  }
  return out;
}
