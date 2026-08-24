import type { ZoomEvent } from "@/state/project";
import { EASINGS } from "./easing";

export interface ZoomSample {
  scale: number;
  x: number;
  y: number;
}

/**
 * The effective zoom at time `t`: eases the scale + pan offset in over the
 * event's ramp, holds, then eases back out. Overlapping events resolve to the
 * first active one.
 */
export function sampleZoom(zooms: ZoomEvent[], t: number): ZoomSample {
  for (const z of zooms) {
    if (t < z.start || t > z.start + z.duration) continue;
    const inDur = Math.min(0.5, z.duration * 0.35);
    const outDur = Math.min(0.5, z.duration * 0.35);
    const local = t - z.start;
    const easeFn = EASINGS[z.ease] ?? EASINGS.smooth;
    let p: number;
    if (local < inDur) {
      p = easeFn(local / inDur);
    } else if (local > z.duration - outDur) {
      p = easeFn(Math.max(0, (z.duration - local) / outDur));
    } else {
      p = 1;
    }
    return { scale: 1 + (z.scale - 1) * p, x: z.x * p, y: z.y * p };
  }
  return { scale: 1, x: 0, y: 0 };
}
