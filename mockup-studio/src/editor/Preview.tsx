import { useCallback, useEffect, useRef } from "react";
import { Upload } from "lucide-react";
import { aspectDims, type Project } from "@/state/project";
import { activeAt, clipLen, totalDuration } from "@/state/clips";
import { displayLayout, renderFrame } from "@/render/render-frame";
import { sampleZoom } from "@/render/zoom";
import { clamp } from "@/render/geometry";

interface PreviewProps {
  project: Project;
  videoEls: Record<string, HTMLVideoElement>;
  bgImage: HTMLImageElement | null;
  playing: boolean;
  currentTime: number;
  tapPlacing: boolean;
  /** Flips true once the 3D model has loaded, so we redraw with it. */
  model3DReady: boolean;
  /** When set, the playhead is inside the selected zoom — dragging pans the focus. */
  zoomPan: { x: number; y: number; scale: number } | null;
  /** When set, the playhead is inside the selected rotate — dragging tilts the phone in 3D. */
  rotatePan: { x: number; y: number } | null;
  /** When a tap is selected, dragging the canvas moves it. */
  selectedTapPos: { x: number; y: number } | null;
  onTime: (t: number) => void;
  onImportVideo: (file: File) => void;
  onPlaceTap: (x: number, y: number) => void;
  onReposition: (x: number, y: number) => void;
  onRepositionZoom: (x: number, y: number) => void;
  onRotate: (rotateX: number, rotateY: number) => void;
  onMoveTap: (x: number, y: number) => void;
}

