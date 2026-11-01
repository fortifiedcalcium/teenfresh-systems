import qrcode from "qrcode-generator";
import { renderQr } from "../../supabase/functions/_shared/qrcore.ts";

/** The same QR picture the email carries (same code as the Edge Function), as a data URL for the admin preview. */
export function qrDataUrl(text) {
  const qr = qrcode(0, "H");
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const modules = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
  const { size, data } = renderQr(modules);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas.getContext("2d").putImageData(new ImageData(data, size, size), 0, 0);
  return canvas.toDataURL("image/png");
}
