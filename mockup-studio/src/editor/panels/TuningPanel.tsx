import { useEffect, useRef } from "react";
import { DialRoot, useDialKitController } from "dialkit";
import "dialkit/styles.css";
import type { LayoutState, ShadowState } from "@/state/project";

type Tuple = [number, number, number, number?];
type Bag = Record<string, unknown>;

function buildConfig(l: LayoutState): Record<string, Record<string, Tuple>> {
  return {
    Layout: {
      Size: [l.scale, 0.5, 1.4, 0.01],
      Vertical: [l.y, -0.3, 0.3, 0.005],
      Horizontal: [l.x, -0.3, 0.3, 0.005],
    },
    Shadow: {
      Blur: [l.shadow.blur, 0, 180, 1],
      Drop: [l.shadow.y, 0, 140, 1],
      Opacity: [l.shadow.opacity, 0, 0.8, 0.01],
    },
  };
}

/**
 * Device layout + shadow tuning via DialKit's inline panel. `persist: false`
 * keeps a prior session from overriding defaults; `productionEnabled` because
 * Magic serves a production build. The preset/"Version" chrome is hidden via CSS
 * (see index.css). One-way sync: DialKit owns the values, we push them to Project.
 */
export function TuningPanel({
  layout,
  onChangeLayout,
  onChangeShadow,
}: {
  layout: LayoutState;
  onChangeLayout: (patch: Partial<LayoutState>) => void;
  onChangeShadow: (patch: Partial<ShadowState>) => void;
}) {
  const initial = useRef(buildConfig(layout)).current;
  const dial = useDialKitController("Adjust", initial, {
    id: "mockup-adjust",
    persist: false,
  });

  const latest = useRef(layout);
  latest.current = layout;

  useEffect(() => {
    const values = dial.values as Bag;
    const L = values.Layout as Bag | undefined;
    const S = values.Shadow as Bag | undefined;
    const l = latest.current;
    if (L) {
      if (typeof L.Size === "number" && L.Size !== l.scale) onChangeLayout({ scale: L.Size });
      if (typeof L.Vertical === "number" && L.Vertical !== l.y) onChangeLayout({ y: L.Vertical });
      if (typeof L.Horizontal === "number" && L.Horizontal !== l.x)
        onChangeLayout({ x: L.Horizontal });
    }
    if (S) {
      if (typeof S.Blur === "number" && S.Blur !== l.shadow.blur) onChangeShadow({ blur: S.Blur });
      if (typeof S.Drop === "number" && S.Drop !== l.shadow.y) onChangeShadow({ y: S.Drop });
      if (typeof S.Opacity === "number" && S.Opacity !== l.shadow.opacity)
        onChangeShadow({ opacity: S.Opacity });
    }
  });

  return (
    <div className="px-2 py-3">
      <DialRoot mode="inline" theme="dark" productionEnabled />
    </div>
  );
}
