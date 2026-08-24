import { useEffect, useRef } from "react";
import {
  Film,
  Pause,
  Play,
  Plus,
  Pointer,
  RotateCw,
  Scissors,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  type Project,
  type RotateEvent,
  type TapEvent,
  type ZoomEvent,
} from "@/state/project";
import { activeAt, clipLen, clipStart, MIN_CLIP, totalDuration } from "@/state/clips";
import { clamp } from "@/render/geometry";
import { Button } from "@/components/ui/button";

const RULER_H = 26;
const ZOOM_H = 46;
const ROTATE_H = 46;
const TAP_H = 46;
const VIDEO_H = 58;

const fmt = (s: number): string => {
  if (!Number.isFinite(s)) return "0:00.00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 100);
  return `${m}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
};

function tickStep(duration: number): number {
  if (duration <= 8) return 1;
  if (duration <= 20) return 2;
  if (duration <= 60) return 5;
  if (duration <= 180) return 15;
  return 30;
}

type Drag =
  | { kind: "playhead" }
  | { kind: "clipDrag"; id: string; startX: number; moved: boolean; pxPerSec: number; pos0: number }
  | { kind: "clipTrimL"; id: string; pxPerSec: number; in0: number; startX: number }
  | { kind: "clipTrimR"; id: string; pxPerSec: number; out0: number; startX: number }
  | { kind: "zoomMove"; id: string; grab: number }
  | { kind: "zoomResizeL"; id: string }
  | { kind: "zoomResizeR"; id: string }
  | { kind: "rotateMove"; id: string; grab: number }
  | { kind: "rotateResizeL"; id: string }
  | { kind: "rotateResizeR"; id: string }
  | { kind: "tapMove"; id: string };

interface TimelineProps {
  project: Project;
  thumbnails: Record<string, string[]>;
  currentTime: number;
  playing: boolean;
  muted: boolean;
  tapPlacing: boolean;
  selectedZoomId: string | null;
  selectedRotateId: string | null;
  selectedClipId: string | null;
  selectedTapId: string | null;
  onTogglePlay: () => void;
  onScrub: (t: number) => void;
  onSplit: () => void;
  onImportVideo: (file: File) => void;
  onTrimClip: (id: string, patch: { in?: number; out?: number; start?: number }) => void;
  onMoveClip: (id: string, start: number) => void;
  onSelectClip: (id: string | null) => void;
  onRemoveClip: (id: string) => void;
  onToggleMute: () => void;
  onAddZoom: () => void;
  onAddRotate: () => void;
  onAddTap: () => void;
  onSelectZoom: (id: string | null) => void;
  onSelectRotate: (id: string | null) => void;
  onSelectTap: (id: string | null) => void;
  onUpdateZoom: (id: string, patch: Partial<ZoomEvent>) => void;
  onUpdateRotate: (id: string, patch: Partial<RotateEvent>) => void;
  onUpdateTap: (id: string, patch: Partial<TapEvent>) => void;
  onRemoveTap: (id: string) => void;
}

export function Timeline(props: TimelineProps) {
  const {
    project,
    thumbnails,
    currentTime,
    playing,
    muted,
    tapPlacing,
    selectedZoomId,
    selectedRotateId,
    selectedClipId,
    selectedTapId,
    onTogglePlay,
    onScrub,
    onSplit,
    onImportVideo,
    onTrimClip,
    onMoveClip,
    onSelectClip,
    onRemoveClip,
    onToggleMute,
    onAddZoom,
    onAddRotate,
    onAddTap,
    onSelectZoom,
    onSelectRotate,
    onSelectTap,
    onUpdateZoom,
    onUpdateRotate,
    onUpdateTap,
    onRemoveTap,
  } = props;

  const clips = project.clips;
  const duration = totalDuration(clips);
  // The track width maps to `span`, which only re-fits on structural changes
  // (import / split / delete). It stays fixed while trimming, so a trimmed clip
  // shrinks and the removed footage leaves visible empty track — but a split
  // never inflates the span (both segments share one source).
  const lenRef = useRef(clips.length);
  const spanRef = useRef(duration);
  if (clips.length !== lenRef.current) {
    lenRef.current = clips.length;
    spanRef.current = duration;
  }
  // Grow to fit gaps created by dragging clips apart; the frozen base keeps
  // trims from re-fitting (so trimming still shows removed footage).
  const span = Math.max(duration, spanRef.current, 1);
  const splitInfo = activeAt(clips, currentTime);
  const canSplit =
    !!splitInfo &&
    splitInfo.localTime > splitInfo.clip.in + MIN_CLIP &&
    splitInfo.localTime < splitInfo.clip.out - MIN_CLIP;
  const areaRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const stateRef = useRef({ duration, span, clips, zooms: project.zooms, rotates: project.rotates });
  stateRef.current = { duration, span, clips, zooms: project.zooms, rotates: project.rotates };

  const pct = (t: number): number => (span > 0 ? (t / span) * 100 : 0);

  const timeAt = (clientX: number): number => {
    const el = areaRef.current;
    const { span: sp, duration: dur } = stateRef.current;
    if (!el || sp <= 0) return 0;
    const rect = el.getBoundingClientRect();
    return clamp((clamp((clientX - rect.left) / rect.width, 0, 1) * sp), 0, dur);
  };

  const pxPerSec = (): number => {
    const el = areaRef.current;
    const w = el ? el.getBoundingClientRect().width : 1;
    return span > 0 ? w / span : 1;
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const t = timeAt(e.clientX);
      const { zooms, rotates, duration: dur, clips: cl } = stateRef.current;
      if (drag.kind === "playhead") {
        onScrub(t);
      } else if (drag.kind === "clipDrag") {
        if (!drag.moved && Math.abs(e.clientX - drag.startX) < 5) return;
        drag.moved = true;
        const dsec = (e.clientX - drag.startX) / drag.pxPerSec;
        onMoveClip(drag.id, Math.max(0, drag.pos0 + dsec));
      } else if (drag.kind === "clipTrimL") {
        const c = cl.find((cc) => cc.id === drag.id);
        if (c) {
          const dsec = (e.clientX - drag.startX) / drag.pxPerSec;
          onTrimClip(drag.id, { in: clamp(drag.in0 + dsec, 0, c.out - MIN_CLIP) });
        }
      } else if (drag.kind === "clipTrimR") {
        const c = cl.find((cc) => cc.id === drag.id);
        if (c) {
          const dsec = (e.clientX - drag.startX) / drag.pxPerSec;
          onTrimClip(drag.id, { out: clamp(drag.out0 + dsec, c.in + MIN_CLIP, c.duration) });
        }
      } else if (drag.kind === "zoomMove") {
        const z = zooms.find((zz) => zz.id === drag.id);
        if (z) onUpdateZoom(drag.id, { start: clamp(t - drag.grab, 0, dur - z.duration) });
      } else if (drag.kind === "zoomResizeR") {
        const z = zooms.find((zz) => zz.id === drag.id);
        if (z) onUpdateZoom(drag.id, { duration: clamp(t - z.start, 0.4, dur - z.start) });
      } else if (drag.kind === "zoomResizeL") {
        const z = zooms.find((zz) => zz.id === drag.id);
        if (z) {
          const end = z.start + z.duration;
          const start = clamp(t, 0, end - 0.4);
          onUpdateZoom(drag.id, { start, duration: end - start });
        }
      } else if (drag.kind === "rotateMove") {
        const r = rotates.find((rr) => rr.id === drag.id);
        if (r) onUpdateRotate(drag.id, { start: clamp(t - drag.grab, 0, dur - r.duration) });
      } else if (drag.kind === "rotateResizeR") {
        const r = rotates.find((rr) => rr.id === drag.id);
        if (r) onUpdateRotate(drag.id, { duration: clamp(t - r.start, 0.4, dur - r.start) });
      } else if (drag.kind === "rotateResizeL") {
        const r = rotates.find((rr) => rr.id === drag.id);
        if (r) {
          const end = r.start + r.duration;
          const start = clamp(t, 0, end - 0.4);
          onUpdateRotate(drag.id, { start, duration: end - start });
        }
      } else if (drag.kind === "tapMove") {
        onUpdateTap(drag.id, { time: clamp(t, 0, dur) });
      }
    };
    const up = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onScrub, onTrimClip, onMoveClip, onUpdateZoom, onUpdateRotate, onUpdateTap]);

  const scrubDown = (e: React.PointerEvent) => {
    dragRef.current = { kind: "playhead" };
    onScrub(timeAt(e.clientX));
  };

  const ticks: number[] = [];
  if (duration > 0) {
    const step = tickStep(duration);
    for (let t = 0; t <= duration + 0.001; t += step) ticks.push(t);
  }

  return (
    <div className="shrink-0 border-t border-border/60 bg-card">
      {/* Transport */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Button variant="secondary" size="icon" onClick={onTogglePlay}>
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 translate-x-px" />
          )}
        </Button>
        <span className="min-w-[132px] text-xs tabular-nums text-muted-foreground">
          {fmt(currentTime)} <span className="opacity-50">/ {fmt(duration)}</span>
        </span>
        <Button
          variant="secondary"
          size="icon"
          onClick={onSplit}
          disabled={!canSplit}
          title="Split at playhead"
        >
          <Scissors className="h-4 w-4" />
        </Button>
        <span className="mr-1 h-5 w-px bg-border" />
        <Button size="sm" onClick={onAddZoom}>
          <Plus className="h-3.5 w-3.5" /> Add zoom
        </Button>
        <Button size="sm" variant="secondary" onClick={onAddRotate}>
          <RotateCw className="h-3.5 w-3.5" /> Add rotate
        </Button>
        <Button size="sm" variant={tapPlacing ? "default" : "secondary"} onClick={onAddTap}>
          <Pointer className="h-3.5 w-3.5" /> {tapPlacing ? "Click the screen…" : "Add tap"}
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => addRef.current?.click()}>
            <Film className="h-3.5 w-3.5" /> Add video
          </Button>
          <input
            ref={addRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportVideo(f);
              e.target.value = "";
            }}
          />
          <Button variant="ghost" size="icon" onClick={onToggleMute}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Tracks */}
      <div className="flex select-none pb-3">
        <div className="w-32 shrink-0 pl-4 pr-2 text-[13px] text-white/70">
          <div style={{ height: RULER_H }} />
          <div style={{ height: ZOOM_H }} className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" /> Zooms
          </div>
          <div style={{ height: ROTATE_H }} className="flex items-center gap-1.5">
            <RotateCw className="h-3.5 w-3.5 text-muted-foreground" /> Rotate
          </div>
          <div style={{ height: TAP_H }} className="flex items-center gap-1.5">
            <Pointer className="h-3.5 w-3.5 text-white/60" /> Taps
          </div>
          <div style={{ height: VIDEO_H }} className="flex items-center gap-1.5 truncate">
            📱 <span className="truncate">Video</span>
          </div>
        </div>

        <div ref={areaRef} className="relative flex-1 pr-4">
          {/* Ruler */}
          <div
            style={{ height: RULER_H }}
            onPointerDown={scrubDown}
            className="relative cursor-pointer border-b border-white/10"
          >
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 flex h-full flex-col justify-end"
                style={{ left: `${pct(t)}%` }}
              >
                <div className="h-1.5 w-px bg-white/20" />
                <span className="absolute -top-0.5 left-1 text-[10px] tabular-nums text-white/35">
                  {fmt(t).slice(0, -3)}
                </span>
              </div>
            ))}
          </div>

          {/* Zooms track */}
          <div
            style={{ height: ZOOM_H }}
            onPointerDown={(e) => {
              onSelectZoom(null);
              scrubDown(e);
            }}
            className="relative border-b border-white/5 bg-white/[0.02]"
          >
            {project.zooms.map((z) => {
              const selected = z.id === selectedZoomId;
              return (
                <div
                  key={z.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSelectZoom(z.id);
                    dragRef.current = { kind: "zoomMove", id: z.id, grab: timeAt(e.clientX) - z.start };
                  }}
                  className={`absolute top-1.5 bottom-1.5 flex cursor-grab items-center overflow-hidden rounded-md border px-3 text-[10px] backdrop-blur ${
                    selected
                      ? "border-primary bg-primary/20 text-foreground ring-1 ring-primary"
                      : "border-border bg-white/10 text-white/80 hover:bg-white/[0.14]"
                  }`}
                  style={{ left: `${pct(z.start)}%`, width: `${pct(z.duration)}%` }}
                >
                  <span className="pointer-events-none truncate">{z.scale.toFixed(1)}×</span>
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectZoom(z.id);
                      dragRef.current = { kind: "zoomResizeL", id: z.id };
                    }}
                    className="absolute left-0 top-0 flex h-full w-2.5 cursor-ew-resize items-center justify-center"
                  >
                    <div className="h-4 w-0.5 rounded bg-white/60" />
                  </div>
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectZoom(z.id);
                      dragRef.current = { kind: "zoomResizeR", id: z.id };
                    }}
                    className="absolute right-0 top-0 flex h-full w-2.5 cursor-ew-resize items-center justify-center"
                  >
                    <div className="h-4 w-0.5 rounded bg-white/60" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rotate track */}
          <div
            style={{ height: ROTATE_H }}
            onPointerDown={(e) => {
              onSelectRotate(null);
              scrubDown(e);
            }}
            className="relative border-b border-white/5 bg-white/[0.02]"
          >
            {project.rotates.map((r) => {
              const selected = r.id === selectedRotateId;
              return (
                <div
                  key={r.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSelectRotate(r.id);
                    dragRef.current = {
                      kind: "rotateMove",
                      id: r.id,
                      grab: timeAt(e.clientX) - r.start,
                    };
                  }}
                  className={`absolute top-1.5 bottom-1.5 flex cursor-grab items-center overflow-hidden rounded-md border px-3 text-[10px] backdrop-blur ${
                    selected
                      ? "border-primary bg-primary/20 text-foreground ring-1 ring-primary"
                      : "border-border bg-white/10 text-white/80 hover:bg-white/[0.14]"
                  }`}
                  style={{ left: `${pct(r.start)}%`, width: `${pct(r.duration)}%` }}
                >
                  <span className="pointer-events-none truncate">{Math.round(r.angle)}°</span>
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectRotate(r.id);
                      dragRef.current = { kind: "rotateResizeL", id: r.id };
                    }}
                    className="absolute left-0 top-0 flex h-full w-2.5 cursor-ew-resize items-center justify-center"
                  >
                    <div className="h-4 w-0.5 rounded bg-white/60" />
                  </div>
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectRotate(r.id);
                      dragRef.current = { kind: "rotateResizeR", id: r.id };
                    }}
                    className="absolute right-0 top-0 flex h-full w-2.5 cursor-ew-resize items-center justify-center"
                  >
                    <div className="h-4 w-0.5 rounded bg-white/60" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Taps track */}
          <div
            style={{ height: TAP_H }}
            onPointerDown={scrubDown}
            className="relative border-b border-white/5 bg-white/[0.02]"
          >
            {project.taps.map((tap) => (
              <div
                key={tap.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectTap(tap.id);
                  dragRef.current = { kind: "tapMove", id: tap.id };
                }}
                className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pct(tap.time)}%` }}
              >
                <div
                  className={`h-4 w-4 rotate-45 rounded-[3px] border shadow ${
                    tap.id === selectedTapId
                      ? "border-primary bg-primary ring-2 ring-primary/40"
                      : "border-white bg-neutral-200"
                  }`}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTap(tap.id);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute -right-2 -top-2 hidden rounded bg-black/50 p-0.5 group-hover:block"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Video track — one bar per clip, trim handles remove footage */}
          <div
            style={{ height: VIDEO_H }}
            onPointerDown={(e) => {
              onSelectClip(null);
              scrubDown(e);
            }}
            className="relative rounded-md bg-black/40"
          >
            {clips.map((clip, i) => {
              const start = clipStart(clips, i);
              const len = clipLen(clip);
              const selected = clip.id === selectedClipId;
              const thumbs = thumbnails[clip.id] ?? [];
              return (
                <div
                  key={clip.id}
                  data-clip={clip.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSelectClip(clip.id);
                    dragRef.current = {
                      kind: "clipDrag",
                      id: clip.id,
                      startX: e.clientX,
                      moved: false,
                      pxPerSec: pxPerSec(),
                      pos0: clip.start,
                    };
                  }}
                  className={`group absolute inset-y-0 cursor-grab overflow-hidden rounded-md border bg-black active:cursor-grabbing ${
                    selected ? "border-primary ring-1 ring-primary" : "border-white/15"
                  }`}
                  style={{ left: `${pct(start)}%`, width: `${pct(len)}%` }}
                >
                  <div
                    className="pointer-events-none absolute inset-y-0 flex"
                    style={{
                      left: `${-(clip.in / len) * 100}%`,
                      width: `${(clip.duration / len) * 100}%`,
                    }}
                  >
                    {thumbs.map((src, ti) => (
                      <div
                        key={ti}
                        className="h-full flex-1"
                        style={{
                          backgroundImage: `url(${src})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                    ))}
                  </div>
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectClip(clip.id);
                      dragRef.current = {
                        kind: "clipTrimL",
                        id: clip.id,
                        pxPerSec: pxPerSec(),
                        in0: clip.in,
                        startX: e.clientX,
                      };
                    }}
                    className="absolute inset-y-0 left-0 z-10 flex w-3 cursor-ew-resize items-center justify-center rounded-l bg-white/90"
                  >
                    <div className="h-4 w-0.5 rounded bg-black/40" />
                  </div>
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectClip(clip.id);
                      dragRef.current = {
                        kind: "clipTrimR",
                        id: clip.id,
                        pxPerSec: pxPerSec(),
                        out0: clip.out,
                        startX: e.clientX,
                      };
                    }}
                    className="absolute inset-y-0 right-0 z-10 flex w-3 cursor-ew-resize items-center justify-center rounded-r bg-white/90"
                  >
                    <div className="h-4 w-0.5 rounded bg-black/40" />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveClip(clip.id);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute right-4 top-1 z-20 hidden rounded bg-black/60 p-1 text-white/90 group-hover:block hover:bg-black/80"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Playhead */}
          <div
            className="pointer-events-none absolute z-20"
            style={{ left: `${pct(currentTime)}%`, top: RULER_H, bottom: 0 }}
          >
            <div className="h-full w-px bg-white" />
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                dragRef.current = { kind: "playhead" };
              }}
              className="pointer-events-auto absolute -top-2 -left-[7px] h-3.5 w-3.5 cursor-ew-resize rounded-full border-2 border-card bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
