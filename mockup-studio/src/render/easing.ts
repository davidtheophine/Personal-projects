import type { ZoomEase } from "@/state/project";
import { clamp01 } from "./geometry";

/** Shared easing curves, keyed by the animation-curve names used across the app. */
export const EASINGS: Record<ZoomEase, (p: number) => number> = {
  linear: (p) => p,
  // easeInOutCubic
  smooth: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  // easeOutQuart — quick, settled
  snappy: (p) => 1 - Math.pow(1 - p, 4),
  // easeOutBack — a little overshoot
  spring: (p) => {
    const c = 1.70158 * 1.1;
    return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
  },
};

export function ease(name: ZoomEase, p: number): number {
  return (EASINGS[name] ?? EASINGS.smooth)(clamp01(p));
}
