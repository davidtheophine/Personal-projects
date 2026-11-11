import type { Project } from "@/state/project";
import { aspectDims } from "@/state/project";
import { clipLen, totalDuration } from "@/state/clips";
import { renderBackgroundLayer, renderFrame } from "@/render/render-frame";
import { seekVideo } from "@/lib/media";
import { bounded } from "@/lib/bounded";
import { clamp } from "@/render/geometry";

/** A seek that hasn't completed in this long is treated as failed. */
const SEEK_TIMEOUT_MS = 10_000;
/** Playback that hasn't advanced in this long (tab visible) is treated as stalled. */
const STALL_MS = 10_000;

function pickMime(): string {
  // Prefer MP4 (H.264/AAC) where the browser's MediaRecorder supports it
  // (modern Chrome), falling back to WebM.
  const candidates = [
    "video/mp4;codecs=avc1.640028,mp4a.40.2",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "video/webm";
}

function loadEl(url: string, muted: boolean): Promise<HTMLVideoElement> {
  const el = document.createElement("video");
  el.src = url;
  el.playsInline = true;
  el.preload = "auto";
  el.muted = muted;
  return new Promise((resolve, reject) => {
    if (el.readyState >= 1) return resolve(el);
    el.onloadedmetadata = () => resolve(el);
    el.onerror = () => reject(new Error("Could not load a clip for export."));
  });
}

/**
 * Play every clip's kept region back-to-back through the shared `renderFrame`
 * into an offscreen canvas at export resolution, capturing the canvas (+ each
 * clip's audio) with MediaRecorder. Real-time: takes as long as the output
 * plays. Modern Chrome emits MP4; other browsers fall back to WebM.
 */
export async function exportVideoRealtime(
  project: Project,
  bgImage: HTMLImageElement | null,
  muted: boolean,
  onProgress?: (p: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const clips = project.clips;
  if (clips.length === 0) throw new Error("Add a video before exporting.");
  const cancelled = () => new DOMException("Export cancelled", "AbortError");

  const { width: W, height: H } = aspectDims(project.aspect);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable in this browser.");
  // The background is static: render it once, blit it per frame.
  const res = { bg: { image: bgImage }, bgLayer: renderBackgroundLayer(project, { image: bgImage }) };

  const fps = 30;
  const stream = canvas.captureStream(fps);

  // Fresh elements just for export — never the preview's elements, so routing
  // their audio through Web Audio can't hijack live playback.
  const els = await bounded(Promise.all(clips.map((c) => loadEl(c.url, muted))), {
    label: "Loading the clips",
    ms: 20_000,
    signal,
  });

  // Carry audio through, unless muted. Route EVERY element into the recording
  // graph (not gated on the sometimes-wrong `hasAudio` probe): capturing an
  // element via Web Audio removes it from the speakers, so nothing plays out
  // loud during export. A clip with no audio just contributes silence.
  let audioCtx: AudioContext | null = null;
  if (!muted) {
    audioCtx = new AudioContext();
    // Can stay pending without a user gesture (Safari): don't let it hang the export.
    await bounded(audioCtx.resume(), { label: "Starting audio", ms: 5000, signal }).catch(() => {});
    const dest = audioCtx.createMediaStreamDestination();
    const track = dest.stream.getAudioTracks()[0];
    if (track) stream.addTrack(track);
    for (const el of els) {
      try {
        audioCtx.createMediaElementSource(el).connect(dest);
      } catch {
        el.muted = true; // couldn't capture it → hard-mute so it can't play aloud
      }
    }
  }

  const mime = pickMime();
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
    recorder.onerror = () => reject(new Error("The recorder failed while exporting."));
  });

  const total = Math.max(0.001, totalDuration(clips));
  recorder.start();

  // Play clips in timeline order; render black for any gap between them.
  const ordered = clips
    .map((c, i) => ({ clip: c, el: els[i] }))
    .sort((a, b) => a.clip.start - b.clip.start);

  const renderBlack = (from: number, to: number) =>
    new Promise<void>((resolve, reject) => {
      let raf = 0;
      let last = performance.now();
      let t = from;
      const step = () => {
        if (signal?.aborted) {
          cancelAnimationFrame(raf);
          reject(cancelled());
          return;
        }
        try {
          const now = performance.now();
          t += (now - last) / 1000;
          last = now;
          const at = Math.min(t, to);
          renderFrame(ctx, project, null, at, res);
          onProgress?.(clamp(at / total, 0, 1));
          if (t >= to) {
            cancelAnimationFrame(raf);
            resolve();
            return;
          }
          raf = requestAnimationFrame(step);
        } catch (err) {
          cancelAnimationFrame(raf);
          reject(err);
        }
      };
      raf = requestAnimationFrame(step);
    });

  try {
    let cursor = 0;
    for (const { clip, el } of ordered) {
      if (signal?.aborted) throw cancelled();
      if (clip.start > cursor + 0.02) await renderBlack(cursor, clip.start);
      const spd = clip.speed || 1;
      await seekVideo(el, clip.in, SEEK_TIMEOUT_MS);
      el.playbackRate = spd;
      try {
        await el.play();
      } catch {
        // Swallowing this used to leave the export spinning at the same % forever.
        if (signal?.aborted) throw cancelled();
        throw new Error(
          "The browser blocked video playback, which this export mode needs. Click Export again and keep this tab in front.",
        );
      }
      await new Promise<void>((resolve, reject) => {
        let raf = 0;
        let lastT = el.currentTime;
        let lastMove = performance.now();
        let lastStep = lastMove;
        const step = () => {
          if (signal?.aborted) {
            el.pause();
            cancelAnimationFrame(raf);
            reject(cancelled());
            return;
          }
          try {
            const now = performance.now();
            if (now - lastStep > 1000) lastMove = now; // back from a hidden tab — not a stall
            lastStep = now;
            if (el.currentTime !== lastT) {
              lastT = el.currentTime;
              lastMove = now;
            } else if (now - lastMove > STALL_MS) {
              el.pause();
              cancelAnimationFrame(raf);
              reject(new Error("Video playback stalled during export."));
              return;
            }
            const gt = clip.start + (el.currentTime - clip.in) / spd;
            renderFrame(ctx, project, el, gt, res);
            onProgress?.(clamp(gt / total, 0, 1));
            if (el.currentTime >= clip.out - 0.001 || el.ended) {
              el.pause();
              cancelAnimationFrame(raf);
              resolve();
              return;
            }
            raf = requestAnimationFrame(step);
          } catch (err) {
            el.pause();
            cancelAnimationFrame(raf);
            reject(err);
          }
        };
        raf = requestAnimationFrame(step);
      });
      cursor = clip.start + clipLen(clip);
    }
    recorder.stop();
    // Wait for the recorder to FULLY finalise before tearing down the audio
    // graph. Closing the AudioContext first ends the audio track mid-finalise,
    // which corrupts/errors the tail of the file (the "~96% then error").
    const blob = await done;
    if (audioCtx) await audioCtx.close().catch(() => {});
    return blob;
  } catch (e) {
    // Cancelled or errored — tear everything down and don't hand back a blob.
    els.forEach((el) => el.pause());
    if (recorder.state !== "inactive") recorder.stop();
    if (audioCtx) await audioCtx.close().catch(() => {});
    throw e;
  }
}

export function downloadBlob(blob: Blob, baseName: string): void {
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Generous: revoking too early can cut off a large download (Safari/Firefox).
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
