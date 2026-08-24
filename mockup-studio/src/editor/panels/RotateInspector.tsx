import { X } from "lucide-react";
import { SelectControl } from "dialkit";
import { isZoomEase, ZOOM_EASE_OPTIONS, type RotateEvent } from "@/state/project";
import { PanelSection, SliderRow } from "@/editor/controls";
import { Button } from "@/components/ui/button";

export function RotateInspector({
  rotate,
  maxDuration,
  onUpdate,
  onRemove,
  onClose,
}: {
  rotate: RotateEvent;
  maxDuration: number;
  onUpdate: (patch: Partial<RotateEvent>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <PanelSection
      title="Rotate"
      action={
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      }
    >
      <SliderRow
        label="Angle"
        value={rotate.angle}
        min={-180}
        max={180}
        step={1}
        onChange={(v) => onUpdate({ angle: v })}
        unit="°"
      />

      <div className="space-y-2.5">
        <span className="text-[13px] text-muted-foreground">Animation</span>
        <SelectControl
          label="Curve"
          value={rotate.ease}
          options={ZOOM_EASE_OPTIONS}
          onChange={(v) => {
            if (isZoomEase(v)) onUpdate({ ease: v });
          }}
        />
        <SliderRow
          label="Duration"
          value={rotate.duration}
          min={0.2}
          max={Math.max(0.4, maxDuration)}
          step={0.1}
          onChange={(v) => onUpdate({ duration: v })}
          unit="s"
        />
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={onRemove}>
        Remove rotate
      </Button>
    </PanelSection>
  );
}
