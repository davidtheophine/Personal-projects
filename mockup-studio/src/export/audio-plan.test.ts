import { describe, expect, it } from "vitest";
import { activeIntervals, audioSchedule } from "./audio-plan";
import type { VideoClip } from "@/state/project";

const clip = (o: Partial<VideoClip>): VideoClip => ({
  id: "c",
  mediaId: "m",
  url: "blob:x",
  name: "x.mp4",
  width: 1170,
  height: 2532,
  duration: 20,
  hasAudio: true,
  in: 0,
  out: 20,
  start: 0,
  speed: 1,
  ...o,
});

describe("activeIntervals", () => {
  it("is each clip's timeline span when clips don't overlap", () => {
    expect(
      activeIntervals([clip({ in: 0, out: 2, start: 0 }), clip({ in: 0, out: 1, start: 3 })]),
    ).toEqual([
      { clipIndex: 0, start: 0, end: 2 },
      { clipIndex: 1, start: 3, end: 4 },
    ]);
  });

  it("cuts an earlier clip where a later clip overlaps it (the later clip is the one heard)", () => {
    // Break caught: both clips' audio playing at once over the overlap, while the
    // video only shows the later clip.
    expect(
      activeIntervals([clip({ in: 0, out: 10, start: 0 }), clip({ in: 0, out: 2, start: 3 })]),
    ).toEqual([
      { clipIndex: 0, start: 0, end: 3 },
      { clipIndex: 1, start: 3, end: 5 },
      { clipIndex: 0, start: 5, end: 10 },
    ]);
  });

  it("drops zero-length clips", () => {
    expect(activeIntervals([clip({ in: 4, out: 4 })])).toEqual([]);
  });
});

describe("audioSchedule", () => {
  it("places a trimmed clip's source audio at its timeline position", () => {
    expect(audioSchedule([clip({ in: 2, out: 6, start: 1 })])).toEqual([
      { clipIndex: 0, when: 1, srcOffset: 2, srcDuration: 4, outDuration: 4, speed: 1 },
    ]);
  });

  it("reads speed× more source than the output time it fills", () => {
    expect(audioSchedule([clip({ in: 0, out: 8, start: 0, speed: 2 })])).toEqual([
      { clipIndex: 0, when: 0, srcOffset: 0, srcDuration: 8, outDuration: 4, speed: 2 },
    ]);
  });

  it("resumes an overlapped clip at the right source position", () => {
    // Clip 0 plays [0,3) and [5,10) at 2×; the resumed piece starts 5 s of
    // output = 10 s of source past its in-point (1 + 10 = 11).
    const pieces = audioSchedule([
      clip({ in: 1, out: 21, start: 0, speed: 2 }),
      clip({ in: 0, out: 2, start: 3 }),
    ]);
    expect(pieces[2]).toEqual({ clipIndex: 0, when: 5, srcOffset: 11, srcDuration: 10, outDuration: 5, speed: 2 });
  });
});
