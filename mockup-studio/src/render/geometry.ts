export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

export const clamp01 = (v: number): number => clamp(v, 0, 1);

export function insetRect(r: Rect, d: number): Rect {
  return { x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d };
}

/** Trace a rounded-rectangle path into the current context. */
export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  radius: number,
): void {
  const rr = Math.max(0, Math.min(radius, Math.min(r.w, r.h) / 2));
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rr);
}

/**
 * Map a source of size sw×sh into a destination rect using cover (fill, crop)
 * or contain (fit, letterbox). Returns the draw rect (may extend past dest for
 * cover — caller should clip).
 */
export function fitRect(
  sw: number,
  sh: number,
  dest: Rect,
  mode: "cover" | "contain",
): Rect {
  if (sw <= 0 || sh <= 0) return { ...dest };
  const scale =
    mode === "cover"
      ? Math.max(dest.w / sw, dest.h / sh)
      : Math.min(dest.w / sw, dest.h / sh);
  const w = sw * scale;
  const h = sh * scale;
  return {
    x: dest.x + (dest.w - w) / 2,
    y: dest.y + (dest.h - h) / 2,
    w,
    h,
  };
}
