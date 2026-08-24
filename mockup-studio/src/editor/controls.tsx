import type { ReactNode } from "react";
import { Slider } from "dialkit";
import "dialkit/styles.css";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PanelSection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-b border-border/60 px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      <div className="space-y-3.5">{children}</div>
    </div>
  );
}

/**
 * A DialKit slider. `mult` scales the value into display space (e.g. 100 for a
 * 0..1 value shown as a percentage); `unit` is the suffix DialKit appends.
 */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit,
  mult = 1,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
  mult?: number;
}) {
  return (
    <Slider
      label={label}
      value={value * mult}
      min={min * mult}
      max={max * mult}
      step={step * mult}
      unit={unit}
      onChange={(v) => onChange(v / mult)}
    />
  );
}

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-muted/40 p-0.5">
      {options.map((o) => (
        <Button
          key={o.value}
          type="button"
          size="sm"
          variant={value === o.value ? "secondary" : "ghost"}
          onClick={() => onChange(o.value)}
          className="flex-1 text-xs"
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

export function Swatches({
  colors,
  value,
  onChange,
}: {
  colors: { hex: string; label?: string }[];
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c.hex}
          type="button"
          title={c.label}
          onClick={() => onChange(c.hex)}
          className={cn(
            "h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition",
            value.toLowerCase() === c.hex.toLowerCase()
              ? "ring-ring"
              : "ring-transparent hover:ring-border",
          )}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  );
}
