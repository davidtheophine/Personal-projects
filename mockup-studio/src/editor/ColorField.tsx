import { useEffect, useRef, useState } from "react";
import { hexToRgb } from "@/lib/color";
import { clamp, clamp01 } from "@/render/geometry";

interface HSV {
  h: number;
  s: number;
  v: number;
}

function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g] = [c, x];
  else if (h < 120) [r, g] = [x, c];
  else if (h < 180) [g, b] = [c, x];
  else if (h < 240) [g, b] = [x, c];
  else if (h < 300) [r, b] = [x, c];
  else [r, b] = [c, x];
  const hex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

const PRESETS = [
  "#ffffff", "#d4d4d8", "#a1a1aa", "#52525b", "#18181b", "#000000",
  "#f97316", "#ef4444", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6",
];

function useDragPick(onPick: (e: React.PointerEvent<HTMLDivElement>) => void) {
  const pressed = useRef(false);
  return {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      pressed.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      onPick(e);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (pressed.current) onPick(e);
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      pressed.current = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
  };
}

export function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const rgb = hexToRgb(value);
  const { h, s, v } = rgbToHsv(rgb.r, rgb.g, rgb.b);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const svHandlers = useDragPick((e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange(
      hsvToHex(h, clamp01((e.clientX - r.left) / r.width), clamp01(1 - (e.clientY - r.top) / r.height)),
    );
  });
  const hueHandlers = useDragPick((e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange(hsvToHex(clamp(((e.clientX - r.left) / r.width) * 360, 0, 360), s, v));
  });

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Pick colour"
        onClick={() => setOpen((o) => !o)}
        className="h-8 w-12 rounded-md border border-white/15 shadow-inner"
        style={{ backgroundColor: value }}
      />
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-white/10 bg-[#17171b] p-3 shadow-2xl shadow-black/60">
          <div
            {...svHandlers}
            className="relative h-32 w-full touch-none rounded-md"
            style={{ backgroundColor: `hsl(${h}, 100%, 50%)` }}
          >
            <div className="absolute inset-0 rounded-md" style={{ background: "linear-gradient(to right, #fff, rgba(255,255,255,0))" }} />
            <div className="absolute inset-0 rounded-md" style={{ background: "linear-gradient(to top, #000, rgba(0,0,0,0))" }} />
            <div
              className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
            />
          </div>
          <div
            {...hueHandlers}
            className="relative mt-3 h-3 w-full touch-none rounded-full"
            style={{
              background:
                "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
            }}
          >
            <div
              className="pointer-events-none absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/30 bg-white shadow"
              style={{ left: `${(h / 360) * 100}%` }}
            />
          </div>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-3 w-full rounded-md bg-white/5 px-2 py-1.5 text-xs tabular-nums text-white/80 outline-none ring-1 ring-white/10 focus:ring-orange-400/50"
          />
          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => onChange(c)}
                className="h-6 w-6 rounded-md border border-white/10"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
