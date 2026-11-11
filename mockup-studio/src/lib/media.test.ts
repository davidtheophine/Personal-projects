import { afterEach, describe, expect, it, vi } from "vitest";
import { seekVideo } from "./media";

// Break caught: a seek whose "seeked" event never arrives (decoder hiccup,
// unplayable file) hanging the export forever at the same percentage.
describe("seekVideo", () => {
  it("resolves once the element reports the seek finished", async () => {
    const el = document.createElement("video");
    const p = seekVideo(el, 2.5, 1000);
    el.dispatchEvent(new Event("seeked"));
    await expect(p).resolves.toBeUndefined();
  });

  it("rejects instead of waiting forever when the seek never completes", async () => {
    const el = document.createElement("video"); // jsdom never fires "seeked"
    await expect(seekVideo(el, 2.5, 30)).rejects.toThrow(/seek/i);
  });

  // Break caught (reviewer): the timeout is opt-in (the exporter passes one).
  // A default made slow-but-fine seeks elsewhere (timeline thumbnails on a big
  // file) fail with unhandled rejections and missing thumbnails.
  it("waits as long as it takes when no timeout is given", async () => {
    vi.useFakeTimers();
    const el = document.createElement("video");
    let settled: string = "pending";
    seekVideo(el, 3).then(
      () => (settled = "resolved"),
      () => (settled = "rejected"),
    );
    await vi.advanceTimersByTimeAsync(60_000);
    expect(settled).toBe("pending");
    el.dispatchEvent(new Event("seeked"));
    await Promise.resolve();
    expect(settled).toBe("resolved");
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
