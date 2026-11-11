import { describe, expect, it } from "vitest";
import { drawBareVideo, drawDevice } from "./device-frame";
import { recordingContext } from "@/test-utils/recording-context";

const decodedFrame = () => {
  const c = document.createElement("canvas");
  c.width = 1170;
  c.height = 2532;
  return c;
};
const drawImages = (calls: { op: string; args: unknown[] }[]) => calls.filter((c) => c.op === "drawImage");

// Break caught: the exporter hands the renderer decoded frames (canvases), not a
// <video>. If the renderer only recognises <video> it paints the dark
// placeholder instead — every exported frame would show a blank screen.
describe("drawDevice", () => {
  it("paints a decoded canvas frame into the phone screen, cover-fitted", () => {
    const { ctx, calls } = recordingContext();
    const frame = decodedFrame();
    drawDevice(ctx, { x: 0, y: 0, w: 1072, h: 2242 }, { color: "#b7b3a8", frame: "iphone" }, frame);
    const draws = drawImages(calls);
    expect(draws).toHaveLength(1);
    const [src, x, y, w, h] = draws[0].args as [unknown, number, number, number, number];
    expect(src).toBe(frame);
    // Screen = body inset by (14 + 22)/1072 of its width = 36 → {36, 36, 1000, 2170}.
    // Cover scale = max(1000/1170, 2170/2532) = 0.857030 → 1002.725 × 2170, centred.
    expect(x).toBeCloseTo(34.637, 2);
    expect(y).toBeCloseTo(36, 3);
    expect(w).toBeCloseTo(1002.725, 2);
    expect(h).toBeCloseTo(2170, 2);
  });

  it("shows the dark placeholder screen when there is no frame", () => {
    const { ctx, calls } = recordingContext();
    drawDevice(ctx, { x: 0, y: 0, w: 1072, h: 2242 }, { color: "#b7b3a8", frame: "iphone" }, null);
    expect(drawImages(calls)).toHaveLength(0);
    expect(calls.some((c) => c.op === "fillRect" && c.args.join() === "36,36,1000,2170")).toBe(true);
  });
});

describe("drawBareVideo", () => {
  it("paints a decoded canvas frame into the frameless card, cover-fitted", () => {
    const { ctx, calls } = recordingContext();
    const frame = decodedFrame();
    const noShadow = { color: "#000000", blur: 0, x: 0, y: 0, opacity: 0 };
    drawBareVideo(ctx, { x: 100, y: 50, w: 462, h: 1000 }, frame, noShadow);
    const draws = drawImages(calls);
    expect(draws).toHaveLength(1);
    const [src, x, y, w, h] = draws[0].args as [unknown, number, number, number, number];
    expect(src).toBe(frame);
    // Cover scale = max(462/1170, 1000/2532) = 0.394945 → 462.085 × 1000, centred.
    expect(x).toBeCloseTo(99.957, 2);
    expect(y).toBeCloseTo(50, 3);
    expect(w).toBeCloseTo(462.085, 2);
    expect(h).toBeCloseTo(1000, 2);
  });
});
