import type { VideoClip } from "@/state/project";
import { clamp } from "@/render/geometry";

/** Minimum kept length for a clip, in seconds. */
export const MIN_CLIP = 0.1;

/** Kept length of a clip (source out − in). */
export function clipLen(c: VideoClip): number {
  return Math.max(0, c.out - c.in);
}

/**
 * Output timeline extent: the furthest any clip reaches. Clips are positioned
 * absolutely via `start`, so this includes any black gaps between them.
 */
export function totalDuration(clips: VideoClip[]): number {
  let end = 0;
  for (const c of clips) end = Math.max(end, c.start + clipLen(c));
  return end;
}

/** Output-time position where clip `index` begins (its absolute `start`). */
export function clipStart(clips: VideoClip[], index: number): number {
  return clips[index]?.start ?? 0;
}

export interface ActiveClip {
  clip: VideoClip;
  index: number;
  /** Source time to seek the clip element to. */
  localTime: number;
}

/**
 * The clip playing at output time `t`, plus the source time to show. Returns
 * null when `t` falls in a gap between clips (a black screen). On overlap the
 * last clip in array order wins.
 */
export function activeAt(clips: VideoClip[], t: number): ActiveClip | null {
  let found: ActiveClip | null = null;
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const len = clipLen(c);
    if (t >= c.start && t < c.start + len) {
      found = { clip: c, index: i, localTime: c.in + clamp(t - c.start, 0, len) };
    }
  }
  return found;
}
