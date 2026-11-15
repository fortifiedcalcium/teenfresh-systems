// A short, soft two-note chime for a new notification, made in the browser (no audio file). Under a second, so it needs no stop button,
// and the admin can switch it off in the bell's list. Browsers only allow sound after the person has clicked or pressed a key once,
// so we unlock it on the first interaction; before that it stays silent instead of failing.
// Each audience has its own switch: an admin and a shopper may be the same person on one browser but want different things.
const KEYS = { admin: "admin_notify_sound", shopper: "shopper_notify_sound" };
let ctx = null;

export const soundEnabled = (who = "admin") => { try { return localStorage.getItem(KEYS[who]) !== "off"; } catch { return true; } };
export const setSoundEnabled = (on, who = "admin") => { try { localStorage.setItem(KEYS[who], on ? "on" : "off"); } catch { /* private mode: it lasts until the page closes */ } };

const audio = () => {
  if (ctx) return ctx;
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try { ctx = new AC(); } catch { ctx = null; }
  return ctx;
};

/** Call once: the first click or key press lets the browser play sound later. */
export function unlockChime() {
  if (typeof window === "undefined") return () => {};
  const go = () => { const c = audio(); if (c && c.state === "suspended") c.resume?.().catch?.(() => {}); };
  const opts = { once: true, passive: true };
  window.addEventListener("pointerdown", go, opts);
  window.addEventListener("keydown", go, opts);
  return () => { window.removeEventListener("pointerdown", go); window.removeEventListener("keydown", go); };
}

/** Plays the chime if sound is on (for `who`) and the browser allows it. Never throws. */
export function playChime(who = "admin") {
  if (!soundEnabled(who)) return false;
  const c = audio();
  if (!c || c.state === "suspended") return false;
  try {
    const t0 = c.currentTime;
    [[880, 0], [1174.66, 0.16]].forEach(([freq, at]) => {
      const osc = c.createOscillator(); const gain = c.createGain();
      osc.type = "sine"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + at + 0.02);       // quiet, not startling
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.3);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(t0 + at); osc.stop(t0 + at + 0.32);
    });
    return true;
  } catch { return false; }
}
