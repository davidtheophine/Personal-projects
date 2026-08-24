import { TITANIUM_COLORS, type DeviceState } from "@/state/project";
import { PanelSection, Swatches } from "@/editor/controls";

const SWATCHES = TITANIUM_COLORS.map((c) => ({ hex: c.hex, label: c.label }));

export function DevicePanel({
  device,
  onChangeDevice,
}: {
  device: DeviceState;
  onChangeDevice: (patch: Partial<DeviceState>) => void;
}) {
  return (
    <PanelSection title="Device">
      <Swatches
        colors={SWATCHES}
        value={device.color}
        onChange={(hex) => onChangeDevice({ color: hex })}
      />
    </PanelSection>
  );
}
