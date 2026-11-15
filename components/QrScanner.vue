<script setup lang="ts">
import { Html5Qrcode } from "html5-qrcode";

// Camera QR scanner (needs HTTPS or localhost). Emits `scan` (text) for each code, ignoring the same
// code again for `cooldownMs` so one ticket held in front of the camera is not processed 20 times.
const props = defineProps({ paused: Boolean, cooldownMs: { type: Number, default: 3000 } });
const emit = defineEmits(["scan"]);
const regionId = "qr-region";
let scanner = null;
let last = { text: "", at: 0 };
const cameras = ref([]);
const cameraId = ref("");
const running = ref(false);
const error = ref("");
const torch = ref({ supported: false, on: false });

async function stop() {
  const s = scanner;
  if (!s) return;
  try { if (s.isScanning) await s.stop(); s.clear(); } catch { /* already stopped */ }
  scanner = null;
  running.value = false;
  torch.value = { supported: false, on: false };
}

async function start(id) {
  error.value = "";
  await stop();
  try {
    const s = new Html5Qrcode(regionId, { verbose: false });
    scanner = s;
    await s.start(
      id ? { deviceId: { exact: id } } : { facingMode: "environment" },
      { fps: 10, qrbox: (w, h) => { const m = Math.floor(Math.min(w, h) * 0.75); return { width: m, height: m }; } },
      (text) => {
        const now = Date.now();
        if (props.paused) return;
        if (text === last.text && now - last.at < props.cooldownMs) return;
        last = { text, at: now };
        emit("scan", text);
      },
      () => {},
    );
    running.value = true;
    try { torch.value = { supported: !!s.getRunningTrackCameraCapabilities().torchFeature().isSupported(), on: false }; } catch { /* no torch API */ }
  } catch (e) {
    scanner = null;
    error.value = /permission|denied|NotAllowed/i.test(String(e)) ? "Camera permission was denied. Allow camera access in your browser settings, then try again." : `Could not start the camera: ${e?.message || e}`;
  }
}

onMounted(() => {
  // Browsers without camera APIs (or insecure origins) throw here; the manual check-in form still works
  try { Html5Qrcode.getCameras().then((list) => { cameras.value = list; }).catch(() => {}); } catch { /* no camera support */ }
});
onBeforeUnmount(() => { stop(); });

async function toggleTorch() {
  try {
    const f = scanner.getRunningTrackCameraCapabilities().torchFeature();
    await f.apply(!torch.value.on);
    torch.value = { ...torch.value, on: !torch.value.on };
  } catch { error.value = "This camera does not support the torch."; }
}
const pickCamera = (e) => { cameraId.value = e.target.value; if (running.value) start(cameraId.value); };
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <label for="camera-select" class="sr-only">Camera</label>
      <select id="camera-select" class="input max-w-xs" :value="cameraId" @change="pickCamera">
        <option value="">Back camera (default)</option>
        <option v-for="(c, i) in cameras" :key="c.id" :value="c.id">{{ c.label || `Camera ${Number(i) + 1}` }}</option>
      </select>
      <button v-if="running" type="button" class="btn-secondary" @click="stop"><IconCameraOff />Stop camera</button>
      <button v-else type="button" class="btn-primary" @click="start(cameraId)"><IconCamera />Start camera</button>
      <button v-if="torch.supported" type="button" class="btn-secondary" :aria-pressed="torch.on" @click="toggleTorch"><IconZap />Torch: {{ torch.on ? "on" : "off" }}</button>
    </div>
    <div v-if="error" role="alert" class="alert alert-bad block"><p class="font-semibold">{{ error }}</p><p>You can still check people in with the <a href="#manual-checkin">manual check-in form</a> below.</p></div>
    <div class="w-full overflow-hidden border-2 border-ink bg-brand-sky max-md:-mx-4 max-md:w-auto max-md:rounded-none max-md:border-x-0 sm:max-md:-mx-5 md:mx-auto md:max-w-xl md:rounded-xl" :style="{ minHeight: running ? undefined : '120px' }" role="group" aria-label="Camera preview">
      <p v-if="!running && !error" class="p-8 text-center text-ink">The camera is off. Press “Start camera”, or use manual check-in below.</p>
      <!-- html5-qrcode rewrites everything inside this element, so Vue must never render children into it. The text above is a sibling. -->
      <div :id="regionId" class="[&_video]:w-full" />
    </div>
  </div>
</template>
