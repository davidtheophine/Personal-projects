import { X } from "lucide-react";
import { SelectControl } from "dialkit";
import { isZoomEase, ZOOM_EASE_OPTIONS, type RotateEvent } from "@/state/project";
import { PanelSection, SliderRow, Segmented } from "@/editor/controls";
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
  const is3D = rotate.is3D;
  return (
    <PanelSection
      title="Rotate"
      action={
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      }
    >
      <div className="space-y-1.5">
        <span className="text-[13px] text-muted-foreground">Style</span>
        <Segmented<"2d" | "3d">
          options={[
            { value: "2d", label: "2D" },
            { value: "3d", label: "3D" },
          ]}
          value={is3D ? "3d" : "2d"}
          onChange={(v) => onUpdate({ is3D: v === "3d" })}
        />
      </div>

      {is3D ? (
        <>
          <SliderRow
            label="Tilt X"
            value={rotate.rotateX ?? 0}
            min={-60}
            max={60}
            step={1}
            onChange={(v) => onUpdate({ rotateX: v })}
            unit="°"
          />
          <SliderRow
            label="Tilt Y"
            value={rotate.rotateY ?? 0}
            min={-60}
            max={60}
            step={1}
            onChange={(v) => onUpdate({ rotateY: v })}
            unit="°"
          />
          <SliderRow
            label="Roll"
            value={rotate.angle}
            min={-180}
            max={180}
            step={1}
            onChange={(v) => onUpdate({ angle: v })}
            unit="°"
          />
          <p className="text-[11px] text-muted-foreground">
            Grab the phone in the preview to tilt it in 3D space.
          </p>
        </>
      ) : (
        <>
          <SliderRow
            label="Roll"
            value={rotate.angle}
            min={-180}
            max={180}
            step={1}
            onChange={(v) => onUpdate({ angle: v })}
            unit="°"
          />
          <p className="text-[11px] text-muted-foreground">
            Spins the flat phone in place. Switch to 3D to tilt it in space.
          </p>
        </>
      )}

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
