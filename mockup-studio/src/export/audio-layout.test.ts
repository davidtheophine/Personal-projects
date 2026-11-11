import { describe, expect, it } from "vitest";
import { layoutPiece, type DecodedChunk } from "./audio-layout";

const SR = 1000; // 1 sample per ms keeps the arithmetic readable

/** A decoded chunk whose channel c holds `fill(c, i)` at sample i (relative to the chunk). */
function chunk(start: number, seconds: number, channels: number, fill: (c: number, i: number) => number): DecodedChunk {
  const n = Math.round(seconds * SR);
  const data = Array.from({ length: channels }, (_, c) => Float32Array.from({ length: n }, (_, i) => fill(c, i)));
  return { timestamp: start, duration: seconds, sampleRate: SR, data };
}

describe("layoutPiece", () => {
  it("returns exactly the piece's source range when the audio began before it", () => {
    // Source sample k (at k ms) holds k/1000, so values reveal where we cut.
    const chunks = [chunk(0, 1.5, 2, (_, i) => i / 1000), chunk(1.5, 1.5, 2, (_, i) => 1.5 + i / 1000)];
    const out = layoutPiece(chunks, { srcOffset: 1, srcDuration: 1 })!;
    expect(out.lead).toBe(0);
    expect(out.channels).toHaveLength(2);
    expect(out.channels[0]).toHaveLength(1000);
    expect(out.channels[0][0]).toBeCloseTo(1, 6); // first sample = source t 1.000 s
    expect(out.channels[0][999]).toBeCloseTo(1.999, 6);
  });

  // Break caught (reviewer, confirmed in Chrome): a track whose audio starts
  // 0.5 s after the clip's in-point was placed at the in-point — the export's
  // audio led the picture by 0.5 s and overran into the next piece.
  it("starts late audio late, and still ends where the piece ends", () => {
    const chunks = [chunk(0.5, 3, 2, () => 0.25)];
    const out = layoutPiece(chunks, { srcOffset: 0, srcDuration: 2 })!;
    expect(out.lead).toBeCloseTo(0.5, 9); // audio begins 0.5 s into the piece
    expect(out.channels[0]).toHaveLength(1500); // 0.5 → 2.0 s of source, not 2 s from 0.5
  });

  // Break caught (reviewer, confirmed in Chrome): only channels 0/1 were kept,
  // so a 5.1 source lost its centre (dialogue) channel → silent export.
  it("keeps every channel of a 5.1 source for the mixer to down-mix", () => {
    const chunks = [chunk(0, 1, 6, (c) => (c === 2 ? 0.5 : 0))];
    const out = layoutPiece(chunks, { srcOffset: 0, srcDuration: 1 })!;
    expect(out.channels).toHaveLength(6);
    expect(out.channels[2][10]).toBe(0.5);
  });

  it("keeps a mono source mono (the mixer plays it on both sides)", () => {
    const out = layoutPiece([chunk(0, 1, 1, () => 0.3)], { srcOffset: 0, srcDuration: 1 })!;
    expect(out.channels).toHaveLength(1);
    expect(out.channels[0][500]).toBeCloseTo(0.3, 6);
  });

  it("leaves a gap in the track silent instead of shifting later audio earlier", () => {
    const chunks = [chunk(0, 1, 1, () => 0.4), chunk(2, 1, 1, () => 0.8)];
    const out = layoutPiece(chunks, { srcOffset: 0, srcDuration: 3 })!;
    expect(out.channels[0]).toHaveLength(3000);
    expect(out.channels[0][1500]).toBe(0);
    expect(out.channels[0][2000]).toBeCloseTo(0.8, 6);
  });

  it("returns nothing when no audio was decoded for the piece", () => {
    expect(layoutPiece([], { srcOffset: 0, srcDuration: 1 })).toBeNull();
  });
});
