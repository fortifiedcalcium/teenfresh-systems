import React, { useEffect, useRef, useState } from "react";
import { useAnnounce } from "../a11y.jsx";

/** Copies text and says so out loud: the live region announces "copied", and the label changes for everyone else. */
export default function CopyButton({ text, label = "Copy number", what = "GCash number" }) {
  const announce = useAnnounce();
  const [state, setState] = useState("idle"); // idle | copied | failed
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      try { // older browsers / insecure origins
        const ta = Object.assign(document.createElement("textarea"), { value: text });
        ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); ok = document.execCommand("copy"); ta.remove();
      } catch { ok = false; }
    }
    setState(ok ? "copied" : "failed");
    announce(ok ? `${what} copied to the clipboard` : `Could not copy the ${what}. Select it and copy it by hand.`, ok ? "polite" : "assertive");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 4000);
  };

  return (
    <button type="button" className="btn-secondary" onClick={copy}>
      {state === "copied" ? <><span aria-hidden="true">✓</span> Copied</> : state === "failed" ? "Copy failed" : label}
    </button>
  );
}
