// Short success / error tones with the Web Audio API (no audio files needed).
let ctx;
function tone(freq, start, dur, type = "sine") {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur + 0.02);
}

export function feedback(kind) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (kind === "success") { tone(880, 0, 0.12); tone(1320, 0.13, 0.18); }
    else if (kind === "duplicate") { tone(520, 0, 0.15); tone(520, 0.2, 0.15); }
    else tone(180, 0, 0.45, "square");
  } catch { /* audio blocked: ignore */ }
  try { navigator.vibrate?.(kind === "success" ? 80 : [120, 60, 120]); } catch { /* not supported */ }
}
