import { describe, expect, it } from "vitest";
import { timeStretch } from "./time-stretch";

const SR = 48000;
const sine = (hz: number, seconds: number, amp = 0.5) => {
  const a = new Float32Array(Math.round(SR * seconds));
  for (let i = 0; i < a.length; i++) a[i] = amp * Math.sin((2 * Math.PI * hz * i) / SR);
  return a;
};
// Frequency from zero crossings over the middle 80% (edges ramp in/out).
const frequency = (a: Float32Array) => {
  const lo = Math.floor(a.length * 0.1);
  const hi = Math.floor(a.length * 0.9);
  let crossings = 0;
  for (let i = lo + 1; i < hi; i++) if ((a[i - 1] < 0) !== (a[i] < 0)) crossings++;
  return crossings / 2 / ((hi - lo) / SR);
};
const rms = (a: Float32Array) => {
  const lo = Math.floor(a.length * 0.1);
  const hi = Math.floor(a.length * 0.9);
  let s = 0;
  for (let i = lo; i < hi; i++) s += a[i] * a[i];
  return Math.sqrt(s / (hi - lo));
};

// Breaks caught: sped-up/slowed clips coming out pitch-shifted ("chipmunk"),
// the wrong length (A/V drift), or with an amplitude wobble from bad overlap-add.
describe("timeStretch", () => {
  it("returns the audio unchanged at 1×", () => {
    const a = sine(440, 0.5);
    const [out] = timeStretch([a], 1, SR);
    expect(out).toEqual(a);
  });

  it("halves the duration at 2× while keeping a 440 Hz tone at 440 Hz", () => {
    const [out] = timeStretch([sine(440, 1)], 2, SR);
    expect(Math.abs(out.length - 24000)).toBeLessThanOrEqual(1);
    expect(frequency(out)).toBeGreaterThan(440 * 0.98); // a plain resample would be 880 Hz
    expect(frequency(out)).toBeLessThan(440 * 1.02);
  });

  it("doubles the duration at 0.5× while keeping a 440 Hz tone at 440 Hz", () => {
    const [out] = timeStretch([sine(440, 1)], 0.5, SR);
    expect(Math.abs(out.length - 96000)).toBeLessThanOrEqual(1);
    expect(frequency(out)).toBeGreaterThan(440 * 0.98); // a plain resample would be 220 Hz
    expect(frequency(out)).toBeLessThan(440 * 1.02);
  });

  it("keeps the loudness of the original", () => {
    for (const rate of [0.5, 1.5, 2, 4]) {
      const [out] = timeStretch([sine(440, 1, 0.5)], rate, SR);
      expect(rms(out)).toBeGreaterThan(0.354 * 0.9); // RMS of a 0.5-amplitude sine = 0.354
      expect(rms(out)).toBeLessThan(0.354 * 1.1);
    }
  });

  it("keeps full level right up to the clip's edges (no fade at cuts)", () => {
    // Break caught: un-normalised overlap-add fades each stretched piece in and
    // out over half a window (~20 ms) — an audible dip at every clip boundary.
    const [out] = timeStretch([sine(440, 1, 0.5)], 2, SR);
    const edge = (a: Float32Array) => {
      let s = 0;
      for (const x of a) s += x * x;
      return Math.sqrt(s / a.length);
    };
    const tenMs = SR / 100;
    expect(edge(out.subarray(1, tenMs))).toBeGreaterThan(0.354 * 0.85);
    expect(edge(out.subarray(out.length - tenMs))).toBeGreaterThan(0.354 * 0.85);
  });

  it("stretches every channel identically", () => {
    const a = sine(300, 1);
    const [l, r] = timeStretch([a, a.slice()], 1.5, SR);
    expect(l.length).toBe(r.length);
    expect(r).toEqual(l);
    expect(l.every((x) => Number.isFinite(x))).toBe(true);
  });

  it("handles a clip shorter than one analysis window without failing", () => {
    const [out] = timeStretch([sine(440, 0.02)], 2, SR); // 960 samples
    expect(Math.abs(out.length - 480)).toBeLessThanOrEqual(1);
    expect(out.every((x) => Number.isFinite(x))).toBe(true);
  });
});
