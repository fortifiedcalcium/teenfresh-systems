// Pure TypeScript (no Deno or DOM APIs) so the Edge Functions AND the browser preview draw the same QR code.
// Input: the QR modules (true = dark). Output: RGBA pixels with the Teenfresh logo in the middle.
// Error correction level H (30%) is used by the callers; the logo plate hides well under 10% of the symbol.
import { QR_LOGO } from "./qrLogo.ts";

export const QR_DARK = [0x17, 0x30, 0x3f]; // --ink: dark navy, 12:1 on white
const QUIET = 4;                            // quiet zone in modules (the QR spec asks for 4)

const b64 = (s: string): Uint8Array => {
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
let logoCache: Uint8Array | null = null;

/** Bilinear resample of the straight-alpha logo, done in premultiplied space so edges do not get dark fringes. */
function resizedLogo(w: number, h: number): Uint8ClampedArray {
  const src = (logoCache ??= b64(QR_LOGO.rgba));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(QR_LOGO.h - 1, Math.max(0, (y + 0.5) * QR_LOGO.h / h - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(QR_LOGO.h - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(QR_LOGO.w - 1, Math.max(0, (x + 0.5) * QR_LOGO.w / w - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(QR_LOGO.w - 1, x0 + 1), tx = fx - x0;
      let r = 0, g = 0, b = 0, a = 0;
      for (const [xx, yy, wt] of [[x0, y0, (1 - tx) * (1 - ty)], [x1, y0, tx * (1 - ty)], [x0, y1, (1 - tx) * ty], [x1, y1, tx * ty]] as const) {
        const i = (yy * QR_LOGO.w + xx) * 4, al = src[i + 3] / 255;
        r += src[i] * al * wt; g += src[i + 1] * al * wt; b += src[i + 2] * al * wt; a += al * wt;
      }
      const o = (y * w + x) * 4;
      out[o] = a ? r / a : 0; out[o + 1] = a ? g / a : 0; out[o + 2] = a ? b / a : 0; out[o + 3] = a * 255;
    }
  }
  return out;
}

export interface QrImage { size: number; data: Uint8ClampedArray }

/** modules: square matrix of booleans. target: approximate image width in pixels. withLogo: draw the logo plate. */
export function renderQr(modules: boolean[][], { target = 480, withLogo = true } = {}): QrImage {
  const n = modules.length;
  const scale = Math.max(4, Math.floor(target / (n + QUIET * 2)));
  const size = (n + QUIET * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!modules[r][c]) continue;
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
      const o = (((r + QUIET) * scale + y) * size + (c + QUIET) * scale + x) * 4;
      data[o] = QR_DARK[0]; data[o + 1] = QR_DARK[1]; data[o + 2] = QR_DARK[2];
    }
  }
  if (!withLogo) return { size, data };

  const symbol = n * scale;
  const lw = Math.round(symbol * 0.4), lh = Math.round(lw * QR_LOGO.h / QR_LOGO.w);
  const pad = scale;                                    // white plate: one module of space around the logo
  const pw = lw + pad * 2, ph = lh + pad * 2;
  const px = Math.round((size - pw) / 2), py = Math.round((size - ph) / 2);
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const o = ((py + y) * size + px + x) * 4;
    data[o] = data[o + 1] = data[o + 2] = 255;
  }
  const logo = resizedLogo(lw, lh);
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    const i = (y * lw + x) * 4, a = logo[i + 3] / 255;
    if (!a) continue;
    const o = ((py + pad + y) * size + px + pad + x) * 4;
    for (let k = 0; k < 3; k++) data[o + k] = Math.round(logo[i + k] * a + data[o + k] * (1 - a));
  }
  return { size, data };
}
