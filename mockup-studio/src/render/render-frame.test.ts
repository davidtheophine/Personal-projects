import { describe, expect, it } from "vitest";
import { computeDeviceRect } from "./render-frame";
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
