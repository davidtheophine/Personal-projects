import { describe, expect, it } from "vitest";
import { seekVideo } from "./media";

// Break caught: a seek whose "seeked" event never arrives (decoder hiccup,
// unplayable file) hanging the export forever at the same percentage.
describe("seekVideo", () => {
  it("resolves once the element reports the seek finished", async () => {
    const el = document.createElement("video");
    const p = seekVideo(el, 2.5, 1000);
    el.dispatchEvent(new Event("seeked"));
    await expect(p).resolves.toBeUndefined();
  });

  it("rejects instead of waiting forever when the seek never completes", async () => {
    const el = document.createElement("video"); // jsdom never fires "seeked"
    await expect(seekVideo(el, 2.5, 30)).rejects.toThrow(/seek/i);
  });
});
