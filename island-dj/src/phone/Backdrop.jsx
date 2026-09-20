// The full iOS home screen — exported composited from Figma (wallpaper + icons +
// dock + status bar), pixel-identical. It has a compact pill baked in; the live
// Dynamic Island is sized to fully cover it, so no ghost layer shows underneath.
export default function Backdrop() {
  return <img className="backdrop__home" src="/figma/home.png" alt="" />
}
