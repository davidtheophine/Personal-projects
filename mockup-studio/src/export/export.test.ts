import { beforeEach, describe, expect, it, vi } from "vitest";
import { createExporter, type ExportMode } from "./export";
import { defaultProject } from "@/state/project";

const FAST = new Blob(["fast"], { type: "video/mp4" });
const REALTIME = new Blob(["realtime"], { type: "video/mp4" });
const abort = () => new DOMException("Export cancelled", "AbortError");

function harness(opts: { fastAvailable?: boolean; fast?: () => Promise<Blob>; realtime?: () => Promise<Blob> }) {
  const ran: string[] = [];
  const modes: ExportMode[] = [];
  const exportVideo = createExporter({
    fastAvailable: () => opts.fastAvailable ?? true,
    fast: async () => {
      ran.push("fast");
      return (opts.fast ?? (async () => FAST))();
    },
    realtime: async () => {
      ran.push("realtime");
      return (opts.realtime ?? (async () => REALTIME))();
    },
  });
  const run = () =>
    exportVideo(defaultProject(), null, false, () => {}, new AbortController().signal, (m) => modes.push(m));
  return { run, ran, modes };
}

// Breaks caught: a fast-path failure surfacing as a failed export instead of a
// compatibility retry; a user's Cancel being "retried" in real time; the UI not
// learning it's in the slow keep-this-tab-open mode.
describe("exportVideo", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {}); // the fallback logs by design
  });

  it("uses the fast exporter when the browser supports it", async () => {
    const h = harness({});
    expect(await h.run()).toBe(FAST);
    expect(h.ran).toEqual(["fast"]);
    expect(h.modes).toEqual(["fast"]);
  });

  it("retries once in real-time compatibility mode when the fast path fails", async () => {
    const h = harness({ fast: async () => Promise.reject(new Error("decoder crashed")) });
    expect(await h.run()).toBe(REALTIME);
    expect(h.ran).toEqual(["fast", "realtime"]);
    expect(h.modes).toEqual(["fast", "realtime"]);
  });

  it("does not retry when the user cancelled", async () => {
    const h = harness({ fast: async () => Promise.reject(abort()) });
    await expect(h.run()).rejects.toMatchObject({ name: "AbortError" });
    expect(h.ran).toEqual(["fast"]);
  });

  it("goes straight to real time when WebCodecs is unavailable", async () => {
    const h = harness({ fastAvailable: false });
    expect(await h.run()).toBe(REALTIME);
    expect(h.ran).toEqual(["realtime"]);
    expect(h.modes).toEqual(["realtime"]);
  });

  it("reports the real-time error when both paths fail", async () => {
    const h = harness({
      fast: async () => Promise.reject(new Error("decoder crashed")),
      realtime: async () => Promise.reject(new Error("Video playback stalled during export.")),
    });
    await expect(h.run()).rejects.toThrow("Video playback stalled during export.");
  });
});
