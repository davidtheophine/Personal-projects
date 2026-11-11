import type { InputAudioTrack, InputVideoTrack, WrappedAudioBuffer, WrappedCanvas } from "mediabunny";
import type { Project, VideoClip } from "@/state/project";
import { aspectDims } from "@/state/project";
import { renderBackgroundLayer, renderFrame } from "@/render/render-frame";
import type { FrameSource } from "@/render/frame-source";
import { planFrames } from "./frame-plan";
import { audioSchedule, type AudioPiece } from "./audio-plan";
import { timeStretch } from "./time-stretch";
import { pickOutput } from "./pick-output";

// ---- Export settings (one place) ----
export const EXPORT_FPS = 30;
const VIDEO_BITRATE = 12_000_000;
const AUDIO_BITRATE = 160_000;
const AUDIO_RATE = 48_000;
/** No progress for this long while decoding/encoding = stalled → give up (caller falls back). */
const STALL_MS = 20_000;
/** Muxing a long export into its final file can take a while; allow more. */
const FINALIZE_STALL_MS = 120_000;
/** Hand the main thread back (UI + progress) at least this often. */
const YIELD_EVERY_MS = 30;

/** This browser/file can't take the fast path — the caller should use the real-time exporter. */
export class FastExportUnsupported extends Error {
  override name = "FastExportUnsupported";
}
/** Decoding/encoding stopped making progress. */
export class ExportStalled extends Error {
  override name = "ExportStalled";
}

export function fastExportAvailable(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof VideoDecoder !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof OfflineAudioContext !== "undefined"
  );
}

const abortError = () => new DOMException("Export cancelled", "AbortError");

/** Yield to the event loop without timers (MessageChannel isn't throttled in background tabs). */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      resolve();
    };
    ch.port2.postMessage(null);
  });
}

interface Stats {
  frames: number;
  decodeMs: number;
  renderMs: number;
  encodeMs: number;
  audioMs: number;
  finalizeMs: number;
  totalMs: number;
  container: string;
  videoCodec: string;
  audioCodec: string | null;
}

/**
 * Offline, frame-exact export: decode each clip with WebCodecs (via Mediabunny),
 * draw every output frame at exactly t = i / EXPORT_FPS with the shared
 * `renderFrame`, and encode it — as fast as the machine allows rather than in
 * real time, with no dependence on requestAnimationFrame (so it keeps going in
 * a background tab) and no frame dropped or repeated by construction.
 *
 * Throws FastExportUnsupported when the browser or a clip's codec can't be
 * handled, ExportStalled if decoding/encoding stops progressing, or an
 * AbortError DOMException when `signal` aborts.
 */
