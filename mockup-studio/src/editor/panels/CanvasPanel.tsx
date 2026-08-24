import { type AspectId } from "@/state/project";
import { PanelSection, Segmented } from "@/editor/controls";

const ASPECT_OPTIONS: { value: AspectId; label: string }[] = [
  { value: "9:16", label: "9:16" },
  { value: "4:3", label: "4:3" },
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
];

export function CanvasPanel({
  aspect,
  onChange,
}: {
  aspect: AspectId;
  onChange: (a: AspectId) => void;
}) {
  return (
    <PanelSection title="Canvas">
      <Segmented options={ASPECT_OPTIONS} value={aspect} onChange={onChange} />
    </PanelSection>
  );
}
