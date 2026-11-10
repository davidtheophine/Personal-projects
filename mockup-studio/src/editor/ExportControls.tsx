import { useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExportMode } from "@/export/export";

/** The export work itself (App supplies it): report progress/mode, honour `signal`. */
export type ExportJob = (
  report: { progress: (p: number) => void; mode: (m: ExportMode) => void },
  signal: AbortSignal,
) => Promise<void>;

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/**
 * The header's Export button: runs the job with a progress label and a Cancel
 * button, warns to keep the tab open only in the real-time fallback (the fast
 * path keeps going in a background tab), and shows why an export failed —
 * dismissible — instead of silently resetting.
 */
export function ExportControls({
  disabled,
  job,
  onBusyChange,
}: {
  disabled: boolean;
  job: ExportJob;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [mode, setMode] = useState<ExportMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = async () => {
    if (busy || disabled) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    onBusyChange?.(true);
    setPct(0);
    setMode(null);
    setError(null);
    try {
      await job({ progress: setPct, mode: setMode }, controller.signal);
    } catch (e) {
      if (!isAbort(e)) {
        console.error("[export] failed", e);
        setError(e instanceof Error && e.message ? e.message : "Something went wrong.");
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      onBusyChange?.(false);
      setPct(0);
      setMode(null);
    }
  };

  const label = !busy ? "Export" : pct < 0.03 ? "Preparing…" : `Exporting ${Math.round(pct * 100)}%`;
  return (
    <div className="relative flex items-center gap-1">
      {busy && mode === "realtime" && (
        <span className="mr-1 text-xs text-muted-foreground">Compatibility mode — keep this tab open</span>
      )}
      <Button variant="secondary" size="sm" disabled={disabled || busy} onClick={start}>
        <Download className="h-4 w-4" />
        {label}
      </Button>
      {busy && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => abortRef.current?.abort()}
          title="Cancel export"
          aria-label="Cancel export"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      {error && (
        <div
          role="alert"
          className="absolute right-0 top-full z-50 mt-2 flex w-80 items-start gap-2 rounded-lg border border-destructive/40 bg-background p-3 text-xs shadow-lg"
        >
          <span className="flex-1">
            <span className="font-medium">Export failed.</span> {error}
          </span>
          <Button variant="ghost" size="icon-xs" onClick={() => setError(null)} aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
