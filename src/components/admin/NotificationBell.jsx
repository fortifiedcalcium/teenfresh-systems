import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { NOTE_TYPES, pendingNotes, totalUnread } from "../../lib/notifications.js";
import { setSoundEnabled, soundEnabled } from "../../lib/chime.js";
import { IconBell } from "../NavIcons.jsx";

/** The notification button: a bell with the number of NEW things, and a list that links to where each is handled.
 *  Opening an item (or the page it leads to) marks it read, and its counter goes away until something new arrives.
 *  Things already seen but still waiting stay listed below, without a counter. New arrivals also show as a toast and play a short chime. */
export default function NotificationBell({ counts, unread, onRead, onReadAll, align = "left", iconOnly = true }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 });
  const [sound, setSound] = useState(soundEnabled);
  const btn = useRef(null);
  const panel = useRef(null);
  const id = useId();
  const waiting = pendingNotes(counts);
  const fresh = waiting.filter((n) => (unread?.[n.key] || 0) > 0);
  const seen = waiting.filter((n) => !((unread?.[n.key] || 0) > 0));
  const total = totalUnread(unread);

  const toggle = () => {
    if (!open && btn.current) {
      const r = btn.current.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 16);
      const left = align === "right" ? r.right - width : r.left;
      setPos({ top: r.bottom + 8, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)), width });
    }
    setOpen((o) => !o);
  };
  const flip = () => { const on = !sound; setSound(on); setSoundEnabled(on); };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    const onDown = (e) => { if (!panel.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [open]);

  const go = (n) => { onRead?.([n.key]); setOpen(false); };
  return (
    <>
      <button ref={btn} type="button" className="btn-secondary relative min-w-target px-2" aria-expanded={open} aria-controls={id}
        aria-label={total > 0 ? `Notifications, ${total} new` : "Notifications, nothing new"} onClick={toggle}>
        <IconBell />
        {!iconOnly && <span>Notifications</span>}
        {total > 0 && <span aria-hidden="true" className="notif-badge">{total > 99 ? "99+" : total}</span>}
      </button>
      {open && createPortal(
        <div ref={panel} id={id} role="region" aria-label="Notifications" className="notif-panel" style={{ top: pos.top, left: pos.left, width: pos.width }}>
          <h2 className="notif-title">{total > 0 ? "New" : "No new notifications"}</h2>
          {fresh.length > 0 && (
            <ul>
              {fresh.map((n) => (
                <li key={n.key}>
                  <Link to={n.to} className="notif-item" onClick={() => go(n)}>
                    <span className="notif-count" aria-hidden="true">{unread[n.key]}</span>
                    <span><span className="sr-only">{unread[n.key]} new: </span>{n.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {fresh.length > 0 && <div className="px-4 pb-2"><button type="button" className="btn-secondary w-full" onClick={() => { onReadAll?.(); }}>Mark all as read</button></div>}
          {fresh.length === 0 && waiting.length === 0 && <p className="p-3 text-sm text-ink-muted">Nothing needs your attention right now.</p>}
          {seen.length > 0 && (
            <>
              <h3 className="notif-sub">Still waiting (already seen)</h3>
              <ul>
                {seen.map((n) => (
                  <li key={n.key}><Link to={n.to} className="notif-item notif-item--seen" onClick={() => go(n)}>{n.label}</Link></li>
                ))}
              </ul>
            </>
          )}
          <label className="notif-sound">
            <input type="checkbox" role="switch" className="check" checked={sound} onChange={flip} />
            <span>Play a sound for new notifications</span>
          </label>
        </div>,
        document.body,
      )}
    </>
  );
}
export { NOTE_TYPES };
