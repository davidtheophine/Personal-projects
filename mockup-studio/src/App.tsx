import { useCallback, useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_ROTATE,
  DEFAULT_TAP,
  DEFAULT_ZOOM,
  defaultProject,
  type AspectId,
  type BackgroundState,
  type DeviceState,
  type ImageBackground,
  type LayoutState,
  type Project,
  type RotateEvent,
  type ShadowState,
  type TapEvent,
  type VideoClip,
  type ZoomEvent,
} from "@/state/project";
import { activeAt, MIN_CLIP, totalDuration } from "@/state/clips";
import { clamp } from "@/render/geometry";
import { makeId } from "@/lib/id";
import { extractThumbnails, loadImageFile, loadVideoFile, loadVideoUrl } from "@/lib/media";
import { downloadBlob, exportVideo } from "@/export/export-webm";
import { Preview } from "@/editor/Preview";
import { Timeline } from "@/editor/Timeline";
import { CanvasPanel } from "@/editor/panels/CanvasPanel";
import { BackgroundPanel } from "@/editor/panels/BackgroundPanel";
import { DevicePanel } from "@/editor/panels/DevicePanel";
import { TuningPanel } from "@/editor/panels/TuningPanel";
import { ZoomInspector } from "@/editor/panels/ZoomInspector";
import { RotateInspector } from "@/editor/panels/RotateInspector";
import { TapInspector } from "@/editor/panels/TapInspector";