export async function fastExport(
  project: Project,
  bgImage: HTMLImageElement | null,
  muted: boolean,
  onProgress?: (p: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  if (!fastExportAvailable()) throw new FastExportUnsupported("WebCodecs is not available in this browser.");
  const mb = await import("./mediabunny");
  const clips = project.clips;
  const plan = planFrames(clips, EXPORT_FPS);
  if (plan.count === 0) throw new Error("Add a video before exporting.");
  const { width: W, height: H } = aspectDims(project.aspect);
  const t0 = performance.now();
  const stats: Stats = {
    frames: plan.count, decodeMs: 0, renderMs: 0, encodeMs: 0, audioMs: 0, finalizeMs: 0, totalMs: 0,
    container: "", videoCodec: "", audioCodec: null,
  };

  // Every await below races a stall watchdog and the abort signal, so nothing can hang forever.
  let lastProgressAt = performance.now();
  let stallLimit = STALL_MS;
  let failStall: (e: Error) => void = () => {};
  const stalled = new Promise<never>((_, reject) => (failStall = reject));
  stalled.catch(() => {});
  const watchdog = setInterval(() => {
    if (performance.now() - lastProgressAt > stallLimit) {
      failStall(new ExportStalled(`Export stopped making progress for ${Math.round(stallLimit / 1000)} s.`));
    }
  }, 1000);
  let failAbort: (e: Error) => void = () => {};
  const aborted = new Promise<never>((_, reject) => (failAbort = reject));
  aborted.catch(() => {});
  const onAbort = () => failAbort(abortError());
  if (signal?.aborted) onAbort();
  signal?.addEventListener("abort", onAbort, { once: true });
  const guard = <T>(p: Promise<T>): Promise<T> => Promise.race([p, stalled, aborted]);
  const tick = () => (lastProgressAt = performance.now());

  const inputs = new Map<string, InstanceType<typeof mb.Input>>();
  const iterators = new Map<number, AsyncGenerator<WrappedCanvas | null, void, unknown>>();
  let output: InstanceType<typeof mb.Output> | null = null;
  try {
    onProgress?.(0);
    // ---- Open every distinct source once (split segments share their media). ----
    const videoTracks = new Map<string, InputVideoTrack>();
    const audioTracks = new Map<string, InputAudioTrack>();
    const firstTs = new Map<string, number>();
    for (const clip of clips) {
      if (inputs.has(clip.url)) continue;
      const blob = await guard(fetch(clip.url).then((r) => r.blob()));
      const input = new mb.Input({ source: new mb.BlobSource(blob), formats: mb.INPUT_FORMATS });
      inputs.set(clip.url, input);
      const vt = await guard(input.getPrimaryVideoTrack());
      if (!vt || !(await guard(vt.canDecode()))) {
        throw new FastExportUnsupported(`This browser can't decode ${clip.name} (${vt?.codec ?? "unknown codec"}).`);
      }
      videoTracks.set(clip.url, vt);
      firstTs.set(clip.url, await guard(vt.getFirstTimestamp()));
      if (!muted) {
        const at = await guard(input.getPrimaryAudioTrack());
        if (at) {
          if (!(await guard(at.canDecode()))) {
            throw new FastExportUnsupported(`This browser can't decode the audio in ${clip.name} (${at.codec}).`);
          }
          audioTracks.set(clip.url, at);
        }
      }
      tick();
    }
    const pieces = muted ? [] : audioSchedule(clips).filter((p) => audioTracks.has(clips[p.clipIndex].url));
    const withAudio = pieces.length > 0;

    // ---- Pick a container + codecs: MP4 (H.264/AAC) where possible, else WebM (VP9/Opus). ----
    const vQuality = new mb.Quality({ bitrate: VIDEO_BITRATE });
    const aQuality = new mb.Quality({ bitrate: AUDIO_BITRATE });
    const videoOpts = { width: W, height: H, quality: vQuality, frameRate: EXPORT_FPS };
    const audioOpts = { numberOfChannels: 2, sampleRate: AUDIO_RATE, quality: aQuality };
    const choice = await guard(
      pickOutput(
        {
          canEncodeVideo: (codec) => mb.canEncodeVideo(codec, videoOpts),
          canEncodeAudio: (codec) => mb.canEncodeAudio(codec, audioOpts),
        },
        withAudio,
      ),
    );
    if (!choice) throw new FastExportUnsupported("No usable video/audio encoder in this browser.");
    const { videoCodec, audioCodec } = choice;
    const format =
      choice.container === "mp4" ? new mb.Mp4OutputFormat({ fastStart: "in-memory" }) : new mb.WebMOutputFormat();
    stats.container = format.mimeType;
    stats.videoCodec = videoCodec;
    stats.audioCodec = audioCodec;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new FastExportUnsupported("Canvas 2D is unavailable.");
    const out = new mb.Output({ format, target: new mb.BufferTarget() });
    output = out;
    const videoSource = new mb.CanvasSource(canvas, {
      codec: videoCodec,
      quality: vQuality,
      keyFrameInterval: 2,
      latencyMode: "quality",
    });
    out.addVideoTrack(videoSource, { frameRate: EXPORT_FPS });
    const audioSource = audioCodec ? new mb.AudioBufferSource({ codec: audioCodec, quality: aQuality }) : null;
    if (audioSource) out.addAudioTrack(audioSource);
    await guard(out.start());
    onProgress?.(0.01);

    // ---- Audio: decode only the kept regions, stretch sped clips, mix offline. ----
    if (audioSource) {
      const ta = performance.now();
      const mixed = await mixAudio(mb, clips, pieces, audioTracks, plan.count / EXPORT_FPS, guard, tick, signal);
      await guard(audioSource.add(mixed));
      audioSource.close();
      stats.audioMs = performance.now() - ta;
      tick();
    }
    onProgress?.(0.03);

    // ---- Video: every output frame, in order. ----
    const bgLayer = renderBackgroundLayer(project, { image: bgImage });
    const remaining = new Map<number, number>();
    for (const [ci, list] of plan.timestampsByClip) remaining.set(ci, list.length);
    const iteratorFor = (ci: number) => {
      let it = iterators.get(ci);
      if (!it) {
        const url = clips[ci].url;
        const sink = new mb.CanvasSink(videoTracks.get(url)!, { poolSize: 2 });
        const ft = firstTs.get(url) ?? 0;
        // Never ask for a time before the first frame (that would yield null → a black frame).
        it = sink.canvasesAtTimestamps(plan.timestampsByClip.get(ci)!.map((t) => Math.max(t, ft)));
        iterators.set(ci, it);
      }
      return it;
    };
    let lastYield = performance.now();
    for (let i = 0; i < plan.count; i++) {
      if (signal?.aborted) throw abortError();
      const f = plan.frames[i];
      let src: FrameSource | null = null;
      let finishedClip: number | null = null;
      if (f) {
        const td = performance.now();
        const r = await guard(iteratorFor(f.clipIndex).next());
        stats.decodeMs += performance.now() - td;
        if (!r.done && r.value) src = r.value.canvas;
        const left = (remaining.get(f.clipIndex) ?? 1) - 1;
        remaining.set(f.clipIndex, left);
        if (left === 0) finishedClip = f.clipIndex;
      }
      const tr = performance.now();
      renderFrame(ctx, project, src, i / EXPORT_FPS, { bg: { image: bgImage }, bgLayer });
      stats.renderMs += performance.now() - tr;
      const te = performance.now();
      await guard(videoSource.add(i / EXPORT_FPS, 1 / EXPORT_FPS));
      stats.encodeMs += performance.now() - te;
      if (finishedClip !== null) {
        // Free this clip's decoder as soon as its last frame is used.
        void iterators.get(finishedClip)?.return(undefined).catch(() => {});
        iterators.delete(finishedClip);
      }
      tick();
      if (performance.now() - lastYield > YIELD_EVERY_MS) {
        onProgress?.(0.03 + (0.95 * (i + 1)) / plan.count);
        await yieldToMain();
        lastYield = performance.now();
      }
    }
    videoSource.close();
    onProgress?.(0.98);

    // ---- Finalise into one file. ----
    stallLimit = FINALIZE_STALL_MS;
    tick();
    const tf = performance.now();
    await guard(out.finalize());
    stats.finalizeMs = performance.now() - tf;
    const buffer = out.target.buffer;
    if (!buffer) throw new Error("The exporter produced no data.");
    onProgress?.(1);
    stats.totalMs = performance.now() - t0;
    console.info("[export] fast path", JSON.stringify(roundStats(stats)));
    return new Blob([buffer], { type: format.mimeType });
  } catch (e) {
    if (output && output.state !== "finalized" && output.state !== "canceled") await output.cancel().catch(() => {});
    throw e;
  } finally {
    clearInterval(watchdog);
    signal?.removeEventListener("abort", onAbort);
    for (const it of iterators.values()) void it.return(undefined).catch(() => {});
    iterators.clear();
    for (const input of inputs.values()) input.dispose();
  }
}

function roundStats(s: Stats): Stats {
  const r = (x: number) => Math.round(x);
  return { ...s, decodeMs: r(s.decodeMs), renderMs: r(s.renderMs), encodeMs: r(s.encodeMs), audioMs: r(s.audioMs), finalizeMs: r(s.finalizeMs), totalMs: r(s.totalMs) };
}

/**
 * Decode each audible piece of each clip (only the kept region), time-stretch
 * it if the clip is sped up/slowed (pitch preserved), and mix everything onto
 * a 48 kHz stereo timeline exactly `seconds` long (= the video's length).
 */
async function mixAudio(
  mb: typeof import("./mediabunny"),
  clips: VideoClip[],
  pieces: AudioPiece[],
  tracks: Map<string, InputAudioTrack>,
  seconds: number,
  guard: <T>(p: Promise<T>) => Promise<T>,
  tick: () => void,
  signal?: AbortSignal,
): Promise<AudioBuffer> {
  const mix = new OfflineAudioContext({
    numberOfChannels: 2,
    length: Math.max(1, Math.ceil(seconds * AUDIO_RATE)),
    sampleRate: AUDIO_RATE,
  });
  for (const piece of pieces) {
    const track = tracks.get(clips[piece.clipIndex].url);
    if (!track) continue;
    const sink = new mb.AudioBufferSink(track);
    const chunks: WrappedAudioBuffer[] = [];
    const it = sink.buffers(piece.srcOffset, piece.srcOffset + piece.srcDuration);
    try {
      for (;;) {
        if (signal?.aborted) throw abortError();
        const r = await guard(it.next());
        if (r.done) break;
        chunks.push(r.value);
        tick();
      }
    } finally {
      void it.return(undefined).catch(() => {});
    }
    if (chunks.length === 0) continue;
    const sr = chunks[0].buffer.sampleRate;
    const first = chunks[0].timestamp;
    const last = chunks[chunks.length - 1];
    const span = Math.max(1, Math.round((last.timestamp + last.duration - first) * sr));
    // Lay the decoded chunks out on one contiguous stereo strip (mono → both sides).
    const strip = [new Float32Array(span), new Float32Array(span)];
    for (const wb of chunks) {
      const at = Math.round((wb.timestamp - first) * sr);
      if (at >= span) continue;
      for (let c = 0; c < 2; c++) {
        const data = wb.buffer.getChannelData(Math.min(c, wb.buffer.numberOfChannels - 1));
        strip[c].set(data.subarray(0, Math.min(data.length, span - Math.max(0, at))), Math.max(0, at));
      }
    }
    // Trim to exactly the piece's source range, then stretch if needed.
    const s0 = Math.min(span, Math.max(0, Math.round((piece.srcOffset - first) * sr)));
    const s1 = Math.min(span, s0 + Math.round(piece.srcDuration * sr));
    let seg: Float32Array[] = strip.map((ch) => ch.slice(s0, s1));
    if (Math.abs(piece.speed - 1) > 1e-6) seg = timeStretch(seg, piece.speed, sr);
    if (seg[0].length === 0) continue;
    const buf = new AudioBuffer({ length: seg[0].length, numberOfChannels: 2, sampleRate: sr });
    for (let c = 0; c < 2; c++) buf.getChannelData(c).set(seg[c]);
    const node = mix.createBufferSource();
    node.buffer = buf;
    node.connect(mix.destination);
    node.start(piece.when);
  }
  return guard(mix.startRendering());
}
