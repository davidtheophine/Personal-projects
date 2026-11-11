import type { VideoClip } from "@/state/project";
import { clipLen } from "@/state/clips";

const EPS = 1e-9;

/** Where on the output timeline a clip is the one being heard (half-open). */
export interface AudioSpan {
  clipIndex: number;
  start: number;
  end: number;
}

/**
 * Each clip's audible output intervals: its timeline span minus the spans of
 * any later clips (where clips overlap, the later one wins — the same rule the
 * video uses), so audio always matches the picture. Sorted by start time.
 * Exact clip boundaries, not frame-snapped, so cuts are sample-accurate.
 */
export function activeIntervals(clips: VideoClip[]): AudioSpan[] {
  const spans: AudioSpan[] = [];
  clips.forEach((c, i) => {
    let pieces: [number, number][] = [[c.start, c.start + clipLen(c)]];
    for (let j = i + 1; j < clips.length; j++) {
      const s = clips[j].start;
      const e = s + clipLen(clips[j]);
      if (e - s <= EPS) continue;
      pieces = pieces.flatMap(([a, b]): [number, number][] => {
        if (e <= a || s >= b) return [[a, b]];
        const keep: [number, number][] = [];
        if (s > a) keep.push([a, s]);
        if (e < b) keep.push([e, b]);
        return keep;
      });
    }
    for (const [a, b] of pieces) if (b - a > EPS) spans.push({ clipIndex: i, start: a, end: b });
  });
  return spans.sort((x, y) => x.start - y.start);
}

/** One piece of a clip's audio to place on the output timeline. */
export interface AudioPiece {
  clipIndex: number;
  /** Output time the piece starts at. */
  when: number;
  /** Source time to read from. */
  srcOffset: number;
  /** Source seconds to read (= outDuration × speed). */
  srcDuration: number;
  /** Output seconds the piece fills. */
  outDuration: number;
  speed: number;
}

export function audioSchedule(clips: VideoClip[]): AudioPiece[] {
  return activeIntervals(clips).map(({ clipIndex, start, end }) => {
    const c = clips[clipIndex];
    const speed = c.speed || 1;
    const outDuration = end - start;
    return {
      clipIndex,
      when: start,
      srcOffset: c.in + (start - c.start) * speed,
      srcDuration: outDuration * speed,
      outDuration,
      speed,
    };
  });
}
