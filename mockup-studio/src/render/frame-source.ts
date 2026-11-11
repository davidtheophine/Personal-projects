/**
 * Anything the renderer can paint as "the video": the live `<video>` element
 * (preview and the real-time exporter), or an already-decoded frame (the fast
 * exporter decodes with WebCodecs and hands over a canvas or VideoFrame).
 */
export type FrameSource =
  | HTMLVideoElement
  | HTMLCanvasElement
  | OffscreenCanvas
  | ImageBitmap
  | VideoFrame;

/** Intrinsic pixel size of a frame source; 0×0 while a video has no frame yet. */
export function frameSize(src: FrameSource): { w: number; h: number } {
  if ("videoWidth" in src) return { w: src.videoWidth, h: src.videoHeight };
  if ("displayWidth" in src) return { w: src.displayWidth, h: src.displayHeight };
  return { w: src.width, h: src.height };
}