export function App() {
  const [project, setProject] = useState<Project>(defaultProject);
  const [videoEls, setVideoEls] = useState<Record<string, HTMLVideoElement>>({});
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string[]>>({});
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [tapPlacing, setTapPlacing] = useState(false);
  const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
  const [selectedRotateId, setSelectedRotateId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTapId, setSelectedTapId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);

  // Refs mirror state so callbacks can read the latest without re-subscribing.
  const clipsRef = useRef(project.clips);
  clipsRef.current = project.clips;
  const videoElsRef = useRef(videoEls);
  videoElsRef.current = videoEls;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // Undo history (project snapshots, coalesced so a slider drag = one step).
  const undoRef = useRef<Project[]>([]);
  const prevProjectRef = useRef(project);
  const lastPushRef = useRef(0);
  useEffect(() => {
    if (project === prevProjectRef.current) return;
    const now = Date.now();
    if (now - lastPushRef.current > 500) {
      undoRef.current.push(prevProjectRef.current);
      if (undoRef.current.length > 80) undoRef.current.shift();
      lastPushRef.current = now;
    }
    prevProjectRef.current = project;
  }, [project]);

  const undo = useCallback(() => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    prevProjectRef.current = prev; // so the history effect doesn't re-push
    setProject(prev);
    setSelectedZoomId(null);
    setSelectedRotateId(null);
    setSelectedClipId(null);
    setSelectedTapId(null);
    setTapPlacing(false);
  }, []);

  const setBackground = (patch: Partial<BackgroundState>) =>
    setProject((p) => ({ ...p, background: { ...p.background, ...patch } }));
  const setImage = (patch: Partial<ImageBackground>) =>
    setProject((p) => ({
      ...p,
      background: { ...p.background, image: { ...p.background.image, ...patch } },
    }));
  const setDevice = (patch: Partial<DeviceState>) =>
    setProject((p) => ({ ...p, device: { ...p.device, ...patch } }));
  const setLayout = (patch: Partial<LayoutState>) =>
    setProject((p) => ({ ...p, layout: { ...p.layout, ...patch } }));
  const setShadow = (patch: Partial<ShadowState>) =>
    setProject((p) => ({
      ...p,
      layout: { ...p.layout, shadow: { ...p.layout.shadow, ...patch } },
    }));
  const setAspect = (aspect: AspectId) => setProject((p) => ({ ...p, aspect }));

  // Import appends a clip to the end of the video track (keeps existing effects).
  const importVideo = useCallback(async (file: File) => {
    const { meta, el } = await loadVideoFile(file);
    el.muted = mutedRef.current;
    const id = makeId();
    const clip: VideoClip = {
      id,
      url: meta.url,
      name: meta.name,
      width: meta.width,
      height: meta.height,
      duration: meta.duration,
      hasAudio: meta.hasAudio,
      in: 0,
      out: meta.duration,
      start: totalDuration(clipsRef.current),
    };
    setPlaying(false);
    setTapPlacing(false);
    setVideoEls((m) => ({ ...m, [id]: el }));
    setProject((p) => ({ ...p, clips: [...p.clips, clip] }));
    const thumbs = await extractThumbnails(el, 16);
    el.currentTime = 0;
    setThumbnails((t) => ({ ...t, [id]: thumbs }));
  }, []);

  const importBgImage = useCallback(async (file: File) => {
    const { img, url, name } = await loadImageFile(file);
    setBgImage(img);
    setProject((p) => ({
      ...p,
      background: {
        ...p.background,
        type: "image",
        image: { ...p.background.image, src: url, name },
      },
    }));
  }, []);

  const doExport = async () => {
    if (project.clips.length === 0 || exporting) return;
    setPlaying(false);
    setExporting(true);
    setExportPct(0);
    try {
      const blob = await exportVideo(project, bgImage, muted, (p) => setExportPct(p));
      const base = (project.clips[0]?.name ?? "mockup").replace(/\.[^.]+$/, "");
      downloadBlob(blob, `${base}-mockup`);
    } finally {
      setExporting(false);
      setExportPct(0);
    }
  };

  const togglePlay = useCallback(() => {
    if (clipsRef.current.length === 0) return;
    if (playing) {
      setPlaying(false);
    } else {
      if (currentTime >= totalDuration(clipsRef.current) - 0.001) setCurrentTime(0);
      setPlaying(true);
    }
  }, [playing, currentTime]);

  const onScrub = useCallback((t: number) => {
    setCurrentTime(clamp(t, 0, totalDuration(clipsRef.current)));
  }, []);
  const onTime = useCallback((t: number) => setCurrentTime(t), []);

  // Keep the playhead within the (possibly shrunken) output after a trim.
  useEffect(() => {
    const total = totalDuration(project.clips);
    if (currentTime > total) setCurrentTime(total);
  }, [project.clips, currentTime]);

  const trimClip = useCallback(
    (id: string, patch: { in?: number; out?: number }) =>
      setProject((p) => ({
        ...p,
        clips: p.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      })),
    [],
  );

  // Split the clip under the playhead into two segments at the current time.
  const splitAtPlayhead = async () => {
    const info = activeAt(project.clips, currentTime);
    if (!info) return;
    const { clip, localTime } = info;
    if (localTime <= clip.in + MIN_CLIP || localTime >= clip.out - MIN_CLIP) return;
    const newId = makeId();
    const el = await loadVideoUrl(clip.url, mutedRef.current);
    setVideoEls((m) => ({ ...m, [newId]: el }));
    setThumbnails((t) => ({ ...t, [newId]: t[clip.id] ?? [] }));
    setProject((p) => {
      const idx = p.clips.findIndex((c) => c.id === clip.id);
      if (idx < 0) return p;
      const cur = p.clips[idx];
      if (localTime <= cur.in + MIN_CLIP || localTime >= cur.out - MIN_CLIP) return p;
      const a = { ...cur, out: localTime };
      const b = { ...cur, id: newId, in: localTime, start: cur.start + (localTime - cur.in) };
      const next = [...p.clips];
      next.splice(idx, 1, a, b);
      return { ...p, clips: next };
    });
    setSelectedClipId(newId);
  };

  const moveClip = useCallback((id: string, start: number) => {
    setProject((p) => ({
      ...p,
      clips: p.clips.map((c) => (c.id === id ? { ...c, start: Math.max(0, start) } : c)),
    }));
  }, []);

  const removeClip = useCallback((id: string) => {
    // Keep the element, thumbnails and object URL alive: split segments share a
    // source URL (revoking it would break the sibling), and undo needs them.
    videoElsRef.current[id]?.pause();
    setProject((p) => ({ ...p, clips: p.clips.filter((c) => c.id !== id) }));
    setSelectedClipId((cur) => (cur === id ? null : cur));
  }, []);

  const updateZoom = useCallback(
    (id: string, patch: Partial<ZoomEvent>) =>
      setProject((p) => ({
        ...p,
        zooms: p.zooms.map((z) => (z.id === id ? { ...z, ...patch } : z)),
      })),
    [],
  );
  const updateTap = useCallback(
    (id: string, patch: Partial<Project["taps"][number]>) =>
      setProject((p) => ({
        ...p,
        taps: p.taps.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })),
    [],
  );
  const removeTap = (id: string) =>
    setProject((p) => ({ ...p, taps: p.taps.filter((t) => t.id !== id) }));

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    Object.values(videoElsRef.current).forEach((el) => (el.muted = next));
  };

  const clearSelection = () => {
    setSelectedZoomId(null);
    setSelectedRotateId(null);
    setSelectedClipId(null);
    setSelectedTapId(null);
  };

  const addZoom = () => {
    const id = makeId();
    setProject((p) => {
      const dur = totalDuration(p.clips);
      const start = clamp(currentTime, 0, Math.max(0, dur - 0.5));
      const duration = Math.min(DEFAULT_ZOOM.duration, Math.max(0.5, dur - start));
      const zoom: ZoomEvent = {
        id,
        start,
        duration,
        scale: DEFAULT_ZOOM.scale,
        x: 0,
        y: 0,
        ease: DEFAULT_ZOOM.ease,
      };
      return { ...p, zooms: [...p.zooms, zoom] };
    });
    clearSelection();
    setSelectedZoomId(id);
  };

  const selectZoom = (id: string | null) => {
    setSelectedZoomId(id);
    if (id) {
      setSelectedRotateId(null);
      setSelectedClipId(null);
      setSelectedTapId(null);
    }
  };
  const updateSelectedZoom = (patch: Partial<ZoomEvent>) => {
    if (selectedZoomId) updateZoom(selectedZoomId, patch);
  };
  const removeSelectedZoom = () => {
    if (!selectedZoomId) return;
    setProject((p) => ({ ...p, zooms: p.zooms.filter((z) => z.id !== selectedZoomId) }));
    setSelectedZoomId(null);
  };
  const closeInspector = () => setSelectedZoomId(null);

  const updateRotate = useCallback(
    (id: string, patch: Partial<RotateEvent>) =>
      setProject((p) => ({
        ...p,
        rotates: p.rotates.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      })),
    [],
  );
  const addRotate = () => {
    const id = makeId();
    setProject((p) => {
      const dur = totalDuration(p.clips);
      const start = clamp(currentTime, 0, Math.max(0, dur - 0.5));
      const duration = Math.min(DEFAULT_ROTATE.duration, Math.max(0.5, dur - start));
      const rotate: RotateEvent = {
        id,
        start,
        duration,
        angle: DEFAULT_ROTATE.angle,
        ease: DEFAULT_ROTATE.ease,
      };
      return { ...p, rotates: [...p.rotates, rotate] };
    });
    clearSelection();
    setSelectedRotateId(id);
  };
  const selectRotate = (id: string | null) => {
    setSelectedRotateId(id);
    if (id) {
      setSelectedZoomId(null);
      setSelectedClipId(null);
      setSelectedTapId(null);
    }
  };
  const updateSelectedRotate = (patch: Partial<RotateEvent>) => {
    if (selectedRotateId) updateRotate(selectedRotateId, patch);
  };
  const removeSelectedRotate = () => {
    if (!selectedRotateId) return;
    setProject((p) => ({ ...p, rotates: p.rotates.filter((r) => r.id !== selectedRotateId) }));
    setSelectedRotateId(null);
  };
  const closeRotateInspector = () => setSelectedRotateId(null);

  const selectClip = (id: string | null) => {
    setSelectedClipId(id);
    if (id) {
      setSelectedZoomId(null);
      setSelectedRotateId(null);
      setSelectedTapId(null);
    }
  };

  const selectTap = (id: string | null) => {
    setSelectedTapId(id);
    if (id) {
      setSelectedZoomId(null);
      setSelectedRotateId(null);
      setSelectedClipId(null);
    }
  };
  const updateSelectedTap = (patch: Partial<TapEvent>) => {
    if (selectedTapId) updateTap(selectedTapId, patch);
  };
  const removeSelectedTap = () => {
    if (!selectedTapId) return;
    setProject((p) => ({ ...p, taps: p.taps.filter((t) => t.id !== selectedTapId) }));
    setSelectedTapId(null);
  };

  const addTap = () => setTapPlacing((v) => !v);
  const placeTap = (x: number, y: number) => {
    const id = makeId();
    setProject((p) => ({
      ...p,
      taps: [...p.taps, { id, time: currentTime, x, y, duration: DEFAULT_TAP.duration, size: DEFAULT_TAP.size }],
    }));
    setTapPlacing(false);
    selectTap(id);
  };
  const reposition = (x: number, y: number) => setLayout({ x, y });
  const onRepositionZoom = (x: number, y: number) => {
    if (selectedZoomId) updateZoom(selectedZoomId, { x, y });
  };
  const onRotateSelected = (angle: number) => {
    if (selectedRotateId) updateRotate(selectedRotateId, { angle: clamp(angle, -180, 180) });
  };
  const onMoveTap = (x: number, y: number) => {
    if (selectedTapId) updateTap(selectedTapId, { x, y });
  };

  // Backspace / Delete removes the selected zoom, rotate, or clip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const el = e.target;
      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
      ) {
        return;
      }
      if (selectedZoomId) {
        e.preventDefault();
        setProject((p) => ({ ...p, zooms: p.zooms.filter((z) => z.id !== selectedZoomId) }));
        setSelectedZoomId(null);
      } else if (selectedRotateId) {
        e.preventDefault();
        setProject((p) => ({ ...p, rotates: p.rotates.filter((r) => r.id !== selectedRotateId) }));
        setSelectedRotateId(null);
      } else if (selectedTapId) {
        e.preventDefault();
        setProject((p) => ({ ...p, taps: p.taps.filter((t) => t.id !== selectedTapId) }));
        setSelectedTapId(null);
      } else if (selectedClipId) {
        e.preventDefault();
        removeClip(selectedClipId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedZoomId, selectedRotateId, selectedTapId, selectedClipId, removeClip]);

  // Cmd/Ctrl+Z undoes the last change.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== "z") return;
      const el = e.target;
      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const selectedZoom = selectedZoomId
    ? (project.zooms.find((z) => z.id === selectedZoomId) ?? null)
    : null;
  const activeZoomPan =
    selectedZoom &&
    currentTime >= selectedZoom.start &&
    currentTime <= selectedZoom.start + selectedZoom.duration
      ? { x: selectedZoom.x, y: selectedZoom.y }
      : null;
  const selectedRotate = selectedRotateId
    ? (project.rotates.find((r) => r.id === selectedRotateId) ?? null)
    : null;
  const selectedTap = selectedTapId
    ? (project.taps.find((t) => t.id === selectedTapId) ?? null)
    : null;
  const rotatePan =
    selectedRotate &&
    currentTime >= selectedRotate.start &&
    currentTime <= selectedRotate.start + selectedRotate.duration
      ? selectedRotate.angle
      : null;
  const selectedTapPos = selectedTap ? { x: selectedTap.x, y: selectedTap.y } : null;
  const clipsDuration = totalDuration(project.clips);
  const zoomMax = selectedZoom ? clipsDuration - selectedZoom.start : 8;
  const rotateMax = selectedRotate ? clipsDuration - selectedRotate.start : 8;

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">Mockup Studio</span>
          <span className="text-xs text-muted-foreground">iPhone screen-recording editor</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={project.clips.length === 0 || exporting}
          onClick={doExport}
        >
          <Download className="h-4 w-4" />
          {exporting ? `Exporting ${Math.round(exportPct * 100)}%` : "Export"}
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Preview
          project={project}
          videoEls={videoEls}
          bgImage={bgImage}
          playing={playing}
          currentTime={currentTime}
          tapPlacing={tapPlacing}
          zoomPan={activeZoomPan}
          rotatePan={rotatePan}
          selectedTapPos={selectedTapPos}
          onTime={onTime}
          onImportVideo={importVideo}
          onPlaceTap={placeTap}
          onReposition={reposition}
          onRepositionZoom={onRepositionZoom}
          onRotate={onRotateSelected}
          onMoveTap={onMoveTap}
        />
        <aside className="dialkit-root w-80 shrink-0 overflow-y-auto border-l border-border/60 bg-card">
          {selectedZoom && (
            <ZoomInspector
              zoom={selectedZoom}
              maxDuration={zoomMax}
              onUpdate={updateSelectedZoom}
              onRemove={removeSelectedZoom}
              onClose={closeInspector}
            />
          )}
          {selectedRotate && (
            <RotateInspector
              rotate={selectedRotate}
              maxDuration={rotateMax}
              onUpdate={updateSelectedRotate}
              onRemove={removeSelectedRotate}
              onClose={closeRotateInspector}
            />
          )}
          {selectedTap && (
            <TapInspector
              tap={selectedTap}
              onUpdate={updateSelectedTap}
              onRemove={removeSelectedTap}
              onClose={() => setSelectedTapId(null)}
            />
          )}
          <CanvasPanel aspect={project.aspect} onChange={setAspect} />
          <BackgroundPanel
            background={project.background}
            onChange={setBackground}
            onChangeImage={setImage}
            onUploadImage={importBgImage}
          />
          <DevicePanel device={project.device} onChangeDevice={setDevice} />
          <TuningPanel
            layout={project.layout}
            onChangeLayout={setLayout}
            onChangeShadow={setShadow}
          />
        </aside>
      </div>

      {project.clips.length > 0 && (
        <Timeline
          project={project}
          thumbnails={thumbnails}
          currentTime={currentTime}
          playing={playing}
          muted={muted}
          tapPlacing={tapPlacing}
          selectedZoomId={selectedZoomId}
          selectedRotateId={selectedRotateId}
          selectedClipId={selectedClipId}
          selectedTapId={selectedTapId}
          onTogglePlay={togglePlay}
          onScrub={onScrub}
          onSplit={splitAtPlayhead}
          onImportVideo={importVideo}
          onTrimClip={trimClip}
          onMoveClip={moveClip}
          onSelectClip={selectClip}
          onRemoveClip={removeClip}
          onToggleMute={toggleMute}
          onAddZoom={addZoom}
          onAddRotate={addRotate}
          onAddTap={addTap}
          onSelectZoom={selectZoom}
          onSelectRotate={selectRotate}
          onSelectTap={selectTap}
          onUpdateZoom={updateZoom}
          onUpdateRotate={updateRotate}
          onUpdateTap={updateTap}
          onRemoveTap={removeTap}
        />
      )}
    </div>
  );
}
