import { X } from "lucide-react";
import { type VideoClip } from "@/state/project";
import { PanelSection, SliderRow } from "@/editor/controls";
import { Button } from "@/components/ui/button";

const SPEED_PRESETS = [0.25, 0.5, 1, 1.5, 2, 4];

export function ClipInspector({
  clip,
  onUpdate,
  onRemove,
  onClose,
}: {
  clip: VideoClip;
  onUpdate: (patch: Partial<VideoClip>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const speed = clip.speed || 1;
  return (
    <PanelSection
      title="Clip"
      action={
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      }
    >
      <p className="truncate text-[11px] text-muted-foreground" title={clip.name}>
        {clip.name}
      </p>
      <div className="space-y-2">
        <span className="text-[13px] text-muted-foreground">Speed</span>
        <div className="grid grid-cols-3 gap-1">
          {SPEED_PRESETS.map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={Math.abs(speed - p) < 0.001 ? "secondary" : "ghost"}
              onClick={() => onUpdate({ speed: p })}
              className="text-xs"
            >
              {p}×
            </Button>
          ))}
        </div>
      </div>
      <SliderRow
        label="Fine speed"
        value={speed}
        min={0.2}
        max={4}
        step={0.05}
        onChange={(v) => onUpdate({ speed: v })}
        unit="×"
      />
      <p className="text-[11px] text-muted-foreground">
        Faster makes the segment shorter on the timeline, slower makes it longer.
      </p>
      <Button variant="outline" size="sm" className="w-full" onClick={onRemove}>
        Remove clip
      </Button>
    </PanelSection>
  );
}
