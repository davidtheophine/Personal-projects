import { describe, expect, it } from "vitest";
import { createStallWatchdog, ExportStalled } from "./stall-watchdog";

/** A hand-cranked clock: `advance` runs the check every second, `jump` delivers one late check. */
function fakeClock() {
  let t = 0;
  let check: (() => void) | null = null;
  return {
    now: () => t,
    schedule: (fn: () => void) => {
      check = fn;
      return () => (check = null);
    },
    advance(ms: number) {
      for (let x = 0; x < ms; x += 1000) {
        t += 1000;
        check?.();
      }
    },
    jump(ms: number) {
      t += ms;
      check?.();
    },
    get running() {
      return check !== null;
    },
  };
}

async function outcome(p: Promise<never>): Promise<"pending" | Error> {
  let r: "pending" | Error = "pending";
  p.catch((e: Error) => (r = e));
  await Promise.resolve();
  await Promise.resolve();
  return r;
}

describe("createStallWatchdog", () => {
  it("fails once progress has stopped for longer than the limit", async () => {
    const clock = fakeClock();
    const w = createStallWatchdog({ limitMs: 20_000, now: clock.now, schedule: clock.schedule });
    clock.advance(21_000);
    expect(await outcome(w.stalled)).toBeInstanceOf(ExportStalled);
  });

  it("stays quiet while progress keeps ticking", async () => {
    const clock = fakeClock();
    const w = createStallWatchdog({ limitMs: 20_000, now: clock.now, schedule: clock.schedule });
    clock.advance(15_000);
    w.tick();
    clock.advance(15_000);
    expect(await outcome(w.stalled)).toBe("pending");
  });

  // Break caught (reviewer): a wall-clock watchdog counted a long synchronous
  // step of our own (time-stretching a long slowed clip) or a frozen/suspended
  // tab as "no progress" and restarted a ~3 s export as a full real-time one.
  it("does not count a late check (main thread busy, tab frozen, machine asleep) as a stall", async () => {
    const clock = fakeClock();
    const w = createStallWatchdog({ limitMs: 20_000, now: clock.now, schedule: clock.schedule });
    clock.advance(5_000);
    clock.jump(30_000); // the next check only got to run 30 s later
    clock.advance(15_000);
    expect(await outcome(w.stalled)).toBe("pending");
    clock.advance(6_000); // …but a real stall afterwards is still caught
    expect(await outcome(w.stalled)).toBeInstanceOf(ExportStalled);
  });

  it("allows a longer limit for slow steps like muxing the final file", async () => {
    const clock = fakeClock();
    const w = createStallWatchdog({ limitMs: 20_000, now: clock.now, schedule: clock.schedule });
    w.setLimit(120_000);
    clock.advance(60_000);
    expect(await outcome(w.stalled)).toBe("pending");
  });

  it("stops checking when stopped", () => {
    const clock = fakeClock();
    const w = createStallWatchdog({ limitMs: 20_000, now: clock.now, schedule: clock.schedule });
    w.stop();
    expect(clock.running).toBe(false);
  });
});
