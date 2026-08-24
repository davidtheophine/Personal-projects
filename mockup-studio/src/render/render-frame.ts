import type { Project } from "@/state/project";
import { aspectDims } from "@/state/project";
import { drawBackground, type BgResources } from "./backgrounds";
import {
  DEVICE_BODY_ASPECT,
  deviceGeometry,
  drawDevice,
  drawDeviceShadow,
} from "./device-frame";
import { drawTaps } from "./taps";
import { sampleZoom } from "./zoom";
import { sampleRotate } from "./rotate";
import type { Rect } from "./geometry";

export interface RenderResources {
  bg: BgResources;
}

/** Fraction of the canvas left as breathing room around the device. */
const PADDING = 0.09;

/** Where the device body sits inside the canvas, given layout scale + offset. */
export function computeDeviceRect(project: Project, W: number, H: number): Rect {
  const availW = W * (1 - PADDING * 2);
  const availH = H * (1 - PADDING * 2);
  let h = availH;
  let w = h * DEVICE_BODY_ASPECT;
  if (w > availW) {
    w = availW;
    h = w / DEVICE_BODY_ASPECT;
  }
  w *= project.layout.scale;
  h *= project.layout.scale;
  const x = (W - w) / 2 + project.layout.x * W;
  const y = (H - h) / 2 + project.layout.y * H;
  return { x, y, w, h };
}

/**
 * The single source of truth for a rendered frame: background → (zoom camera)
 * → iPhone frame with the video clipped into the screen → tap overlays. Powers
 * the live preview, timeline thumbnails, and every exporter.
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  project: Project,
  video: HTMLVideoElement | null,
  t: number,
  res: RenderResources,
): void {
  const { width: W, height: H } = aspectDims(project.aspect);
  ctx.clearRect(0, 0, W, H);

  const rect = computeDeviceRect(project, W, H);
  const geo = deviceGeometry(rect);
  const zoom = sampleZoom(project.zooms, t);
  const rot = sampleRotate(project.rotates, t);

  const scaleAroundCentre = () => {
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom.scale, zoom.scale);
    ctx.translate(-W / 2, -H / 2);
  };

  // Background: the zoom SCALE punches in (around centre); its reposition
  // offset (zoom.x/y) is NOT applied here, so dragging never pans the backdrop.
  ctx.save();
  if (zoom.scale > 1.0001) scaleAroundCentre();
  drawBackground(ctx, project.background, W, H, res.bg);
  ctx.restore();

  // Phone group: the zoom reposition moves ONLY the phone. The offset is applied
  // outside the scale (screen space) so dragging tracks the cursor 1:1; then the
  // camera scale, then a phone-only rotation around its centre.
  ctx.save();
  if (zoom.x !== 0 || zoom.y !== 0) ctx.translate(zoom.x * W, zoom.y * H);
  if (zoom.scale > 1.0001) scaleAroundCentre();
  if (rot !== 0) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  drawDeviceShadow(ctx, rect, project.layout.shadow);
  drawDevice(ctx, rect, project.device, video);
  drawTaps(ctx, project.taps, t, geo.screen);
  ctx.restore();
}
