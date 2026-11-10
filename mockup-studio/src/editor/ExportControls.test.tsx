import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExportControls, type ExportJob } from "./ExportControls";

/** A job the test drives by hand: report progress/mode, then finish or fail. */
function controllableJob() {
  let report!: Parameters<ExportJob>[0];
  let signal!: AbortSignal;
  let settle!: { resolve: () => void; reject: (e: unknown) => void };
  const job: ExportJob = (r, s) => {
    report = r;
    signal = s;
    return new Promise<void>((resolve, reject) => (settle = { resolve, reject }));
  };
  return {
    job,
    progress: (p: number) => act(() => report.progress(p)),
    mode: (m: "fast" | "realtime") => act(() => report.mode(m)),
    finish: () => act(async () => settle.resolve()),
    fail: (e: unknown) => act(async () => settle.reject(e)),
    get signal() {
      return signal;
    },
  };
}

// The main button only (not "Cancel export").
const exportButton = () => screen.getByRole("button", { name: /^(export|preparing…|exporting \d+%)$/i });

describe("ExportControls", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // failures are logged by design
  });

  it("shows Preparing… then Exporting N% while the job runs, then returns to Export", async () => {
    const j = controllableJob();
    render(<ExportControls disabled={false} job={j.job} />);
    await userEvent.click(exportButton());
    j.progress(0);
    expect(exportButton()).toHaveTextContent("Preparing…");
    j.progress(0.42);
    expect(exportButton()).toHaveTextContent("Exporting 42%");
    await j.finish();
    expect(exportButton()).toHaveTextContent(/^Export$/);
    expect(exportButton()).toBeEnabled();
  });

  // Break caught: the old App rethrew export errors "to Sentry" (absent in this
  // build) — the button just reset and the user never learned why.
  it("shows why an export failed instead of silently resetting", async () => {
    const j = controllableJob();
    render(<ExportControls disabled={false} job={j.job} />);
    await userEvent.click(exportButton());
    await j.fail(new Error("Video playback stalled during export."));
    expect(screen.getByRole("alert")).toHaveTextContent("Video playback stalled during export.");
    expect(exportButton()).toBeEnabled();
  });

  it("dismisses the error, and a new export clears an old one", async () => {
    const j = controllableJob();
    render(<ExportControls disabled={false} job={j.job} />);
    await userEvent.click(exportButton());
    await j.fail(new Error("boom"));
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(exportButton());
    await j.fail(new Error("boom again"));
    await userEvent.click(exportButton());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("cancels by aborting the job, without reporting an error", async () => {
    const j = controllableJob();
    render(<ExportControls disabled={false} job={j.job} />);
    await userEvent.click(exportButton());
    await userEvent.click(screen.getByRole("button", { name: /cancel export/i }));
    expect(j.signal.aborted).toBe(true);
    await j.fail(new DOMException("Export cancelled", "AbortError"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(exportButton()).toHaveTextContent(/^Export$/);
  });

  // Break caught: in the real-time fallback, switching tabs freezes the export.
  it("tells the user to keep the tab open only in compatibility (real-time) mode", async () => {
    const j = controllableJob();
    render(<ExportControls disabled={false} job={j.job} />);
    await userEvent.click(exportButton());
    j.mode("fast");
    expect(screen.queryByText(/keep this tab open/i)).toBeNull();
    j.mode("realtime");
    expect(screen.getByText(/keep this tab open/i)).toBeInTheDocument();
    await j.finish();
    expect(screen.queryByText(/keep this tab open/i)).toBeNull();
  });

  it("can't start while disabled (no clips)", () => {
    render(<ExportControls disabled job={controllableJob().job} />);
    expect(exportButton()).toBeDisabled();
  });
});
