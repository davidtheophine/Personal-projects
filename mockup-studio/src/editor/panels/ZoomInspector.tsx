import { X } from "lucide-react";
import { SelectControl } from "dialkit";
import {
  isZoomEase,
  ZOOM_ANCHOR_X,
  ZOOM_ANCHOR_Y,
  ZOOM_EASE_OPTIONS,
  type ZoomAnchorX,
  type ZoomAnchorY,
  type ZoomEvent,
} from "@/state/project";
import { PanelSection, SliderRow } from "@/editor/controls";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const XS: ZoomAnchorX[] = ["left", "center", "right"];
const YS: ZoomAnchorY[] = ["top", "center", "bottom"];

function PositionGrid({
  x,
  y,
  onPick,
}: {
  x: number;
  y: number;
  onPick: (x: number, y: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {YS.flatMap((vy) =>
        XS.map((hx) => {
          const px = ZOOM_ANCHOR_X[hx];
          const py = ZOOM_ANCHOR_Y[vy];
          const active = Math.abs(px - x) < 0.001 && Math.abs(py - y) < 0.001;
          return (
            <button
              key={`${hx}-${vy}`}
              type="button"
              title={`${vy} ${hx}`}
              onClick={() => onPick(px, py)}
              className={cn(
                "flex h-7 items-center justify-center rounded-md border transition",
                active
                  ? "border-primary bg-primary/15"
                  : "border-border bg-muted/40 hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  active ? "bg-primary" : "bg-muted-foreground",
                )}
              />
            </button>
          );
        }),
      )}
    </div>
  );
}

export function ZoomInspector({
  zoom,
  maxDuration,
  onUpdate,
  onRemove,
  onClose,
}: {
  zoom: ZoomEvent;
  maxDuration: number;
  onUpdate: (patch: Partial<ZoomEvent>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <PanelSection
      title="Zoom"
      action={
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      }
    >
      <SliderRow
        label="Size"
        value={zoom.scale}
        min={1.1}
        max={2.5}
        step={0.05}
        onChange={(v) => onUpdate({ scale: v })}
        unit="×"
      />

      <div className="space-y-2">
        <span className="text-[13px] text-muted-foreground">Phone position</span>
        <PositionGrid x={zoom.x} y={zoom.y} onPick={(x, y) => onUpdate({ x, y })} />
        <p className="text-[11px] text-muted-foreground">
          Or drag the phone in the preview — the background stays put.
        </p>
      </div>

      <SliderRow
        label="Position X"
        value={zoom.x}
        min={-0.4}
        max={0.4}
        step={0.005}
        onChange={(v) => onUpdate({ x: v })}
        unit="%"
        mult={100}
      />
      <SliderRow
        label="Position Y"
        value={zoom.y}
        min={-0.4}
        max={0.4}
        step={0.005}
        onChange={(v) => onUpdate({ y: v })}
        unit="%"
        mult={100}
      />

      <div className="space-y-2.5">
        <span className="text-[13px] text-muted-foreground">Animation</span>
        <SelectControl
          label="Curve"
          value={zoom.ease}
          options={ZOOM_EASE_OPTIONS}
          onChange={(v) => {
            if (isZoomEase(v)) onUpdate({ ease: v });
          }}
        />
        <SliderRow
          label="Duration"
          value={zoom.duration}
          min={0.2}
          max={Math.max(0.4, maxDuration)}
          step={0.1}
          onChange={(v) => onUpdate({ duration: v })}
          unit="s"
        />
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={onRemove}>
        Remove zoom
      </Button>
    </PanelSection>
  );
}
