import { describe, expect, it } from "vitest";
import { planFrames } from "./frame-plan";
import type { VideoClip } from "@/state/project";

const clip = (o: Partial<VideoClip>): VideoClip => ({
  id: "c",
  mediaId: "m",
  url: "blob:x",
  name: "x.mp4",
  width: 1170,
  height: 2532,
  duration: 20,
  hasAudio: false,
  in: 0,
  out: 20,
  start: 0,
  speed: 1,
  ...o,
});
// Which 60 fps source frame a planned source time lands on.
const srcFrame = (t: number) => Math.floor(t * 60);

describe("planFrames", () => {
  it("emits one output frame per 1/fps of timeline, each mapped to the clip's source time", () => {
    const plan = planFrames([clip({ out: 2 })], 30);
    expect(plan.count).toBe(60);
    expect(plan.frames[0]?.clipIndex).toBe(0);
    expect(plan.frames[0]?.localTime).toBeCloseTo(0, 3);
    expect(plan.frames[59]?.localTime).toBeCloseTo(59 / 30, 3);
  });

  it("is frame-exact: a trimmed 1× clip shows source frame 2i at output frame i (60→30 fps)", () => {
    // Break caught: float rounding (3 + i/30 vs (180+2i)/60) picking the
    // previous source frame on exact boundaries → off-by-one stutter.
    const plan = planFrames([clip({ in: 3, out: 13 })], 30);
    expect(plan.count).toBe(300);
    const got = plan.frames.map((f) => srcFrame(f!.localTime));
    expect(got.every((s, i) => s === 180 + 2 * i)).toBe(true);
  });

  it("advances source time by the speed multiplier", () => {
    const fast = planFrames([clip({ in: 0, out: 4, speed: 2 })], 30);
    expect(fast.count).toBe(60); // 4 s of source at 2× = 2 s of output
    expect(fast.frames[30]?.localTime).toBeCloseTo(2, 3);
    const slow = planFrames([clip({ in: 0, out: 1, speed: 0.5 })], 30);
    expect(slow.count).toBe(60); // 1 s of source at 0.5× = 2 s of output
    expect(slow.frames[30]?.localTime).toBeCloseTo(0.5, 3);
  });

  it("leaves gaps between clips empty (null) and resumes on the next clip", () => {
    const plan = planFrames(
      [clip({ id: "a", in: 0, out: 1, start: 0 }), clip({ id: "b", in: 5, out: 6, start: 1.5 })],
      30,
    );
    expect(plan.count).toBe(75);
    expect(plan.frames.slice(0, 30).every((f) => f?.clipIndex === 0)).toBe(true);
    expect(plan.frames.slice(30, 45).every((f) => f === null)).toBe(true);
    expect(plan.frames[45]?.clipIndex).toBe(1);
    expect(plan.frames[45]?.localTime).toBeCloseTo(5, 3);
  });

  it("gives the boundary frame of two adjacent clips to the second clip", () => {
    const plan = planFrames(
      [clip({ id: "a", in: 0, out: 1, start: 0 }), clip({ id: "b", in: 7, out: 8, start: 1 })],
      30,
    );
    expect(plan.frames[29]?.clipIndex).toBe(0);
    expect(plan.frames[30]?.clipIndex).toBe(1);
    expect(plan.frames[30]?.localTime).toBeCloseTo(7, 3);
  });

  it("lets the later clip win where clips overlap (same rule as the preview)", () => {
    const plan = planFrames(
      [clip({ id: "a", in: 0, out: 2, start: 0 }), clip({ id: "b", in: 0, out: 2, start: 1 })],
      30,
    );
    expect(plan.frames[45]?.clipIndex).toBe(1); // t = 1.5 s
    expect(plan.timestampsByClip.get(0)).toHaveLength(30); // a only shows until b starts
    expect(plan.timestampsByClip.get(1)).toHaveLength(60);
  });

  it("lists each clip's source times in output order, never going backwards", () => {
    const plan = planFrames(
      [clip({ id: "a", in: 2, out: 6, start: 0, speed: 1.5 }), clip({ id: "b", in: 1, out: 3, start: 3 })],
      30,
    );
    for (const list of plan.timestampsByClip.values()) {
      for (let i = 1; i < list.length; i++) expect(list[i]).toBeGreaterThan(list[i - 1]);
    }
  });

  it("does not add a phantom frame when float error lands the duration just past a frame", () => {
    // 0.1 + 0.2 = 0.30000000000000004 → ×30 = 9.000000000000002, still 9 frames.
    expect(planFrames([clip({ in: 0, out: 0.1 + 0.2 })], 30).count).toBe(9);
  });

  it("plans nothing for an empty timeline", () => {
    const plan = planFrames([], 30);
    expect(plan.count).toBe(0);
    expect(plan.frames).toEqual([]);
  });
});
