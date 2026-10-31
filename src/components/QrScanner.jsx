import React, { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

/** Camera QR scanner (needs HTTPS or localhost). Calls onScan(text) for each code, ignoring the same
 *  code again for `cooldownMs` so one ticket held in front of the camera is not processed 20 times. */
export default function QrScanner({ onScan, paused = false, cooldownMs = 3000 }) {
  const regionId = "qr-region";
  const scanner = useRef(null);
  const last = useRef({ text: "", at: 0 });
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [torch, setTorch] = useState({ supported: false, on: false });

  onScanRef.current = onScan;
  pausedRef.current = paused;

  const stop = useCallback(async () => {
    const s = scanner.current;
    if (!s) return;
    try { if (s.isScanning) await s.stop(); s.clear(); } catch { /* already stopped */ }
    scanner.current = null;
    setRunning(false);
    setTorch({ supported: false, on: false });
  }, []);

  const start = useCallback(async (id) => {
    setError("");
    await stop();
    try {
      const s = new Html5Qrcode(regionId, { verbose: false });
      scanner.current = s;
      await s.start(
        id ? { deviceId: { exact: id } } : { facingMode: "environment" },
        { fps: 10, qrbox: (w, h) => { const m = Math.floor(Math.min(w, h) * 0.75); return { width: m, height: m }; } },
        (text) => {
          const now = Date.now();
          if (pausedRef.current) return;
          if (text === last.current.text && now - last.current.at < cooldownMs) return;
          last.current = { text, at: now };
          onScanRef.current(text);
        },
        () => {},
      );
      setRunning(true);
      try { setTorch({ supported: !!s.getRunningTrackCameraCapabilities().torchFeature().isSupported(), on: false }); } catch { /* no torch API */ }
    } catch (e) {
      scanner.current = null;
      setError(/permission|denied|NotAllowed/i.test(String(e)) ? "Camera permission was denied. Allow camera access in your browser settings, then try again." : `Could not start the camera: ${e?.message || e}`);
    }
  }, [stop, cooldownMs]);

  useEffect(() => {
    // Browsers without camera APIs (or insecure origins) throw here; the manual check-in form still works
    try { Html5Qrcode.getCameras().then((list) => { setCameras(list); }).catch(() => {}); } catch { /* no camera support */ }
    return () => { stop(); };
  }, [stop]);

  const toggleTorch = async () => {
    try {
      const f = scanner.current.getRunningTrackCameraCapabilities().torchFeature();
      await f.apply(!torch.on);
      setTorch((t) => ({ ...t, on: !t.on }));
    } catch { setError("This camera does not support the torch."); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="camera-select" className="sr-only">Camera</label>
        <select id="camera-select" className="input max-w-xs" value={cameraId} onChange={(e) => { setCameraId(e.target.value); if (running) start(e.target.value); }}>
          <option value="">Back camera (default)</option>
          {cameras.map((c, i) => <option key={c.id} value={c.id}>{c.label || `Camera ${i + 1}`}</option>)}
        </select>
        {running ? <button className="btn-secondary" onClick={stop}>Stop camera</button> : <button className="btn-primary" onClick={() => start(cameraId)}>Start camera</button>}
        {torch.supported && <button className="btn-secondary" onClick={toggleTorch} aria-pressed={torch.on}>Torch: {torch.on ? "on" : "off"}</button>}
      </div>
      {error && <div role="alert" className="alert alert-bad block"><p className="font-semibold">{error}</p><p>You can still check people in with the <a href="#manual-checkin">manual check-in form</a> below.</p></div>}
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-xl border-2 border-ink bg-brand-sky" style={{ minHeight: running ? undefined : 120 }} role="group" aria-label="Camera preview">
        {!running && !error && <p className="p-8 text-center text-ink">The camera is off. Press “Start camera”, or use manual check-in below.</p>}
        {/* html5-qrcode rewrites everything inside this element, so React must never render children into it
            (that made React crash with "removeChild" when the camera started). The text above is a sibling. */}
        <div id={regionId} className="[&_video]:w-full" />
      </div>
    </div>
  );
}
