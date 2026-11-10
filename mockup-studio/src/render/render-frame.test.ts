import { describe, expect, it, vi } from "vitest";
import { computeDeviceRect, displayLayout, renderBackgroundLayer, renderFrame } from "./render-frame";
import { defaultProject } from "@/state/project";
import { recordingContext } from "@/test-utils/recording-context";

describe("computeDeviceRect", () => {
  it("centers the device in the canvas at the default layout", () => {
    const p = defaultProject();
    const W = 1080;
    const H = 1920;
    const r = computeDeviceRect(p, W, H);
    expect(r.x + r.w / 2).toBeCloseTo(W / 2, 3);
    expect(r.y + r.h / 2).toBeCloseTo(H / 2, 3);
    expect(r.x).toBeGreaterThan(0);
    expect(r.y).toBeGreaterThan(0);
    expect(r.w).toBeLessThan(W);
    expect(r.h).toBeLessThan(H);
  });

  it("scales the device down with layout.scale", () => {
    const p = defaultProject();
    const full = computeDeviceRect(p, 1080, 1920);
    const half = computeDeviceRect(
      { ...p, layout: { ...p.layout, scale: 0.5 } },
      1080,
      1920,
    );
    expect(half.w).toBeCloseTo(full.w * 0.5, 3);
    expect(half.h).toBeCloseTo(full.h * 0.5, 3);
  });
});

describe("displayLayout", () => {
  it("insets the screen inside the body when the iPhone frame is on", () => {
    const p = defaultProject();
    const { frameless, rect, screen } = displayLayout(p, 1080, 1920);
    expect(frameless).toBe(false);
    expect(screen.w).toBeLessThan(rect.w);
    expect(screen.x).toBeGreaterThan(rect.x);
  });

  it("treats the whole video card as the screen when the frame is off", () => {
    const p = { ...defaultProject(), device: { color: "#b7b3a8", frame: "none" as const } };
    const { frameless, rect, screen } = displayLayout(p, 1080, 1920);
    expect(frameless).toBe(true);
    expect(screen).toEqual(rect);
  });
});

// An image background with a blur filter, plus a loaded image to draw.
function imageBgProject() {
  const p = defaultProject(); // 4:3 → 1440×1080
  p.background.type = "image";
  p.background.image = { ...p.background.image, src: "bg.png", blur: 40 };
  const img = document.createElement("img");
  Object.defineProperty(img, "naturalWidth", { value: 1600 });
  Object.defineProperty(img, "naturalHeight", { value: 1200 });
  return { p, img };
}

// Break caught: exporters pass a pre-rendered background so the (static, but
// filter/blur-heavy) background isn't recomputed for every exported frame. If
// renderFrame ignored the layer, export would keep paying that cost per frame.
describe("renderFrame background layer", () => {
  it("blits a pre-rendered background layer instead of re-running the background filters", () => {
    const { p, img } = imageBgProject();
    const layer = document.createElement("canvas");
    const { ctx, calls, sets } = recordingContext();
    renderFrame(ctx, p, null, 0, { bg: { image: img }, bgLayer: layer });
    const draws = calls.filter((c) => c.op === "drawImage");
    expect(draws[0].args).toEqual([layer, 0, 0, 1440, 1080]);
    expect(draws.some((c) => c.args[0] === img)).toBe(false);
    expect(sets.some((s) => s.op === "filter")).toBe(false);
  });

  it("draws the filtered image background itself when no layer is given (live preview)", () => {
    const { p, img } = imageBgProject();
    const { ctx, calls, sets } = recordingContext();
    renderFrame(ctx, p, null, 0, { bg: { image: img } });
    expect(calls.some((c) => c.op === "drawImage" && c.args[0] === img)).toBe(true);
    expect(sets.some((s) => s.op === "filter" && String(s.args[0]).includes("blur(40px)"))).toBe(true);
  });
});

describe("renderBackgroundLayer", () => {
  it("renders the background once, at the project's export resolution", () => {
    const { ctx, calls } = recordingContext();
    const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
    try {
      const p = { ...defaultProject(), aspect: "9:16" as const };
      p.background = { ...p.background, type: "solid", color: "#123456" };
      const layer = renderBackgroundLayer(p, { image: null });
      expect(layer?.width).toBe(1080);
      expect(layer?.height).toBe(1920);
      expect(calls.filter((c) => c.op === "fillRect").map((c) => c.args.join())).toEqual(["0,0,1080,1920"]);
    } finally {
      spy.mockRestore();
    }
  });
});
