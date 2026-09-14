import { describe, expect, it } from "vitest";
import { computeDeviceRect, displayLayout } from "./render-frame";
import { defaultProject } from "@/state/project";

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
