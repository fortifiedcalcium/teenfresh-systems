<script setup>
import qrcode from "qrcode-generator";
import qrLogo from "~/assets/logo/qr-logo.png";

// The Teenfresh wordmark sits in the middle of every QR code. Level H (30% error correction) leaves plenty of room:
// the logo plate covers under 10% of the symbol, and the scan test decodes it.
const LOGO_RATIO = 128 / 600;

// The QR payload is just the ticket number: the server looks it up, so a forged QR proves nothing.
// The ticket number is printed beside it, which is the text alternative (1.1.1).
const props = defineProps({ ticketNumber: { type: String, required: true }, size: { type: Number, default: 220 } });

const qr = computed(() => {
  const q = qrcode(0, "H");
  q.addData(props.ticketNumber, "Byte");
  q.make();
  const n = q.getModuleCount();
  const cell = props.size / n;
  const logoW = Math.round(props.size * 0.4), logoH = Math.round(props.size * 0.4 * LOGO_RATIO);
  const x0 = (props.size - logoW) / 2, y0 = (props.size - logoH) / 2;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!q.isDark(r, c)) continue;
    const x = c * cell, y = r * cell;
    // "excavate": the modules under the logo are left out, so the logo sits on clean white
    if (x + cell > x0 && x < x0 + logoW && y + cell > y0 && y < y0 + logoH) continue;
    d += `M${x} ${y}h${cell}v${cell}h${-cell}z`;
  }
  return { d, logoW, logoH, x0, y0 };
});
</script>

<template>
  <figure class="inline-flex flex-col items-center gap-2" :aria-label="`Ticket QR code for ${ticketNumber}`">
    <div class="rounded-xl border-2 border-ink bg-white p-3 text-ink" role="img" :aria-label="`QR code. Ticket number ${ticketNumber}`">
      <svg :viewBox="`0 0 ${size} ${size}`" :width="size" :height="size" aria-hidden="true" shape-rendering="crispEdges">
        <path :d="qr.d" fill="currentColor" />
        <image :href="qrLogo" :x="qr.x0" :y="qr.y0" :width="qr.logoW" :height="qr.logoH" />
      </svg>
    </div>
    <figcaption class="font-mono text-lg font-bold tracking-wider">{{ ticketNumber }}</figcaption>
  </figure>
</template>
