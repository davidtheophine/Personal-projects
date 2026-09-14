import { TITANIUM_COLORS, type DeviceFrame, type DeviceState } from "@/state/project";
import { PanelSection, Segmented, Swatches } from "@/editor/controls";

const SWATCHES = TITANIUM_COLORS.map((c) => ({ hex: c.hex, label: c.label }));

const FRAME_OPTIONS: { value: DeviceFrame; label: string }[] = [
  { value: "iphone", label: "iPhone" },
  { value: "none", label: "No frame" },
];

export function DevicePanel({
  device,
  onChangeDevice,
}: {
  device: DeviceState;
  onChangeDevice: (patch: Partial<DeviceState>) => void;
}) {
  const frame = device.frame ?? "iphone";
  return (
    <PanelSection title="Device">
      <Segmented
        options={FRAME_OPTIONS}
        value={frame}
        onChange={(f) => onChangeDevice({ frame: f })}
      />
      {frame === "none" ? (
        <p className="text-[11px] text-muted-foreground">
          Your video shows directly on the background — no phone mockup.
        </p>
      ) : (
        <Swatches
          colors={SWATCHES}
          value={device.color}
          onChange={(hex) => onChangeDevice({ color: hex })}
        />
      )}
    </PanelSection>
  );
}
