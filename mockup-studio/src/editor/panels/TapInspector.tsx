import { X } from "lucide-react";
import { type TapEvent } from "@/state/project";
import { PanelSection, SliderRow } from "@/editor/controls";
import { Button } from "@/components/ui/button";

export function TapInspector({
  tap,
  onUpdate,
  onRemove,
  onClose,
}: {
  tap: TapEvent;
  onUpdate: (patch: Partial<TapEvent>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <PanelSection
      title="Tap"
      action={
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      }
    >
      <SliderRow
        label="Size"
        value={tap.size}
        min={0.5}
        max={2.5}
        step={0.05}
        onChange={(v) => onUpdate({ size: v })}
        unit="×"
      />
      <div className="space-y-2.5">
        <span className="text-[13px] text-muted-foreground">Animation</span>
        <SliderRow
          label="Duration"
          value={tap.duration}
          min={0.2}
          max={2}
          step={0.05}
          onChange={(v) => onUpdate({ duration: v })}
          unit="s"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Drag the marker on the timeline to change when it fires.
      </p>
      <Button variant="outline" size="sm" className="w-full" onClick={onRemove}>
        Remove tap
      </Button>
    </PanelSection>
  );
}
