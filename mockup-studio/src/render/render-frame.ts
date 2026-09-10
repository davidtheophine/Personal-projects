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

  // Background stays completely stationary — the zoom only affects the phone.
  drawBackground(ctx, project.background, W, H, res.bg);

  // Phone group: zoom INTO a focal point on the phone. The focal point (chosen
  // by zoom.x/y as a fraction from the phone's centre) is scaled up and lands at
  // the phone's centre position, so e.g. "top" enlarges + centres the top of the
  // phone. The background is untouched, so only the phone appears to zoom.
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.save();
  if (zoom.scale > 1.0001 || zoom.x !== 0 || zoom.y !== 0) {
    const fx = rect.x + rect.w * (0.5 + zoom.x);
    const fy = rect.y + rect.h * (0.5 + zoom.y);
    ctx.translate(cx, cy);
    ctx.scale(zoom.scale, zoom.scale);
    ctx.translate(-fx, -fy);
  }
  if (rot.z !== 0 || rot.x !== 0 || rot.y !== 0) {
    // 3D tilt is faked on the 2D canvas: foreshorten each axis by cos(angle) and
    // add a small shear so it reads as depth rather than a flat squash. Plus the
    // 2D roll (rot.z). All around the phone's centre.
    const P = 0.36;
    const rx = (rot.x * Math.PI) / 180;
    const ry = (rot.y * Math.PI) / 180;
    ctx.translate(cx, cy);
    if (rot.z !== 0) ctx.rotate((rot.z * Math.PI) / 180);
    ctx.transform(Math.cos(ry), Math.sin(ry) * P, Math.sin(rx) * P, Math.cos(rx), 0, 0);
    ctx.translate(-cx, -cy);
  }
  drawDeviceShadow(ctx, rect, project.layout.shadow);
  drawDevice(ctx, rect, project.device, video);
  drawTaps(ctx, project.taps, t, geo.screen);
  ctx.restore();
}
