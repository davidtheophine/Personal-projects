import { useCallback, useEffect, useRef } from "react";
import { Upload } from "lucide-react";
import { aspectDims, type Project } from "@/state/project";
import { activeAt, clipLen, totalDuration } from "@/state/clips";
import { computeDeviceRect, renderFrame } from "@/render/render-frame";
import { deviceGeometry } from "@/render/device-frame";
import { clamp } from "@/render/geometry";

interface PreviewProps {
  project: Project;
  videoEls: Record<string, HTMLVideoElement>;
  bgImage: HTMLImageElement | null;
  playing: boolean;
  currentTime: number;
  tapPlacing: boolean;
  /** When set, the playhead is inside the selected zoom — dragging pans that zoom. */
  zoomPan: { x: number; y: number } | null;
  /** When set, the playhead is inside the selected rotate — dragging rotates the phone. */
  rotatePan: number | null;
  /** When a tap is selected, dragging the canvas moves it. */
  selectedTapPos: { x: number; y: number } | null;
  onTime: (t: number) => void;
  onImportVideo: (file: File) => void;
  onPlaceTap: (x: number, y: number) => void;
  onReposition: (x: number, y: number) => void;
  onRepositionZoom: (x: number, y: number) => void;
  onRotate: (angle: number) => void;
  onMoveTap: (x: number, y: number) => void;
}

export function Preview({
  project,
  videoEls,
  bgImage,
  playing,
  currentTime,
  tapPlacing,
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
    | { mode: "reposition" | "zoom"; sx: number; sy: number; ox: number; oy: number; w: number; h: number }
    | { mode: "rotate"; cx: number; cy: number; a0: number; p0: number }
    | { mode: "tap" }
    | null
  >(null);
  const { width: W, height: H } = aspectDims(project.aspect);
  const clips = project.clips;
  const hasClips = clips.length > 0;

  const timeRef = useRef(currentTime);
  timeRef.current = currentTime;

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

  // Redraw whenever the scene changes.
  useEffect(() => {
    draw();
  }, [draw]);

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

  // Paused / scrubbing: park each clip on the right source frame.
  useEffect(() => {
    if (playing || !hasClips) return;
    const info = activeAt(clips, currentTime);
    if (!info) {
      // In a gap between clips — pause everything, show a black screen.
      clips.forEach((c) => videoEls[c.id]?.pause());
      draw();
      return;
    }
    clips.forEach((c) => {
      if (c.id !== info.clip.id) videoEls[c.id]?.pause();
    });
    const el = videoEls[info.clip.id];
    if (el && Math.abs(el.currentTime - info.localTime) > 0.03) {
      el.currentTime = info.localTime; // 'seeked' redraws
    } else {
      draw();
    }
  }, [currentTime, playing, clips, videoEls, hasClips, draw]);

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
        if (el) {
          if (el.paused) {
            if (Math.abs(el.currentTime - info.localTime) > 0.05) el.currentTime = info.localTime;
            void el.play().catch(() => {});
            t += dt;
          } else if (el.currentTime >= info.clip.out - 0.03 || el.ended) {
            el.pause();
            t = info.clip.start + clipLen(info.clip) + 0.0005;
          } else {
            t = info.clip.start + clamp(el.currentTime - info.clip.in, 0, clipLen(info.clip));
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

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!tapPlacing || !hasClips) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const lx = ((e.clientX - rect.left) / rect.width) * W;
    const ly = ((e.clientY - rect.top) / rect.height) * H;
    const geo = deviceGeometry(computeDeviceRect(project, W, H));
    const sx = (lx - geo.screen.x) / geo.screen.w;
    const sy = (ly - geo.screen.y) / geo.screen.h;
    if (sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1) onPlaceTap(sx, sy);
  };

  const moveTapTo = (clientX: number, clientY: number, rect: DOMRect) => {
    const lx = ((clientX - rect.left) / rect.width) * W;
    const ly = ((clientY - rect.top) / rect.height) * H;
    const geo = deviceGeometry(computeDeviceRect(project, W, H));
    onMoveTap(
      clamp((lx - geo.screen.x) / geo.screen.w, 0, 1),
      clamp((ly - geo.screen.y) / geo.screen.h, 0, 1),
    );
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
      const dr = computeDeviceRect(project, W, H);
      const cx = rect.left + ((dr.x + dr.w / 2) / W) * rect.width;
      const cy = rect.top + ((dr.y + dr.h / 2) / H) * rect.height;
      dragRef.current = { mode: "rotate", cx, cy, a0: rotatePan, p0: Math.atan2(e.clientY - cy, e.clientX - cx) };
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
    };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === "tap") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) moveTapTo(e.clientX, e.clientY, rect);
    } else if (d.mode === "rotate") {
      const deg = ((Math.atan2(e.clientY - d.cy, e.clientX - d.cx) - d.p0) * 180) / Math.PI;
      onRotate(d.a0 + deg);
    } else {
      const nx = clamp(d.ox + (e.clientX - d.sx) / d.w, -0.5, 0.5);
      const ny = clamp(d.oy + (e.clientY - d.sy) / d.h, -0.5, 0.5);
      if (d.mode === "zoom") onRepositionZoom(nx, ny);
      else onReposition(nx, ny);
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  // Base-position marker for the selected tap (draggable via the canvas).
  let tapMarker: { left: string; top: string } | null = null;
  if (selectedTapPos) {
    const geo = deviceGeometry(computeDeviceRect(project, W, H)).screen;
    tapMarker = {
      left: `${((geo.x + selectedTapPos.x * geo.w) / W) * 100}%`,
      top: `${((geo.y + selectedTapPos.y * geo.h) / H) * 100}%`,
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
