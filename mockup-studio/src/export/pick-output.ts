export interface OutputChoice {
  container: "mp4" | "webm";
  videoCodec: "avc" | "vp9" | "vp8" | "av1";
  audioCodec: "aac" | "opus" | null;
}

export interface EncoderProbe {
  canEncodeVideo(codec: "avc" | "vp9" | "vp8" | "av1"): Promise<boolean>;
  canEncodeAudio(codec: "aac" | "opus"): Promise<boolean>;
}

/**
 * MP4 (H.264 + AAC) is what people expect to share and what QuickTime/iOS
 * play. When AAC can't be encoded (e.g. Firefox), don't put Opus in an MP4 —
 * QuickTime can't play that — use WebM (VP9/VP8/AV1 + Opus) instead, which is
 * also what the real-time exporter produces there. Null = no usable encoders.
 */
export async function pickOutput(probe: EncoderProbe, withAudio: boolean): Promise<OutputChoice | null> {
  if ((await probe.canEncodeVideo("avc")) && (!withAudio || (await probe.canEncodeAudio("aac")))) {
    return { container: "mp4", videoCodec: "avc", audioCodec: withAudio ? "aac" : null };
  }
  if (withAudio && !(await probe.canEncodeAudio("opus"))) return null;
  for (const videoCodec of ["vp9", "vp8", "av1"] as const) {
    if (await probe.canEncodeVideo(videoCodec)) {
      return { container: "webm", videoCodec, audioCodec: withAudio ? "opus" : null };
    }
  }
  return null;
}
