import { afterEach, describe, expect, it, vi } from "vitest";
import { bounded } from "./bounded";

const never = () => new Promise<never>(() => {});

// Break caught (reviewer): steps awaited outside the exporter's watchdog — the
// 3D model download, the exporter chunk import, loading a clip, resuming audio,
// tearing down a cancelled output — could each hang forever, leaving
// "Preparing…" on screen with a Cancel button that did nothing.
describe("bounded", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("settles with the step's own result and leaves no timer behind", async () => {
    vi.useFakeTimers();
    await expect(bounded(Promise.resolve(5), { label: "Loading", ms: 1000 })).resolves.toBe(5);
    await expect(bounded(Promise.reject(new Error("bad file")), { label: "Loading", ms: 1000 })).rejects.toThrow("bad file");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("gives up with a clear message when the step never finishes", async () => {
    vi.useFakeTimers();
    const p = bounded(never(), { label: "Loading the 3D iPhone model", ms: 30_000 });
    const check = expect(p).rejects.toThrow("Loading the 3D iPhone model timed out.");
    await vi.advanceTimersByTimeAsync(30_000);
    await check;
  });

  it("rejects as cancelled the moment the user cancels", async () => {
    const ctrl = new AbortController();
    const p = bounded(never(), { label: "Loading", ms: 60_000, signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects as cancelled straight away if already cancelled", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(bounded(never(), { label: "Loading", ms: 60_000, signal: ctrl.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
