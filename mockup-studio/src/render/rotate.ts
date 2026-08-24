import type { RotateEvent } from "@/state/project";
import { EASINGS } from "./easing";

/**
 * The effective rotation in degrees at time `t`: eases in to the target angle,
 * holds, then eases back out over each event's window. Overlapping events
 * resolve to the first active one.
 */
export function sampleRotate(rotates: RotateEvent[], t: number): number {
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
    return r.angle * p;
  }
  return 0;
}
