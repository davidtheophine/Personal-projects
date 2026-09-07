import type { RotateEvent } from "@/state/project";
import { EASINGS } from "./easing";

export interface RotateSample {
  z: number; // 2D roll (degrees)
  x: number; // 3D tilt around the horizontal axis (degrees)
  y: number; // 3D tilt around the vertical axis (degrees)
}

/**
 * The effective rotation at time `t`: eases in to the target, holds, then eases
 * back out over each event's window. Returns roll (z) + 3D tilt (x, y).
 * Overlapping events resolve to the first active one.
 */
export function sampleRotate(rotates: RotateEvent[], t: number): RotateSample {
  for (const r of rotates) {
    if (t < r.start || t > r.start + r.duration) continue;
    const inDur = Math.min(0.5, r.duration * 0.35);
    const outDur = Math.min(0.5, r.duration * 0.35);
    const local = t - r.start;
    const easeFn = EASINGS[r.ease] ?? EASINGS.smooth;
    let p: number;
    if (local < inDur) {
      p = easeFn(local / inDur);
    } else if (local > r.duration - outDur) {
      p = easeFn(Math.max(0, (r.duration - local) / outDur));
    } else {
      p = 1;
    }
    return { z: r.angle * p, x: (r.rotateX ?? 0) * p, y: (r.rotateY ?? 0) * p };
  }
  return { z: 0, x: 0, y: 0 };
}
