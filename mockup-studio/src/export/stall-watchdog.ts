/** Decoding/encoding stopped making progress. */
export class ExportStalled extends Error {
  override name = "ExportStalled";
}

export interface StallWatchdog {
  /** Rejects with ExportStalled once progress has stopped for longer than the limit; never resolves. */
  stalled: Promise<never>;
  /** Record progress. */
  tick(): void;
  /** Change the allowed gap (e.g. longer while muxing the final file). */
  setLimit(ms: number): void;
  stop(): void;
}

/** A check arriving this many intervals late means the page itself wasn't running. */
const LATE_FACTOR = 5;

/**
 * Detects a stalled export: async work (a decoder/encoder promise) that stops
 * settling while the page is otherwise running. A check that itself runs very
 * late — the main thread was busy with our own synchronous work, or the tab was
 * frozen or the machine asleep — restarts the clock instead of firing, so only
 * genuine "nothing is happening" counts.
 */
export function createStallWatchdog(opts: {
  limitMs: number;
  checkEveryMs?: number;
  now?: () => number;
  schedule?: (check: () => void, everyMs: number) => () => void;
}): StallWatchdog {
  const now = opts.now ?? (() => performance.now());
  const every = opts.checkEveryMs ?? 1000;
  const schedule =
    opts.schedule ??
    ((check: () => void, ms: number) => {
      const id = setInterval(check, ms);
      return () => clearInterval(id);
    });
  let limit = opts.limitMs;
  let lastProgress = now();
  let lastCheck = lastProgress;
  let fail: (e: Error) => void = () => {};
  const stalled = new Promise<never>((_, reject) => (fail = reject));
  stalled.catch(() => {}); // observed by whoever races it
  const cancel = schedule(() => {
    const t = now();
    const late = t - lastCheck > every * LATE_FACTOR;
    lastCheck = t;
    if (late) {
      lastProgress = t;
      return;
    }
    if (t - lastProgress > limit) {
      fail(new ExportStalled(`Export stopped making progress for ${Math.round(limit / 1000)} s.`));
    }
  }, every);
  return {
    stalled,
    tick: () => {
      lastProgress = now();
    },
    setLimit: (ms) => {
      limit = ms;
    },
    stop: cancel,
  };
}
