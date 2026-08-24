import { describe, expect, it } from "vitest";
import { clamp01, fitRect, insetRect } from "./geometry";

describe("insetRect", () => {
  it("shrinks on all sides", () => {
    expect(insetRect({ x: 0, y: 0, w: 100, h: 200 }, 10)).toEqual({
      x: 10,
      y: 10,
      w: 80,
      h: 180,
    });
  });
});

describe("clamp01", () => {
  it("clamps out-of-range values", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe("fitRect", () => {
  it("cover fills the dest and crops, centered", () => {
    const r = fitRect(100, 100, { x: 0, y: 0, w: 200, h: 100 }, "cover");
    expect(r.w).toBeCloseTo(200);
    expect(r.h).toBeCloseTo(200);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(-50);
  });

  it("contain fits within the dest and letterboxes, centered", () => {
    const r = fitRect(100, 100, { x: 0, y: 0, w: 200, h: 100 }, "contain");
    expect(r.w).toBeCloseTo(100);
    expect(r.h).toBeCloseTo(100);
    expect(r.x).toBeCloseTo(50);
    expect(r.y).toBeCloseTo(0);
  });
});