export function Preview({
  project,
  videoEls,
  bgImage,
  playing,
  currentTime,
  tapPlacing,
  model3DReady,
  zoomPan,
  rotatePan,
  selectedTapPos,
  onTime,
  onImportVideo,
  onPlaceTap,
  onReposition,
  onRepositionZoom,
  onRotate,
  onMoveTap,
}: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<
    | { mode: "reposition" | "zoom"; sx: number; sy: number; ox: number; oy: number; w: number; h: number; scale: number }
    | { mode: "rotate"; sx: number; sy: number; rx0: number; ry0: number; w: number; h: number }
    | { mode: "tap" }
    | null
  >(null);
  const { width: W, height: H } = aspectDims(project.aspect);
  const clips = project.clips;
  const hasClips = clips.length > 0;

  const timeRef = useRef(currentTime);
  timeRef.current = currentTime;
  // Scrubbing: coalesce seeks so only one is ever in flight (chasing the latest
  // target). Flooding the decoder with per-move seeks is what makes it flicker.
  const scrubTargetRef = useRef<{ el: HTMLVideoElement; time: number } | null>(null);
  const scrubSeekingRef = useRef(false);

  const elFor = useCallback(
    (t: number): HTMLVideoElement | null => {
      const info = activeAt(clips, t);
      return info ? (videoEls[info.clip.id] ?? null) : null;
    },
    [clips, videoEls],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const t = timeRef.current;
    renderFrame(ctx, project, elFor(t), t, { bg: { image: bgImage } });
  }, [project, elFor, bgImage]);

  // Seek the active clip toward the latest scrub target, one seek at a time.
  const chaseSeek = useCallback(() => {
    if (scrubSeekingRef.current) return; // a seek is in flight; it will chase on completion
    const target = scrubTargetRef.current;
    if (!target) return;
    const { el, time } = target;
    if (Math.abs(el.currentTime - time) < 0.02) {
      draw();
      return;
    }
    scrubSeekingRef.current = true;
    const onSeeked = () => {
      el.removeEventListener("seeked", onSeeked);
      scrubSeekingRef.current = false;
      draw();
      const next = scrubTargetRef.current;
      if (next && Math.abs(next.el.currentTime - next.time) > 0.02) chaseSeek();
    };
    el.addEventListener("seeked", onSeeked);
    el.currentTime = time;
  }, [draw]);

  // Redraw whenever the scene changes — or when the 3D model finishes loading.
  useEffect(() => {
    draw();
  }, [draw, model3DReady]);

  // Any clip element becoming ready (seeked / first frame) triggers a redraw.
  useEffect(() => {
    const els = Object.values(videoEls);
    const redraw = () => draw();
    els.forEach((el) => {
      el.addEventListener("seeked", redraw);
      el.addEventListener("loadeddata", redraw);
    });
    return () =>
      els.forEach((el) => {
        el.removeEventListener("seeked", redraw);
        el.removeEventListener("loadeddata", redraw);
      });
  }, [videoEls, draw]);

  // Paused / scrubbing: park the active clip on the right source frame via the
  // coalescing chase, so a fast drag stays smooth instead of flickering.
  useEffect(() => {
    if (playing || !hasClips) {
      scrubTargetRef.current = null;
      scrubSeekingRef.current = false;
      return;
    }
    const info = activeAt(clips, currentTime);
    if (!info) {
      // In a gap between clips — pause everything, show a black screen.
      scrubTargetRef.current = null;
      clips.forEach((c) => videoEls[c.id]?.pause());
      draw();
      return;
    }
    clips.forEach((c) => {
      if (c.id !== info.clip.id) videoEls[c.id]?.pause();
    });
    const el = videoEls[info.clip.id];
    if (!el) {
      draw();
      return;
    }
    scrubTargetRef.current = { el, time: info.localTime };
    chaseSeek();
  }, [currentTime, playing, clips, videoEls, hasClips, draw, chaseSeek]);

  // Playing: drive a global clock. Within a clip the element plays (and drives
  // the clock so A/V stay synced); across a gap the clock advances by wall time
  // with everything paused (black screen). Loops at the end.
  useEffect(() => {
    if (!playing || !hasClips) return;
    const total = totalDuration(clips);
    let raf = 0;
    let last = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      let t = timeRef.current;
      const info = activeAt(clips, t);
      if (info) {
        const el = videoEls[info.clip.id];
        clips.forEach((c) => {
          if (c.id !== info.clip.id) videoEls[c.id]?.pause();
        });
        const spd = info.clip.speed || 1;
        if (el) {
          if (el.paused) {
            if (Math.abs(el.currentTime - info.localTime) > 0.05) el.currentTime = info.localTime;
            el.playbackRate = spd;
            void el.play().catch(() => {});
            t += dt;
          } else if (el.currentTime >= info.clip.out - 0.03 || el.ended) {
            el.pause();
            t = info.clip.start + clipLen(info.clip) + 0.0005;
          } else {
            el.playbackRate = spd;
            t = info.clip.start + clamp((el.currentTime - info.clip.in) / spd, 0, clipLen(info.clip));
          }
        } else {
          t += dt;
        }
      } else {
        clips.forEach((c) => videoEls[c.id]?.pause());
        t += dt;
      }
      if (t >= total - 0.0001) {
        t = 0;
        last = performance.now();
        clips.forEach((c) => videoEls[c.id]?.pause());
      }
      timeRef.current = t;
      onTime(t);
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clips.forEach((c) => videoEls[c.id]?.pause());
    };
  }, [playing, clips, videoEls, draw, onTime, hasClips]);

  const pickFile = (f: File | undefined | null) => {
    if (f && f.type.startsWith("video/")) onImportVideo(f);
  };

  // The zoom transform applied to the phone at the current time: focal point on
  // the phone (fx,fy) is scaled by S around the phone centre (cx,cy). Tap
  // placement inverts this so clicking the *visible* (zoomed) phone lands where
  // you click; the tap marker applies it forward.
  const zoomXform = () => {
    const z = sampleZoom(project.zooms, currentTime);
    const { rect: dr, screen } = displayLayout(project, W, H);
    return {
      s: z.scale,
      cx: dr.x + dr.w / 2,
      cy: dr.y + dr.h / 2,
      fx: dr.x + dr.w * (0.5 + z.x),
      fy: dr.y + dr.h * (0.5 + z.y),
      screen,
    };
  };
  const clientToTap = (clientX: number, clientY: number, rect: DOMRect) => {
    const lx = ((clientX - rect.left) / rect.width) * W;
    const ly = ((clientY - rect.top) / rect.height) * H;
    const { s, cx, cy, fx, fy, screen } = zoomXform();
    const px = fx + (lx - cx) / s; // undo the zoom → device space
    const py = fy + (ly - cy) / s;
    return { sx: (px - screen.x) / screen.w, sy: (py - screen.y) / screen.h };
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!tapPlacing || !hasClips) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { sx, sy } = clientToTap(e.clientX, e.clientY, canvas.getBoundingClientRect());
    if (sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1) onPlaceTap(sx, sy);
  };

  const moveTapTo = (clientX: number, clientY: number, rect: DOMRect) => {
    const { sx, sy } = clientToTap(clientX, clientY, rect);
    onMoveTap(clamp(sx, 0, 1), clamp(sy, 0, 1));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tapPlacing || !hasClips) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.setPointerCapture(e.pointerId);

    // Selection is mutually exclusive, so at most one drag mode is active.
    if (selectedTapPos) {
      dragRef.current = { mode: "tap" };
      moveTapTo(e.clientX, e.clientY, rect);
      return;
    }
    if (rotatePan !== null) {
      dragRef.current = {
        mode: "rotate",
        sx: e.clientX,
        sy: e.clientY,
        rx0: rotatePan.x,
        ry0: rotatePan.y,
        w: rect.width,
        h: rect.height,
      };
      return;
    }
    const zoom = zoomPan !== null;
    dragRef.current = {
      mode: zoom ? "zoom" : "reposition",
      sx: e.clientX,
      sy: e.clientY,
      ox: zoom ? zoomPan.x : project.layout.x,
      oy: zoom ? zoomPan.y : project.layout.y,
      w: rect.width,
      h: rect.height,
      scale: zoom ? zoomPan.scale : 1,
    };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === "tap") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) moveTapTo(e.clientX, e.clientY, rect);
    } else if (d.mode === "rotate") {
      // Horizontal drag → turn around the vertical axis (rotateY); vertical drag
      // → tilt around the horizontal axis (rotateX). ~90° across the full canvas.
      const ry = clamp(d.ry0 + ((e.clientX - d.sx) / d.w) * 90, -60, 60);
      const rx = clamp(d.rx0 - ((e.clientY - d.sy) / d.h) * 90, -60, 60);
      onRotate(rx, ry);
    } else if (d.mode === "zoom") {
      // Pan the zoom focus so the phone tracks the cursor 1:1 (the focal offset
      // moves the phone by scale × its size, so divide it back out).
      const dr = displayLayout(project, W, H).rect;
      const nx = clamp(d.ox - ((e.clientX - d.sx) * W) / (d.w * d.scale * dr.w), -0.5, 0.5);
      const ny = clamp(d.oy - ((e.clientY - d.sy) * H) / (d.h * d.scale * dr.h), -0.5, 0.5);
      onRepositionZoom(nx, ny);
    } else {
      const nx = clamp(d.ox + (e.clientX - d.sx) / d.w, -0.5, 0.5);
      const ny = clamp(d.oy + (e.clientY - d.sy) / d.h, -0.5, 0.5);
      onReposition(nx, ny);
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  // Marker for the selected tap (draggable via the canvas), following the zoom.
  let tapMarker: { left: string; top: string } | null = null;
  if (selectedTapPos) {
    const { s, cx, cy, fx, fy, screen } = zoomXform();
    const px = screen.x + selectedTapPos.x * screen.w;
    const py = screen.y + selectedTapPos.y * screen.h;
    tapMarker = {
      left: `${((cx + s * (px - fx)) / W) * 100}%`,
      top: `${((cy + s * (py - fy)) / H) * 100}%`,
    };
  }

  const cursor = tapPlacing
    ? "cursor-crosshair"
    : hasClips
      ? "cursor-grab active:cursor-grabbing"
      : "";

  return (
    <div
      className="relative flex flex-1 items-center justify-center overflow-hidden p-8"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        pickFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div
        style={{ aspectRatio: `${W} / ${H}` }}
        className="relative max-h-full max-w-full overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-border"
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onClick={handleClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={`block h-full w-full touch-none ${cursor}`}
        />
        {tapMarker && (
          <div
            className="pointer-events-none absolute z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary/25"
            style={tapMarker}
          />
        )}
        {!hasClips && (
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground transition hover:text-foreground"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted ring-1 ring-border backdrop-blur">
              <Upload className="h-6 w-6" />
            </span>
            <span className="text-sm font-medium">Drop a screen recording</span>
            <span className="text-xs opacity-70">or click to choose · .mp4 / .mov</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
