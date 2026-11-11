/**
 * A stand-in CanvasRenderingContext2D for tests (jsdom has no canvas backend).
 * Every method call is recorded in `calls` and every property write in `sets`,
 * so a test can assert what the renderer actually painted — e.g. which source
 * `drawImage` received and where — and which state (like `filter`) it touched.
 */
export interface Recorded {
  op: string;
  args: unknown[];
}

export function recordingContext(): {
  ctx: CanvasRenderingContext2D;
  calls: Recorded[];
  sets: Recorded[];
} {
  const calls: Recorded[] = [];
  const sets: Recorded[] = [];
  const gradient = { addColorStop: () => {} };
  const store: Record<string | symbol, unknown> = {};
  const factories: Record<string, (...a: unknown[]) => unknown> = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  const ctx = new Proxy(store, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (...args: unknown[]) => {
        calls.push({ op: String(prop), args });
        return factories[String(prop)]?.(...args);
      };
    },
    set(target, prop, value) {
      sets.push({ op: String(prop), args: [value] });
      target[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, sets };
}
