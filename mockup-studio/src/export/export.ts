import type { Project } from "@/state/project";
import { fastExport, fastExportAvailable } from "./fast-export";
import { exportVideoRealtime } from "./export-webm";

export { downloadBlob } from "./export-webm";

/** "fast" = offline WebCodecs export; "realtime" = plays the timeline through MediaRecorder. */
export type ExportMode = "fast" | "realtime";

type Exporter = (
  project: Project,
  bgImage: HTMLImageElement | null,
  muted: boolean,
  onProgress?: (p: number) => void,
  signal?: AbortSignal,
) => Promise<Blob>;

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/**
 * Fast path first; if it can't handle this browser/file (or fails or stalls
 * mid-way), retry once with the real-time exporter. A user's Cancel is never
 * retried. `onMode` tells the UI which mode is running.
 */
export function createExporter(deps: { fastAvailable: () => boolean; fast: Exporter; realtime: Exporter }) {
  return async function exportVideo(
    project: Project,
    bgImage: HTMLImageElement | null,
    muted: boolean,
    onProgress?: (p: number) => void,
    signal?: AbortSignal,
    onMode?: (mode: ExportMode) => void,
  ): Promise<Blob> {
    if (deps.fastAvailable()) {
      try {
        onMode?.("fast");
        return await deps.fast(project, bgImage, muted, onProgress, signal);
      } catch (e) {
        if (isAbort(e) || signal?.aborted) throw e;
        console.warn("[export] fast path failed; retrying in compatibility (real-time) mode.", e);
      }
    }
    onMode?.("realtime");
    onProgress?.(0);
    return deps.realtime(project, bgImage, muted, onProgress, signal);
  };
}

export const exportVideo = createExporter({
  fastAvailable: fastExportAvailable,
  fast: fastExport,
  realtime: exportVideoRealtime,
});
