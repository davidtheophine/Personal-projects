import { describe, expect, it } from "vitest";
import { pickOutput } from "./pick-output";

// A fake browser that can encode exactly the listed codecs.
const browser = (...codecs: string[]) => ({
  canEncodeVideo: async (c: string) => codecs.includes(c),
  canEncodeAudio: async (c: string) => codecs.includes(c),
});

// Breaks caught: producing an MP4 with Opus audio (won't play in QuickTime /
// iOS Photos), dropping the audio track, or claiming support with no encoder.
describe("pickOutput", () => {
  it("uses MP4 with H.264 + AAC when the browser can encode both", async () => {
    expect(await pickOutput(browser("avc", "aac", "vp9", "opus"), true)).toEqual({
      container: "mp4",
      videoCodec: "avc",
      audioCodec: "aac",
    });
  });

  it("switches to WebM (VP9 + Opus) rather than put Opus in an MP4 when AAC can't be encoded", async () => {
    expect(await pickOutput(browser("avc", "vp9", "opus"), true)).toEqual({
      container: "webm",
      videoCodec: "vp9",
      audioCodec: "opus",
    });
  });

  it("keeps MP4/H.264 for a silent export even when AAC is unavailable", async () => {
    expect(await pickOutput(browser("avc"), false)).toEqual({ container: "mp4", videoCodec: "avc", audioCodec: null });
  });

  it("falls back to the next WebM video codec when VP9 is missing", async () => {
    expect(await pickOutput(browser("vp8", "opus"), true)).toEqual({
      container: "webm",
      videoCodec: "vp8",
      audioCodec: "opus",
    });
  });

  it("gives up (null) when audio is needed but no audio encoder fits the chosen container", async () => {
    expect(await pickOutput(browser("avc", "vp9"), true)).toBeNull();
  });

  it("gives up (null) when nothing can encode video", async () => {
    expect(await pickOutput(browser("aac", "opus"), true)).toBeNull();
  });
});
