import { describe, expect, it } from "vitest";
import { frameSize, type FrameSource } from "./frame-source";

// Breaks caught: the renderer sizing a frame from the wrong field — e.g. a
// <video>'s layout `width` attribute, or a VideoFrame's padded coded size —
// which mis-crops the screen, or treating a decoded canvas as "no frame yet".
describe("frameSize", () => {
  it("uses a <video>'s intrinsic videoWidth/videoHeight, not its width attribute", () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "videoWidth", { value: 1170 });
    Object.defineProperty(video, "videoHeight", { value: 2532 });
    video.width = 300;
    expect(frameSize(video)).toEqual({ w: 1170, h: 2532 });
  });

  it("reports a <video> with no decoded frame yet as 0×0", () => {
    expect(frameSize(document.createElement("video"))).toEqual({ w: 0, h: 0 });
  });

  it("uses a VideoFrame's display size, not its macroblock-padded coded size", () => {
    const frame = {
      displayWidth: 1170,
      displayHeight: 2532,
      codedWidth: 1184,
      codedHeight: 2544,
    } as unknown as FrameSource;
    expect(frameSize(frame)).toEqual({ w: 1170, h: 2532 });
  });

  it("uses a decoded canvas's pixel size", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1170;
    canvas.height = 2532;
    expect(frameSize(canvas)).toEqual({ w: 1170, h: 2532 });
  });
});
