// Deno only: QR code as a PNG (with the Teenfresh logo in the middle), for the emailed ticket.
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";
import { renderQr } from "./qrcore.ts";

export function qrModules(text: string): boolean[][] {
  const qr = qrcode(0, "H");           // type 0 = smallest version that fits; H = 30% error correction (room for the logo)
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const u32 = (n: number) => new Uint8Array([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const chunk = (type: string, body: Uint8Array) => {
  const t = new TextEncoder().encode(type);
  const td = new Uint8Array(t.length + body.length); td.set(t); td.set(body, t.length);
  return [u32(body.length), td, u32(crc32(td))];
};
const concat = (parts: Uint8Array[]) => { const o = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let i = 0; for (const p of parts) { o.set(p, i); i += p.length; } return o; };

/** Minimal PNG writer (RGB, 8 bit, zlib via CompressionStream). */
export async function encodePng(size: number, rgba: Uint8ClampedArray): Promise<Uint8Array> {
  const raw = new Uint8Array(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4, d = y * (size * 3 + 1) + 1 + x * 3;
      raw[d] = rgba[s]; raw[d + 1] = rgba[s + 1]; raw[d + 2] = rgba[s + 2];
    }
  }
  const z = new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate")));
  const idat = new Uint8Array(await z.arrayBuffer());
  const ihdr = concat([u32(size), u32(size), new Uint8Array([8, 2, 0, 0, 0])]);
  return concat([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), ...chunk("IHDR", ihdr), ...chunk("IDAT", idat), ...chunk("IEND", new Uint8Array())]);
}

export async function ticketQrPng(text: string): Promise<Uint8Array> {
  const { size, data } = renderQr(qrModules(text));
  return await encodePng(size, data);
}
