import { describe, expect, it } from "vitest";
import { hexToRgb, shade, withAlpha } from "./color";

describe("hexToRgb", () => {
  it("parses 6-digit hex", () => {
    expect(hexToRgb("#ff8000")).toEqual({ r: 255, g: 128, b: 0 });
  });
  it("expands 3-digit hex", () => {
    expect(hexToRgb("#f80")).toEqual({ r: 255, g: 136, b: 0 });
  });
});

describe("shade", () => {
  it("lightens toward white", () => {
    expect(shade("#000000", 1)).toBe("rgb(255, 255, 255)");
  });
  it("darkens toward black", () => {
    expect(shade("#ffffff", -1)).toBe("rgb(0, 0, 0)");
  });
});

describe("withAlpha", () => {
  it("adds an alpha channel", () => {
    expect(withAlpha("#ffffff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
  });
  it("clamps alpha to 0..1", () => {
    expect(withAlpha("#ffffff", 2)).toBe("rgba(255, 255, 255, 1)");
  });
});
