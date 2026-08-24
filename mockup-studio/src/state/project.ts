export type AspectId = "9:16" | "4:3" | "1:1" | "16:9";

export const ASPECTS: Record<
  AspectId,
  { width: number; height: number; label: string }
> = {
  "9:16": { width: 1080, height: 1920, label: "9:16" },
  "4:3": { width: 1440, height: 1080, label: "4:3" },
  "1:1": { width: 1080, height: 1080, label: "1:1" },
  "16:9": { width: 1920, height: 1080, label: "16:9" },
};

export function aspectDims(a: AspectId): { width: number; height: number } {
  return ASPECTS[a];
}

export interface VideoMeta {
  url: string;
  width: number;
  height: number;
  duration: number;
  hasAudio: boolean;
  name: string;
}

/**
 * One video on the timeline. Clips play back-to-back in order. `in`/`out` are
 * source-time trim points — the kept region is [in, out]; anything outside is
 * removed from the output (the clip shrinks on the track, no dimming).
 */
export interface VideoClip {
  id: string;
  url: string;
  name: string;
  width: number;
  height: number;
  duration: number; // full source duration
  hasAudio: boolean;
  in: number; // source-time trim in
  out: number; // source-time trim out
  start: number; // absolute position on the output timeline (seconds)
}

export type BackgroundType = "mesh" | "gradient" | "solid" | "image" | "none";

export interface GradientStop {
  color: string;
  /** position along the gradient, 0..1 */
  at: number;
}

export interface ImageBackground {
  src: string | null;
  name: string | null;
  fit: "cover" | "contain";
  exposure: number; // brightness multiplier, 1 = normal
  blur: number; // px at canvas scale
  contrast: number; // 1 = normal
  saturation: number; // 1 = normal
  vignette: number; // 0..1
  tint: string; // overlay hex
  tintAmount: number; // 0..1
  scale: number; // 1 = fit
  rotation: number; // degrees
  offsetX: number; // fraction of canvas width
  offsetY: number;
}

export interface BackgroundState {
  type: BackgroundType;
  color: string; // solid
  gradient: { stops: GradientStop[]; angle: number };
  meshPreset: string;
  image: ImageBackground;
}

export interface ShadowState {
  color: string;
  blur: number;
  x: number;
  y: number;
  opacity: number; // 0..1
}

export interface DeviceState {
  /** titanium body colour */
  color: string;
}

export interface LayoutState {
  scale: number; // device scale relative to fit (1 = default)
  x: number; // offset fraction of canvas width
  y: number; // offset fraction of canvas height
  shadow: ShadowState;
}

export type ZoomEase = "spring" | "smooth" | "snappy" | "linear";

export const ZOOM_EASE_OPTIONS: { value: ZoomEase; label: string }[] = [
  { value: "spring", label: "Spring" },
  { value: "smooth", label: "Smooth" },
  { value: "snappy", label: "Snappy" },
  { value: "linear", label: "Linear" },
];

export function isZoomEase(v: string): v is ZoomEase {
  return v === "spring" || v === "smooth" || v === "snappy" || v === "linear";
}

export type ZoomAnchorX = "left" | "center" | "right";
export type ZoomAnchorY = "top" | "center" | "bottom";

/** Phone-offset presets (canvas fractions): +x moves the phone right, +y down. */
export const ZOOM_ANCHOR_X: Record<ZoomAnchorX, number> = {
  left: -0.16,
  center: 0,
  right: 0.16,
};
export const ZOOM_ANCHOR_Y: Record<ZoomAnchorY, number> = {
  top: -0.16,
  center: 0,
  bottom: 0.16,
};

export interface ZoomEvent {
  id: string;
  start: number; // seconds
  duration: number; // seconds
  scale: number; // target magnification, e.g. 1.6
  x: number; // phone offset during the zoom, canvas fraction (-0.5..0.5)
  y: number;
  ease: ZoomEase;
}

export interface TapEvent {
  id: string;
  time: number; // seconds
  x: number; // 0..1 within the device screen
  y: number;
  duration: number; // seconds the ripple animates
  size: number; // ripple size multiplier, 1 = default
}

/** Default tap-ripple length, in seconds. */
export const TAP_DURATION = 0.6;

export const DEFAULT_TAP = {
  duration: TAP_DURATION,
  size: 1,
};

export const DEFAULT_ZOOM = {
  duration: 2,
  scale: 1.6,
  ease: "smooth" as ZoomEase,
};

export interface RotateEvent {
  id: string;
  start: number; // seconds
  duration: number; // seconds
  angle: number; // degrees the phone rotates to
  ease: ZoomEase;
}

export const DEFAULT_ROTATE = {
  duration: 1.5,
  angle: 8,
  ease: "spring" as ZoomEase,
};

export interface Project {
  aspect: AspectId;
  clips: VideoClip[];
  background: BackgroundState;
  device: DeviceState;
  layout: LayoutState;
  zooms: ZoomEvent[];
  rotates: RotateEvent[];
  taps: TapEvent[];
}

export const TITANIUM_COLORS: { id: string; label: string; hex: string }[] = [
  { id: "natural", label: "Natural", hex: "#b7b3a8" },
  { id: "blue", label: "Deep Blue", hex: "#38465a" },
  { id: "black", label: "Black", hex: "#313135" },
  { id: "silver", label: "Silver", hex: "#bdbec3" },
  { id: "desert", label: "Desert", hex: "#a9663f" },
];

export function defaultProject(): Project {
  return {
    aspect: "4:3",
    clips: [],
    background: {
      type: "gradient",
      color: "#0b0b0f",
      gradient: {
        stops: [
          { color: "#d7d7db", at: 0 },
          { color: "#a6a6ad", at: 1 },
        ],
        angle: 145,
      },
      meshPreset: "indigo",
      image: {
        src: null,
        name: null,
        fit: "cover",
        exposure: 1,
        blur: 0,
        contrast: 1,
        saturation: 1,
        vignette: 0,
        tint: "#000000",
        tintAmount: 0,
        scale: 1,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
      },
    },
    device: { color: "#b7b3a8" },
    layout: {
      scale: 1,
      x: 0,
      y: 0,
      shadow: { color: "#000000", blur: 70, x: 0, y: 34, opacity: 0.45 },
    },
    zooms: [],
    rotates: [],
    taps: [],
  };
}
