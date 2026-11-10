import type { VideoClip } from "@/state/project";
import { activeAt, totalDuration } from "@/state/clips";

/** One output frame: the clip it shows and the source time to show from it. */
export interface PlannedFrame {
  clipIndex: number;
  localTime: number;
}

export interface FramePlan {
  /** Number of output frames: timeline length × fps. */
  count: number;
  /** Per output frame; null where the timeline has a gap between clips. */
  frames: (PlannedFrame | null)[];
  /** Each clip's source times in output order — exactly what its decoder is asked for. */
  timestampsByClip: Map<number, number[]>;
}

/**
 * Source times are nudged forward by 0.1 ms so float rounding on an exact
 * source-frame boundary (e.g. 3 + i/30 vs (180 + 2i)/60) can never select the
 * previous frame. That's far below any real frame duration (≥ 4 ms at 240 fps).
 */
const BOUNDARY_NUDGE = 1e-4;

/**
 * The fast exporter's script: output frame i sits at exactly t = i / fps and
 * shows `activeAt(clips, t)` — the same clip/time rule the live preview uses —
 * so the export is frame-exact (no dropped or repeated frames by construction).
 */
export function planFrames(clips: VideoClip[], fps: number): FramePlan {
  const total = totalDuration(clips);
  // −1e-6 so float error (0.1 + 0.2 → 0.30000000000000004 s) can't add a phantom frame.
  const count = total > 0 ? Math.max(0, Math.ceil(total * fps - 1e-6)) : 0;
  const frames: (PlannedFrame | null)[] = new Array(count);
  const timestampsByClip = new Map<number, number[]>();
  for (let i = 0; i < count; i++) {
    const hit = activeAt(clips, i / fps);
    if (!hit) {
      frames[i] = null;
      continue;
    }
    const localTime = hit.localTime + BOUNDARY_NUDGE;
    frames[i] = { clipIndex: hit.index, localTime };
    let list = timestampsByClip.get(hit.index);
    if (!list) {
      list = [];
      timestampsByClip.set(hit.index, list);
    }
    list.push(localTime);
  }
  return { count, frames, timestampsByClip };
}
