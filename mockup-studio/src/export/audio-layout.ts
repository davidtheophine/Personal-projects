/** One decoded block of a track's audio, with per-channel PCM. */
export interface DecodedChunk {
  /** Presentation time of the first sample (s). */
  timestamp: number;
  duration: number;
  sampleRate: number;
  data: Float32Array[];
}

export interface LaidOutPiece {
  /** Every source channel (the 2-channel mixer down/up-mixes with the standard speaker rules). */
  channels: Float32Array[];
  sampleRate: number;
  /**
   * Source seconds between the piece's start and the first decoded sample —
   * > 0 when the track's audio begins after the clip's in-point (e.g. a mic
   * that started late). Place the audio this much (÷ speed) after the piece.
   */
  lead: number;
}

/**
 * Lay the decoded chunks of one audio piece onto one contiguous strip (gaps in
 * the track stay silent) and cut exactly the piece's source range
 * [srcOffset, srcOffset + srcDuration) out of it.
 */
export function layoutPiece(
  chunks: DecodedChunk[],
  piece: { srcOffset: number; srcDuration: number },
): LaidOutPiece | null {
  if (chunks.length === 0) return null;
  const sr = chunks[0].sampleRate;
  const channelCount = Math.max(...chunks.map((c) => c.data.length));
  const first = chunks[0].timestamp;
  const last = chunks[chunks.length - 1];
  const span = Math.max(1, Math.round((last.timestamp + last.duration - first) * sr));
  const strip = Array.from({ length: channelCount }, () => new Float32Array(span));
  for (const ch of chunks) {
    const at = Math.round((ch.timestamp - first) * sr);
    if (at >= span) continue;
    for (let c = 0; c < channelCount; c++) {
      const src = ch.data[Math.min(c, ch.data.length - 1)];
      const from = Math.max(0, at);
      strip[c].set(src.subarray(from - at, Math.min(src.length, span - at)), from);
    }
  }
  const clampToSpan = (x: number) => Math.min(span, Math.max(0, Math.round(x)));
  const s0 = clampToSpan((piece.srcOffset - first) * sr);
  const s1 = clampToSpan((piece.srcOffset + piece.srcDuration - first) * sr);
  return {
    channels: strip.map((ch) => ch.slice(s0, Math.max(s0, s1))),
    sampleRate: sr,
    lead: Math.max(0, first - piece.srcOffset),
  };
}
