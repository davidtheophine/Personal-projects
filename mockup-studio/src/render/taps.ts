import type { TapEvent } from "@/state/project";
import { TAP_DURATION } from "@/state/project";
import type { Rect } from "./geometry";

const easeOut = (p: number): number => 1 - Math.pow(1 - p, 3);

/** Draw every tap ripple that is active at time `t`, positioned within `screen`. */
export function drawTaps(
  ctx: CanvasRenderingContext2D,
  taps: TapEvent[],
  t: number,
  screen: Rect,
): void {
  for (const tap of taps) {
    const dur = tap.duration || TAP_DURATION;
    const p = (t - tap.time) / dur;
    if (p < 0 || p > 1) continue;
    const cx = screen.x + tap.x * screen.w;
    const cy = screen.y + tap.y * screen.h;
    const base = screen.w * 0.09 * (tap.size || 1);
    const alpha = 1 - p;

    ctx.save();
    // Soft filled dot at the touch point.
    ctx.beginPath();
    ctx.arc(cx, cy, base * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.35 * alpha})`;
    ctx.fill();
    // Expanding ring.
    ctx.beginPath();
    ctx.arc(cx, cy, base * (0.35 + 0.9 * easeOut(p)), 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2, screen.w * 0.006);
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * alpha})`;
    ctx.stroke();
    ctx.restore();
  }
}
