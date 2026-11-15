import { describe, it, expect } from "vitest";
import { fitWidth, renamed, shrinkImage, worthShrinking, SKIP_BELOW_BYTES } from "../lib/imageShrink.ts";

describe("image shrinking", () => {
  it("scales down to the maximum width, keeping the ratio, and never scales up", () => {
    expect(fitWidth(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
    expect(fitWidth(1000, 500, 1920)).toEqual({ width: 1000, height: 500 });
    expect(fitWidth(1920, 1080, 1920)).toEqual({ width: 1920, height: 1080 });
    expect(fitWidth(10000, 1, 100)).toEqual({ width: 100, height: 1 });      // never a zero-height picture
    expect(fitWidth(0, 0, 100)).toEqual({ width: 1, height: 1 });
  });
  it("leaves a small picture that already fits alone, and shrinks a big file or a wide picture", () => {
    expect(worthShrinking(SKIP_BELOW_BYTES - 1, 800, 1920)).toBe(false);
    expect(worthShrinking(SKIP_BELOW_BYTES + 1, 800, 1920)).toBe(true);
    expect(worthShrinking(1000, 3000, 1920)).toBe(true);
  });
  it("renames the file for its new type", () => {
    expect(renamed("banner.final.JPG", "webp")).toBe("banner.final.webp");
    expect(renamed("photo", "webp")).toBe("photo.webp");
    expect(renamed(".png", "webp")).toBe("image.webp");
  });
  it("hands the original back where the browser cannot shrink (no canvas here)", async () => {
    const f = new File([new Uint8Array(500 * 1024)], "big.jpg", { type: "image/jpeg" });
    expect(await shrinkImage(f, 1920)).toBe(f);
  });
});
