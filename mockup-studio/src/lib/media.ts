import type { VideoMeta } from "@/state/project";

function detectAudio(el: HTMLVideoElement): boolean {
  const moz = Reflect.get(el, "mozHasAudio");
  if (typeof moz === "boolean") return moz;
  const tracks = Reflect.get(el, "audioTracks");
  if (tracks && typeof tracks.length === "number") return tracks.length > 0;
  const bytes = Reflect.get(el, "webkitAudioDecodedByteCount");
  if (typeof bytes === "number") return bytes > 0;
  return true; // unknown — assume there is audio
}

export async function loadVideoFile(
  file: File,
): Promise<{ meta: VideoMeta; el: HTMLVideoElement }> {
  const url = URL.createObjectURL(file);
  const el = document.createElement("video");
  el.src = url;
  el.playsInline = true;
  el.preload = "auto";
  el.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    el.onloadedmetadata = () => resolve();
    el.onerror = () => reject(new Error("Could not load this video file."));
  });

  const meta: VideoMeta = {
    url,
    width: el.videoWidth,
    height: el.videoHeight,
    duration: el.duration,
    hasAudio: detectAudio(el),
    name: file.name,
  };
  return { meta, el };
}

/** Build a ready video element from an existing object URL (e.g. a split segment). */
export async function loadVideoUrl(url: string, muted: boolean): Promise<HTMLVideoElement> {
  const el = document.createElement("video");
  el.src = url;
  el.playsInline = true;
  el.preload = "auto";
  el.crossOrigin = "anonymous";
  el.muted = muted;
  await new Promise<void>((resolve, reject) => {
    if (el.readyState >= 1) return resolve();
    el.onloadedmetadata = () => resolve();
    el.onerror = () => reject(new Error("Could not load clip segment."));
  });
  return el;
}

export function loadImageFile(
  file: File,
): Promise<{ img: HTMLImageElement; url: string; name: string }> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  return new Promise((resolve, reject) => {
    img.onload = () => resolve({ img, url, name: file.name });
    img.onerror = () => reject(new Error("Could not load this image file."));
  });
}

/** Seek a video and resolve once the frame at `t` is ready. */
export function seekVideo(el: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      el.removeEventListener("seeked", onSeeked);
      resolve();
    };
    el.addEventListener("seeked", onSeeked);
    el.currentTime = t;
  });
}

/**
 * Extract `count` evenly-spaced thumbnail data URLs for the timeline filmstrip.
 * Seeks the element, so restore its currentTime afterwards.
 */
export async function extractThumbnails(
  el: HTMLVideoElement,
  count: number,
  width = 96,
): Promise<string[]> {
  const dur = el.duration;
  const out: string[] = [];
  if (!Number.isFinite(dur) || dur <= 0 || el.videoWidth === 0) return out;
  const height = Math.round(width * (el.videoHeight / el.videoWidth));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return out;
  for (let i = 0; i < count; i++) {
    const t = (dur * (i + 0.5)) / count;
    await seekVideo(el, t);
    ctx.drawImage(el, 0, 0, width, height);
    out.push(canvas.toDataURL("image/jpeg", 0.6));
  }
  return out;
}
