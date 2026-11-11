/**
 * Settle with `step`, but reject with an AbortError as soon as `signal` aborts
 * and with "<label> timed out." after `ms` — so a single stuck step (a network
 * fetch, a media element that never loads) can't hang an export forever with a
 * Cancel button that does nothing.
 */
export function bounded<T>(step: Promise<T>, opts: { label: string; ms: number; signal?: AbortSignal }): Promise<T> {
  const { label, ms, signal } = opts;
  return new Promise<T>((resolve, reject) => {
    const cancelled = () => new DOMException("Export cancelled", "AbortError");
    if (signal?.aborted) {
      reject(cancelled());
      return;
    }
    const onAbort = () => {
      done();
      reject(cancelled());
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error(`${label} timed out.`));
    }, ms);
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    step.then(
      (v) => {
        done();
        resolve(v);
      },
      (e) => {
        done();
        reject(e);
      },
    );
  });
}
