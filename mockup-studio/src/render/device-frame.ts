import type { DeviceState, ShadowState } from "@/state/project";
import { shade, withAlpha } from "@/lib/color";
import { fitRect, insetRect, roundedRectPath, type Rect } from "./geometry";

// Frame proportions, expressed as fractions of the device BODY width.
// Body is 1072 × 2242 in reference units.
const RAIL = 14 / 1072; // titanium rail (metal edge visible from the front)
const BEZEL = 22 / 1072; // black bezel between rail and screen
const BODY_RADIUS = 216 / 1072;
const BEZEL_RADIUS = 200 / 1072;
const SCREEN_RADIUS = 176 / 1072;

/** Body width / height — used to lay the device out inside the canvas. */
export const DEVICE_BODY_ASPECT = 1072 / 2242;

/** Screen width / height — for placing animation layers within the screen. */
export const SCREEN_ASPECT = 1000 / 2170;

export interface DeviceGeometry {
  body: Rect;
  screen: Rect;
  screenRadius: number;
  bodyRadius: number;
}

export function deviceGeometry(body: Rect): DeviceGeometry {
  const u = body.w;
  const screen = insetRect(body, (RAIL + BEZEL) * u);
  return {
    body,
    screen,
    screenRadius: SCREEN_RADIUS * u,
    bodyRadius: BODY_RADIUS * u,
  };
}

function titaniumGradient(
  ctx: CanvasRenderingContext2D,
  body: Rect,
  color: string,
): CanvasGradient {
  const g = ctx.createLinearGradient(
    body.x,
    body.y,
    body.x + body.w,
    body.y + body.h,
  );
  // Brushed-metal banding (light / dip / light / dip / dark) so the rail reads
  // as a reflective titanium edge instead of a flat, blown-out highlight.
  g.addColorStop(0.0, shade(color, 0.14));
  g.addColorStop(0.18, shade(color, -0.07));
  g.addColorStop(0.5, shade(color, 0.05));
  g.addColorStop(0.82, shade(color, -0.11));
  g.addColorStop(1.0, shade(color, -0.26));
  return g;
}

function drawButtons(
  ctx: CanvasRenderingContext2D,
  body: Rect,
  color: string,
): void {
  const u = body.w;
  const thickness = u * 0.011;
  const radius = thickness * 0.5;
  ctx.fillStyle = shade(color, -0.08);
  const seg = (side: "l" | "r", y0: number, y1: number) => {
    const y = body.y + body.h * y0;
    const h = body.h * (y1 - y0);
    const x = side === "l" ? body.x - thickness * 0.7 : body.x + body.w - thickness * 0.3;
    ctx.beginPath();
    ctx.roundRect(x, y, thickness, h, radius);
    ctx.fill();
  };
  seg("l", 0.145, 0.19); // action button
  seg("l", 0.25, 0.335); // volume up
  seg("l", 0.35, 0.435); // volume down
  seg("r", 0.23, 0.365); // side / power button
}

/** Draw the device's drop shadow (a soft silhouette behind the body). */
export function drawDeviceShadow(
  ctx: CanvasRenderingContext2D,
  body: Rect,
  shadow: ShadowState,
): void {
  if (shadow.opacity <= 0) return;
  const geo = deviceGeometry(body);
  ctx.save();
  ctx.shadowColor = withAlpha(shadow.color, shadow.opacity);
  ctx.shadowBlur = shadow.blur;
  ctx.shadowOffsetX = shadow.x;
  ctx.shadowOffsetY = shadow.y;
  roundedRectPath(ctx, body, geo.bodyRadius);
  ctx.fillStyle = "#000000";
  ctx.fill();
  ctx.restore();
}

/**
 * Draw the iPhone body + bezel, clip the screen and paint the current video
 * frame into it, then draw the side buttons. `video` may be null (shows a dark
 * placeholder screen).
 */
export function drawDevice(
  ctx: CanvasRenderingContext2D,
  body: Rect,
  device: DeviceState,
  video: HTMLVideoElement | null,
): void {
  const u = body.w;
  const geo = deviceGeometry(body);

  // Titanium body.
  roundedRectPath(ctx, geo.body, geo.bodyRadius);
  ctx.fillStyle = titaniumGradient(ctx, geo.body, device.color);
  ctx.fill();

  // Metallic edge sheen — brightest along the top edge, fading downward.
  ctx.save();
  roundedRectPath(ctx, geo.body, geo.bodyRadius);
  const edge = ctx.createLinearGradient(
    geo.body.x,
    geo.body.y,
    geo.body.x,
    geo.body.y + geo.body.h,
  );
  edge.addColorStop(0, withAlpha("#ffffff", 0.32));
  edge.addColorStop(0.5, withAlpha("#ffffff", 0.08));
  edge.addColorStop(1, withAlpha("#ffffff", 0.04));
  ctx.lineWidth = Math.max(1, u * 0.0038);
  ctx.strokeStyle = edge;
  ctx.stroke();
  ctx.restore();

  // Black bezel.
  const bezelRect = insetRect(geo.body, RAIL * u);
  roundedRectPath(ctx, bezelRect, BEZEL_RADIUS * u);
  ctx.fillStyle = "#050506";
  ctx.fill();

  // Screen: clip and paint the video (cover).
  ctx.save();
  roundedRectPath(ctx, geo.screen, geo.screenRadius);
  ctx.clip();
  if (video && video.readyState >= 2 && video.videoWidth > 0) {
    const dr = fitRect(video.videoWidth, video.videoHeight, geo.screen, "cover");
    ctx.drawImage(video, dr.x, dr.y, dr.w, dr.h);
  } else {
    ctx.fillStyle = "#111114";
    ctx.fillRect(geo.screen.x, geo.screen.y, geo.screen.w, geo.screen.h);
  }
  ctx.restore();

  drawButtons(ctx, geo.body, device.color);
}
