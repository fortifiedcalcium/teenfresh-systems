import { describe, it, expect, vi, afterEach } from "vitest";
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

describe("shrinking where the browser cannot encode WebP (Safari)", () => {
  afterEach(() => vi.unstubAllGlobals());
  // a fake canvas: it can only encode what `encodes` lists, and gives a PNG for anything else, the way Safari does
  function fakeBrowser(encodes, bytes) {
    vi.stubGlobal("createImageBitmap", async () => ({ width: 4000, height: 3000, close() {} }));
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob(cb, type) { const t = encodes.includes(type) ? type : "image/png"; cb(new Blob([new Uint8Array(bytes[t] ?? 1000)], { type: t })); } }) });
  }
  const photo = (type, name) => new File([new Uint8Array(5 * 1024 * 1024)], name, { type });
  it("saves a JPEG photo as a smaller JPEG", async () => {
    fakeBrowser(["image/jpeg"], { "image/jpeg": 300000, "image/png": 9e6 });
    const out = await shrinkImage(photo("image/jpeg", "crowd.jpg"), 1920);
    expect(out.type).toBe("image/jpeg"); expect(out.name).toBe("crowd.jpg"); expect(out.size).toBe(300000);
  });
  it("keeps a PNG as a PNG (transparency), if it got smaller", async () => {
    fakeBrowser([], { "image/png": 900000 });
    const out = await shrinkImage(photo("image/png", "art.png"), 1600);
    expect(out.type).toBe("image/png"); expect(out.size).toBe(900000);
  });
  it("uses WebP when the browser can", async () => {
    fakeBrowser(["image/webp"], { "image/webp": 250000 });
    const out = await shrinkImage(photo("image/jpeg", "crowd.jpg"), 1920);
    expect(out.type).toBe("image/webp"); expect(out.name).toBe("crowd.webp");
  });
  it("uploads the original when the result is not smaller", async () => {
    fakeBrowser(["image/webp"], { "image/webp": 6 * 1024 * 1024 });
    const f = photo("image/jpeg", "crowd.jpg");
    expect(await shrinkImage(f, 1920)).toBe(f);
  });
});

import { MAX_SAVED_BYTES, savedSizeError, shrinkOrRefuse } from "../lib/imageShrink.ts";
describe("refusing a picture that is still too big", () => {
  it("accepts up to the limit and refuses anything over it, saying how big it is", () => {
    expect(savedSizeError({ size: MAX_SAVED_BYTES })).toBe("");
    expect(savedSizeError({ size: 300 * 1024 })).toBe("");
    expect(savedSizeError({ size: 5 * 1024 * 1024 })).toMatch(/still 5\.0 MB.*most allowed is 1\.5 MB/);
  });
  it("refuses a big file the browser could not shrink, and lets a small one through", async () => {
    await expect(shrinkOrRefuse(new File([new Uint8Array(4 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" }), 1920)).rejects.toThrow(/still 4\.0 MB/);
    const small = new File([new Uint8Array(100 * 1024)], "ok.jpg", { type: "image/jpeg" });
    expect(await shrinkOrRefuse(small, 1920)).toBe(small);
  });
});
