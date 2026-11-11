// Just the parts of Mediabunny the fast exporter uses, re-exported from one
// module that fast-export.ts loads lazily — so the bundler can drop the rest
// of the library (other containers, HLS, subtitles, …) from the export chunk.
import { MATROSKA, MP4, QTFF, WEBM } from "mediabunny";

export {
  AudioBufferSink,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
} from "mediabunny";

/** Containers a browser can import as a screen recording (.mp4, .mov, .webm, .mkv). */
export const INPUT_FORMATS = [MP4, QTFF, WEBM, MATROSKA];
