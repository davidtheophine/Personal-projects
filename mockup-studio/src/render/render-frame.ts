import type { Project } from "@/state/project";
import { aspectDims } from "@/state/project";
import { drawBackground, type BgResources } from "./backgrounds";
import {
  DEVICE_BODY_ASPECT,
  deviceGeometry,
  drawBareVideo,
  drawDevice,
  drawDeviceShadow,
} from "./device-frame";
import { drawTaps } from "./taps";
import { sampleZoom, type ZoomSample } from "./zoom";
import { sampleRotate } from "./rotate";
import { FRAME_FRACTION, renderPhone3D } from "./device-3d";
import type { Rect } from "./geometry";

export interface RenderResources {
  bg: BgResources;
}

/** Fraction of the canvas left as breathing room around the device. */
const PADDING = 0.09;

/**
 * Where the device body (or bare video) sits inside the canvas, given layout
 * scale + offset. `aspect` = width/height of the thing being laid out (the phone
 * body by default, or the video's aspect when the frame is off).
 */
export function computeDeviceRect(
  project: Project,
  W: number,
  H: number,
  aspect: number = DEVICE_BODY_ASPECT,
): Rect {
  const availW = W * (1 - PADDING * 2);
  const availH = H * (1 - PADDING * 2);
  let h = availH;
  let w = h * aspect;
  if (w > availW) {
    w = availW;
    h = w / aspect;
  }
  w *= project.layout.scale;
  h *= project.layout.scale;
  const x = (W - w) / 2 + project.layout.x * W;
  const y = (H - h) / 2 + project.layout.y * H;
  return { x, y, w, h };
}

/** The aspect (w/h) of the video, from the first clip; falls back to the phone body. */
export function videoAspectOf(project: Project): number {
  const c = project.clips[0];
  return c && c.width && c.height ? c.width / c.height : DEVICE_BODY_ASPECT;
}

/**
 * Resolved layout for the current frame mode: the display `rect` (phone body or
 * bare-video card) and the `screen` rect that taps/zoom map into (the inset
 * phone screen, or the whole video when frameless). Shared by the renderer and
 * the preview so placement stays in sync.
 */
export function displayLayout(
  project: Project,
  W: number,
  H: number,
): { frameless: boolean; rect: Rect; screen: Rect } {
  if (project.device.frame === "none") {
    const rect = computeDeviceRect(project, W, H, videoAspectOf(project));
    return { frameless: true, rect, screen: rect };
  }
  const rect = computeDeviceRect(project, W, H);
  return { frameless: false, rect, screen: deviceGeometry(rect).screen };
}

/** Zoom INTO a focal point on the display rect (background stays stationary). */
function applyZoomFocus(
  ctx: CanvasRenderingContext2D,
  zoom: ZoomSample,
  rect: Rect,
  cx: number,
  cy: number,
): void {
  if (zoom.scale > 1.0001 || zoom.x !== 0 || zoom.y !== 0) {
    const fx = rect.x + rect.w * (0.5 + zoom.x);
    const fy = rect.y + rect.h * (0.5 + zoom.y);
    ctx.translate(cx, cy);
    ctx.scale(zoom.scale, zoom.scale);
    ctx.translate(-fx, -fy);
  }
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
  ctx.imageSmoothingQuality = "high"; // sharper downscale of the 3D phone + bg image

  const { frameless, rect, screen } = displayLayout(project, W, H);
  const zoom = sampleZoom(project.zooms, t);
  const rot = sampleRotate(project.rotates, t);

  // Background stays completely stationary — the zoom only affects the phone/video.
  drawBackground(ctx, project.background, W, H, res.bg);

  // Zoom INTO a focal point on the phone/video (background untouched); zoom.x/y
  // is the focal point as a fraction from the centre, so e.g. "top" enlarges +
  // centres the top. cx/cy is the display centre.
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;

  // Frame off: draw the raw video directly on the canvas — no phone, no 3D. A
  // Rotate segment can still apply a 2D roll; 3D tilt needs a phone body, so
  // it's ignored here.
  if (frameless) {
    ctx.save();
    applyZoomFocus(ctx, zoom, rect, cx, cy);
    if (rot.z !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate((rot.z * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    drawBareVideo(ctx, rect, video, project.layout.shadow);
    drawTaps(ctx, project.taps, t, screen);
    ctx.restore();
    return;
  }

  // The phone is the flat 2D frame by default. Only when the active Rotate
  // segment has 3D enabled do we swap in the real 3D iPhone model (video + taps
  // are baked into its screen so they rotate with it). If the model isn't ready
  // yet — or WebGL is unavailable — renderPhone3D returns null and we keep 2D.
  const phone = rot.is3D
    ? renderPhone3D({
        video,
        taps: project.taps,
        t,
        color: project.device.color,
        rotateX: rot.x,
        rotateY: rot.y,
        roll: rot.z,
      })
    : null;
  ctx.save();
  applyZoomFocus(ctx, zoom, rect, cx, cy);
  if (phone) {
    // No 2D drop shadow here: it's an opaque black body-shaped fill meant to be
    // hidden behind the phone, and a tilted 3D phone would expose it as a black
    // "hole". The 3D phone carries its own soft contact shadow inside its render
    // (transparent → composites over the background, so it can never be a hole).
    const dest = rect.h / FRAME_FRACTION; // square render → phone ≈ rect.h tall, with tilt headroom
    ctx.drawImage(phone, cx - dest / 2, cy - dest / 2, dest, dest);
  } else {
    // Flat 2D phone. A Rotate segment can still apply a true in-plane roll here;
    // 3D tilt (rot.x/y) is a 3D-only effect and is ignored in 2D.
    if (rot.z !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate((rot.z * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    drawDeviceShadow(ctx, rect, project.layout.shadow);
    drawDevice(ctx, rect, project.device, video);
    drawTaps(ctx, project.taps, t, screen);
  }
  ctx.restore();
}
