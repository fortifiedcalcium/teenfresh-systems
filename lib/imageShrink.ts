// Every picture that is uploaded to the site is compressed in the browser first: resized down to a sensible width (never up) and saved as WebP with
// Squoosh's own encoder (jSquash, WebAssembly). A 6 MB camera photo becomes a few hundred KB, in every browser, Safari included. The encoder loads
// only when someone uploads, so visitors never download it. If it cannot run, the browser's own canvas does the job (WebP, or JPEG/PNG where the
// browser cannot encode WebP), and if that fails too the original is uploaded rather than losing the upload. The result is kept only when it is
// smaller than the original.

export const SHRINK_QUALITY = 0.82;                    // the browser fallback (0 to 1)
export const WEBP_QUALITY = 80;                        // jSquash (0 to 100)
const EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

export interface CompressOptions { maxWidth?: number; quality?: number; lossless?: boolean }

/** The size to draw at: scaled down so the width is at most `max`, keeping the ratio; never larger than the original. */
export function fitWidth(width: number, height: number, max: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 1, height: 1 };
  if (width <= max) return { width, height };
  return { width: max, height: Math.max(1, Math.round((height * max) / width)) };
}

/** The file name with a new extension (a.b.jpg -> a.b.webp). */
export const renamed = (name: string, ext: string): string => `${name.replace(/\.[^./\\]+$/, "") || "image"}.${ext}`;

/** Encodes the pixels as WebP with the Squoosh encoder. Loaded on demand. `lossless` keeps every pixel (for QR codes). */
async function encodeWithSquoosh(data: ImageData, { quality = WEBP_QUALITY, lossless = false }: CompressOptions): Promise<Blob> {
  const { encode } = await import("@jsquash/webp");
  const bytes = await encode(data, { quality, lossless: lossless ? 1 : 0, method: 5 });
  return new Blob([bytes], { type: "image/webp" });
}

/** The same with the browser's own canvas. WebP first; Safari cannot encode WebP and quietly gives a PNG, so a JPEG photo is then saved as a
 *  smaller JPEG (a PNG stays a PNG, to keep any transparency). */
async function encodeWithCanvas(canvas: HTMLCanvasElement, original: File): Promise<Blob | null> {
  const toBlob = (type: string): Promise<Blob | null> => new Promise((resolve) => canvas.toBlob(resolve, type, SHRINK_QUALITY));
  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await toBlob(original.type === "image/jpeg" ? "image/jpeg" : "image/png");
  return blob && EXT[blob.type] ? blob : null;
}

/** Compresses a picture: resized to at most `maxWidth`, saved as WebP. Returns the original when it is not an image, when nothing can be gained,
 *  or when the browser cannot do it. */
export async function compressImage(file: File, { maxWidth = 1920, quality = WEBP_QUALITY, lossless = false }: CompressOptions = {}): Promise<File> {
  if (!file.type.startsWith("image/")) return file;                      // a PDF receipt, for example, goes up as it is
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);                       // honours the photo's rotation
    const { width, height } = fitWidth(bitmap.width, bitmap.height, maxWidth);
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) { bitmap.close(); return file; }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    let blob: Blob | null = null;
    try { blob = await encodeWithSquoosh(ctx.getImageData(0, 0, width, height), { quality, lossless }); } catch { blob = null; }   // no WebAssembly: use the canvas
    if (!blob) blob = await encodeWithCanvas(canvas, file);
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], renamed(file.name, EXT[blob.type]), { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;                                                         // an odd file: upload the original rather than fail
  }
}

/** The older name, kept for the callers that only give a width. */
export const shrinkImage = (file: File, maxWidth = 1920): Promise<File> => compressImage(file, { maxWidth });

/** The most a saved picture may weigh after compressing. A picture still bigger than this is refused, so a huge file never reaches the site. */
export const MAX_SAVED_BYTES = 1.5 * 1024 * 1024;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

/** A message when the (compressed) picture is too big to save, else "". */
export function savedSizeError(file: { size: number }, max = MAX_SAVED_BYTES): string {
  return file.size > max ? `This picture is still ${mb(file.size)} after shrinking, and the most allowed is ${mb(max)}. Choose a smaller picture, or export it at a lower quality or size first.` : "";
}

/** Compresses the picture, and throws when it is still too big to save. */
export async function shrinkOrRefuse(file: File, maxWidth: number, options: Omit<CompressOptions, "maxWidth"> = {}): Promise<File> {
  const out = await compressImage(file, { ...options, maxWidth });
  const bad = savedSizeError(out);
  if (bad) throw new Error(bad);
  return out;
}

/** A payment receipt: a photo or screenshot is compressed (wide enough to stay readable); a PDF goes up unchanged. */
export const compressReceipt = (file: File): Promise<File> => compressImage(file, { maxWidth: 2000, quality: 82 });
