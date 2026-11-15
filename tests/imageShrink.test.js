import { describe, it, expect, vi, afterEach } from "vitest";

const squoosh = vi.hoisted(() => ({ calls: [], size: 250000 }));
vi.mock("@jsquash/webp", () => ({ encode: async (_data, options) => { squoosh.calls.push(options); return new Uint8Array(squoosh.size).buffer; } }));
import { compressImage, compressReceipt, fitWidth, renamed, shrinkImage } from "../lib/imageShrink.ts";

describe("image shrinking", () => {
  it("scales down to the maximum width, keeping the ratio, and never scales up", () => {
    expect(fitWidth(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
    expect(fitWidth(1000, 500, 1920)).toEqual({ width: 1000, height: 500 });
    expect(fitWidth(1920, 1080, 1920)).toEqual({ width: 1920, height: 1080 });
    expect(fitWidth(10000, 1, 100)).toEqual({ width: 100, height: 1 });      // never a zero-height picture
    expect(fitWidth(0, 0, 100)).toEqual({ width: 1, height: 1 });
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

describe("compressing with the Squoosh encoder (jSquash)", () => {
  afterEach(() => { vi.unstubAllGlobals(); squoosh.calls.length = 0; squoosh.size = 250000; });
  function browserWithPixels() {
    vi.stubGlobal("createImageBitmap", async () => ({ width: 4000, height: 3000, close() {} }));
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: (_x, _y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(4) }) }), toBlob(cb) { cb(new Blob([new Uint8Array(9e6)], { type: "image/png" })); } }) });
  }
  const photo = (name = "crowd.jpg", type = "image/jpeg", bytes = 5 * 1024 * 1024) => new File([new Uint8Array(bytes)], name, { type });

  it("saves a WebP made by the Squoosh encoder, at the quality asked for", async () => {
    browserWithPixels();
    const out = await compressImage(photo(), { maxWidth: 1920, quality: 70 });
    expect(out.type).toBe("image/webp"); expect(out.name).toBe("crowd.webp"); expect(out.size).toBe(250000);
    expect(squoosh.calls[0]).toMatchObject({ quality: 70, lossless: 0 });
  });
  it("is lossless for a QR code, so every pixel stays", async () => {
    browserWithPixels();
    await compressImage(photo("qr.png", "image/png"), { maxWidth: 4096, lossless: true });
    expect(squoosh.calls[0]).toMatchObject({ lossless: 1 });
  });
  it("compresses even a small picture, and keeps the original only when the result is not smaller", async () => {
    browserWithPixels();
    squoosh.size = 40000;
    expect((await compressImage(photo("small.jpg", "image/jpeg", 150 * 1024))).size).toBe(40000);
    squoosh.size = 600000;
    const tiny = photo("tiny.jpg", "image/jpeg", 100 * 1024);
    expect(await compressImage(tiny)).toBe(tiny);
  });
  it("leaves a PDF alone, and compresses a receipt photo", async () => {
    browserWithPixels();
    const pdf = new File([new Uint8Array(3e6)], "receipt.pdf", { type: "application/pdf" });
    expect(await compressReceipt(pdf)).toBe(pdf);
    expect(squoosh.calls).toHaveLength(0);
    const out = await compressReceipt(photo("receipt.jpg"));
    expect(out.type).toBe("image/webp");
    expect(squoosh.calls[0]).toMatchObject({ quality: 82 });
  });
  it("falls back to the browser when the Squoosh encoder cannot run", async () => {
    vi.stubGlobal("createImageBitmap", async () => ({ width: 4000, height: 3000, close() {} }));
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob(cb, type) { cb(new Blob([new Uint8Array(200000)], { type })); } }) });   // no getImageData: the encoder fails
    const out = await shrinkImage(photo(), 1920);
    expect(out.type).toBe("image/webp"); expect(out.size).toBe(200000);
  });
});
