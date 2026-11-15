// Admin pictures are shrunk in the browser before they are uploaded: a 6 MB camera photo becomes a few hundred KB, so the pages that show it
// load fast. The picture is scaled down to `maxWidth` (never up) and saved as WebP. If that does not make the file smaller, the original is kept.
// QR codes and anything else that must stay pixel-exact is uploaded as it is (pass `shrink: false`).

export const SHRINK_QUALITY = 0.82;
const EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
export const SKIP_BELOW_BYTES = 200 * 1024;          // a file this small is not worth touching

/** The size to draw at: scaled down so the width is at most `max`, keeping the ratio; never larger than the original. */
export function fitWidth(width: number, height: number, max: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 1, height: 1 };
  if (width <= max) return { width, height };
  return { width: max, height: Math.max(1, Math.round((height * max) / width)) };
}

/** Is there anything to gain? Small files that already fit are left alone. */
export const worthShrinking = (bytes: number, width: number, max: number): boolean => bytes > SKIP_BELOW_BYTES || width > max;

/** The file name with a new extension (a.b.jpg -> a.b.webp). */
export const renamed = (name: string, ext: string): string => `${name.replace(/\.[^./\\]+$/, "") || "image"}.${ext}`;

/** Returns a smaller WebP version of the picture, or the same file when shrinking would not help or the browser cannot do it. */
export async function shrinkImage(file: File, maxWidth = 1920): Promise<File> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);                       // honours the photo's rotation
    if (!worthShrinking(file.size, bitmap.width, maxWidth)) { bitmap.close(); return file; }
    const { width, height } = fitWidth(bitmap.width, bitmap.height, maxWidth);
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close(); return file; }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const toBlob = (type: string): Promise<Blob | null> => new Promise((resolve) => canvas.toBlob(resolve, type, SHRINK_QUALITY));
    // WebP first. Safari cannot encode WebP and quietly gives a PNG instead; then a JPEG photo is saved as a JPEG (a PNG stays a PNG, to keep any
    // transparency), still at the smaller size.
    let blob = await toBlob("image/webp");
    if (!blob || blob.type !== "image/webp") blob = await toBlob(file.type === "image/jpeg" ? "image/jpeg" : "image/png");
    if (!blob || !EXT[blob.type] || blob.size >= file.size) return file;
    return new File([blob], renamed(file.name, EXT[blob.type]), { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;                                                         // an odd file: upload the original rather than fail
  }
}

/** The most a saved picture may weigh after shrinking. A picture still bigger than this is refused, so a huge file never reaches the site. */
export const MAX_SAVED_BYTES = 1.5 * 1024 * 1024;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

/** A message when the (shrunk) picture is too big to save, else "". */
export function savedSizeError(file: { size: number }, max = MAX_SAVED_BYTES): string {
  return file.size > max ? `This picture is still ${mb(file.size)} after shrinking, and the most allowed is ${mb(max)}. Choose a smaller picture, or export it at a lower quality or size first.` : "";
}

/** Shrinks the picture, and throws when it is still too big to save. */
export async function shrinkOrRefuse(file: File, maxWidth: number): Promise<File> {
  const out = await shrinkImage(file, maxWidth);
  const bad = savedSizeError(out);
  if (bad) throw new Error(bad);
  return out;
}
