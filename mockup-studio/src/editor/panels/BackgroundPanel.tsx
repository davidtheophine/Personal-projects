import { useRef } from "react";
import { ImagePlus } from "lucide-react";
import {
  type BackgroundState,
  type BackgroundType,
  type ImageBackground,
} from "@/state/project";
import { MESH_PRESETS } from "@/render/backgrounds";
import { PanelSection, Segmented, SliderRow } from "@/editor/controls";
import { ColorField } from "@/editor/ColorField";
import { Button } from "@/components/ui/button";

const TYPE_OPTIONS: { value: BackgroundType; label: string }[] = [
  { value: "mesh", label: "Preset" },
  { value: "gradient", label: "Gradient" },
  { value: "solid", label: "Solid" },
  { value: "image", label: "Image" },
  { value: "none", label: "None" },
];

const MESH_ENTRIES = Object.entries(MESH_PRESETS);

export function BackgroundPanel({
  background,
  onChange,
  onChangeImage,
  onUploadImage,
}: {
  background: BackgroundState;
  onChange: (patch: Partial<BackgroundState>) => void;
  onChangeImage: (patch: Partial<ImageBackground>) => void;
  onUploadImage: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const img = background.image;

  return (
    <PanelSection title="Background">
      <Segmented
        options={TYPE_OPTIONS}
        value={background.type}
        onChange={(t) => onChange({ type: t })}
      />

      {background.type === "mesh" && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {MESH_ENTRIES.map(([id, preset]) => (
            <button
              key={id}
              onClick={() => onChange({ meshPreset: id })}
              title={preset.label}
              className={`h-12 rounded-lg ring-2 transition ${
                background.meshPreset === id
                  ? "ring-white"
                  : "ring-transparent hover:ring-white/30"
              }`}
              style={{
                background: `linear-gradient(135deg, ${preset.blobs[0].color}, ${preset.blobs[2].color})`,
              }}
            />
          ))}
        </div>
      )}

      {background.type === "gradient" && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-white/70">Colors</span>
            <div className="flex gap-2">
              <ColorField
                value={background.gradient.stops[0]?.color ?? "#6366f1"}
                onChange={(c) =>
                  onChange({
                    gradient: {
                      ...background.gradient,
                      stops: [
                        { color: c, at: 0 },
                        background.gradient.stops[1] ?? { color: "#8b5cf6", at: 1 },
                      ],
                    },
                  })
                }
              />
              <ColorField
                value={background.gradient.stops[1]?.color ?? "#8b5cf6"}
                onChange={(c) =>
                  onChange({
                    gradient: {
                      ...background.gradient,
                      stops: [
                        background.gradient.stops[0] ?? { color: "#6366f1", at: 0 },
                        { color: c, at: 1 },
                      ],
                    },
                  })
                }
              />
            </div>
          </div>
          <SliderRow
            label="Angle"
            value={background.gradient.angle}
            min={0}
            max={360}
            step={1}
            onChange={(v) =>
              onChange({ gradient: { ...background.gradient, angle: v } })
            }
            unit="°"
          />
        </div>
      )}

      {background.type === "solid" && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[13px] text-white/70">Color</span>
          <ColorField value={background.color} onChange={(c) => onChange({ color: c })} />
        </div>
      )}

      {background.type === "image" && (
        <div className="space-y-3.5 pt-1">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            {img.name ? "Replace image" : "Upload image"}
          </Button>
          {img.name && (
            <p className="truncate text-[11px] text-white/40" title={img.name}>
              {img.name}
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadImage(f);
            }}
          />
          {img.src && (
            <>
              <Segmented
                options={[
                  { value: "cover", label: "Fill" },
                  { value: "contain", label: "Fit" },
                ]}
                value={img.fit}
                onChange={(v) => onChangeImage({ fit: v })}
              />
              <SliderRow
                label="Scale"
                value={img.scale}
                min={0.2}
                max={3}
                step={0.01}
                onChange={(v) => onChangeImage({ scale: v })}
                unit="%"
                mult={100}
              />
              <SliderRow
                label="Rotation"
                value={img.rotation}
                min={-180}
                max={180}
                step={1}
                onChange={(v) => onChangeImage({ rotation: v })}
                unit="°"
              />
              <SliderRow
                label="Position X"
                value={img.offsetX}
                min={-0.5}
                max={0.5}
                step={0.005}
                onChange={(v) => onChangeImage({ offsetX: v })}
                unit="%"
                mult={100}
              />
              <SliderRow
                label="Position Y"
                value={img.offsetY}
                min={-0.5}
                max={0.5}
                step={0.005}
                onChange={(v) => onChangeImage({ offsetY: v })}
                unit="%"
                mult={100}
              />
              <SliderRow
                label="Exposure"
                value={img.exposure}
                min={0.3}
                max={2}
                step={0.01}
                onChange={(v) => onChangeImage({ exposure: v })}
                unit="%"
                mult={100}
              />
              <SliderRow
                label="Blur"
                value={img.blur}
                min={0}
                max={40}
                step={0.5}
                onChange={(v) => onChangeImage({ blur: v })}
                unit="px"
              />
              <SliderRow
                label="Contrast"
                value={img.contrast}
                min={0.5}
                max={2}
                step={0.01}
                onChange={(v) => onChangeImage({ contrast: v })}
                unit="%"
                mult={100}
              />
              <SliderRow
                label="Saturation"
                value={img.saturation}
                min={0}
                max={2}
                step={0.01}
                onChange={(v) => onChangeImage({ saturation: v })}
                unit="%"
                mult={100}
              />
              <SliderRow
                label="Vignette"
                value={img.vignette}
                min={0}
                max={0.8}
                step={0.01}
                onChange={(v) => onChangeImage({ vignette: v })}
                unit="%"
                mult={100}
              />
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-white/70">Darken / tint</span>
                <ColorField value={img.tint} onChange={(c) => onChangeImage({ tint: c })} />
              </div>
              <SliderRow
                label="Tint amount"
                value={img.tintAmount}
                min={0}
                max={0.8}
                step={0.01}
                onChange={(v) => onChangeImage({ tintAmount: v })}
                unit="%"
                mult={100}
              />
            </>
          )}
        </div>
      )}
    </PanelSection>
  );
}
