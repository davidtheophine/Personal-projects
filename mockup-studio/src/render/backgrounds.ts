import type { BackgroundState } from "@/state/project";
import { withAlpha } from "@/lib/color";
import { clamp01, fitRect } from "./geometry";

export interface BgResources {
  image: HTMLImageElement | null;
}

interface MeshPreset {
  label: string;
  base: string;
  blobs: { x: number; y: number; r: number; color: string }[];
}

export const MESH_PRESETS: Record<string, MeshPreset> = {
  indigo: {
    label: "Indigo",
    base: "#0a0e1f",
    blobs: [
      { x: 0.18, y: 0.2, r: 0.85, color: "#4f46e5" },
      { x: 0.88, y: 0.14, r: 0.7, color: "#7c3aed" },
      { x: 0.72, y: 0.92, r: 0.95, color: "#2563eb" },
      { x: 0.08, y: 0.88, r: 0.6, color: "#06b6d4" },
    ],
  },
  sunset: {
    label: "Sunset",
    base: "#1b0a14",
    blobs: [
      { x: 0.15, y: 0.22, r: 0.8, color: "#fb923c" },
      { x: 0.9, y: 0.2, r: 0.72, color: "#ef4444" },
      { x: 0.62, y: 0.95, r: 0.95, color: "#db2777" },
      { x: 0.2, y: 0.9, r: 0.6, color: "#f59e0b" },
    ],
  },
  ocean: {
    label: "Ocean",
    base: "#04121a",
    blobs: [
      { x: 0.2, y: 0.18, r: 0.85, color: "#0ea5e9" },
      { x: 0.85, y: 0.25, r: 0.7, color: "#14b8a6" },
      { x: 0.7, y: 0.9, r: 0.9, color: "#2563eb" },
      { x: 0.12, y: 0.85, r: 0.6, color: "#22d3ee" },
    ],
  },
  emerald: {
    label: "Emerald",
    base: "#04140d",
    blobs: [
      { x: 0.2, y: 0.2, r: 0.85, color: "#10b981" },
      { x: 0.88, y: 0.18, r: 0.7, color: "#84cc16" },
      { x: 0.68, y: 0.92, r: 0.9, color: "#0d9488" },
      { x: 0.1, y: 0.9, r: 0.6, color: "#34d399" },
    ],
  },
  slate: {
    label: "Slate",
    base: "#0c0d10",
    blobs: [
      { x: 0.2, y: 0.2, r: 0.85, color: "#475569" },
      { x: 0.88, y: 0.16, r: 0.7, color: "#334155" },
      { x: 0.7, y: 0.92, r: 0.95, color: "#1e293b" },
      { x: 0.1, y: 0.88, r: 0.6, color: "#64748b" },
    ],
  },
  peach: {
    label: "Peach",
    base: "#1a0f10",
    blobs: [
      { x: 0.18, y: 0.2, r: 0.85, color: "#fda4af" },
      { x: 0.88, y: 0.2, r: 0.7, color: "#fdba74" },
      { x: 0.7, y: 0.92, r: 0.9, color: "#f472b6" },
      { x: 0.1, y: 0.88, r: 0.6, color: "#fcd34d" },
    ],
  },
};

export const MESH_PRESET_IDS = Object.keys(MESH_PRESETS);

function drawMesh(
  ctx: CanvasRenderingContext2D,
  presetId: string,
  W: number,
  H: number,
): void {
  const m = MESH_PRESETS[presetId] ?? MESH_PRESETS.indigo;
  ctx.fillStyle = m.base;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const maxDim = Math.max(W, H);
  for (const b of m.blobs) {
    const cx = b.x * W;
    const cy = b.y * H;
    const r = b.r * maxDim;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, withAlpha(b.color, 0.9));
    g.addColorStop(1, withAlpha(b.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawGradient(
  ctx: CanvasRenderingContext2D,
  bg: BackgroundState,
  W: number,
  H: number,
): void {
  const rad = (bg.gradient.angle * Math.PI) / 180;
  const cx = W / 2;
  const cy = H / 2;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const half = (Math.abs(dx) * W + Math.abs(dy) * H) / 2;
  const g = ctx.createLinearGradient(
    cx - dx * half,
    cy - dy * half,
    cx + dx * half,
    cy + dy * half,
  );
  const stops = [...bg.gradient.stops].sort((a, b) => a.at - b.at);
  for (const s of stops) g.addColorStop(clamp01(s.at), s.color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawImageBg(
  ctx: CanvasRenderingContext2D,
  bg: BackgroundState,
  W: number,
  H: number,
  img: HTMLImageElement | null,
): void {
  if (!img || img.naturalWidth === 0) {
    ctx.fillStyle = "#111114";
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const im = bg.image;
  // Fill behind so rotation / scale-down never reveals transparency.
  ctx.fillStyle = "#0b0b0f";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.filter = `brightness(${im.exposure}) contrast(${im.contrast}) saturate(${im.saturation}) blur(${im.blur}px)`;
  const rot = ((im.rotation ?? 0) * Math.PI) / 180;
  if (rot !== 0) {
    ctx.translate(W / 2, H / 2);
    ctx.rotate(rot);
    ctx.translate(-W / 2, -H / 2);
  }
  const base = fitRect(img.naturalWidth, img.naturalHeight, { x: 0, y: 0, w: W, h: H }, im.fit);
  const w = base.w * im.scale;
  const h = base.h * im.scale;
  const x = base.x - (w - base.w) / 2 + im.offsetX * W;
  const y = base.y - (h - base.h) / 2 + im.offsetY * H;
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();

  if (im.tintAmount > 0) {
    ctx.fillStyle = withAlpha(im.tint, im.tintAmount);
    ctx.fillRect(0, 0, W, H);
  }
  if (im.vignette > 0) {
    const g = ctx.createRadialGradient(
      W / 2,
      H / 2,
      Math.min(W, H) * 0.25,
      W / 2,
      H / 2,
      Math.max(W, H) * 0.75,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${clamp01(im.vignette)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawChecker(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
): void {
  const size = 48;
  ctx.fillStyle = "#2a2a2e";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#1f1f22";
  for (let y = 0; y < H; y += size) {
    for (let x = 0; x < W; x += size) {
      if (((x / size) & 1) === ((y / size) & 1)) ctx.fillRect(x, y, size, size);
    }
  }
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  bg: BackgroundState,
  W: number,
  H: number,
  res: BgResources,
): void {
  switch (bg.type) {
    case "solid":
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, W, H);
      break;
    case "gradient":
      drawGradient(ctx, bg, W, H);
      break;
    case "mesh":
      drawMesh(ctx, bg.meshPreset, W, H);
      break;
    case "image":
      drawImageBg(ctx, bg, W, H, res.image);
      break;
    case "none":
      drawChecker(ctx, W, H);
      break;
  }
}
