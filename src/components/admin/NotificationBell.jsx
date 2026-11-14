import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { pendingNotes, totalNeeding } from "../../lib/notifications.js";
import { IconBell } from "../NavIcons.jsx";

/** The notification button: a bell with the number of things waiting for an admin, and a list of them that links to where each is handled.
 *  New arrivals also show as a toast (see AdminLayout). `align` says which edge of the button the list lines up with. */
export default function NotificationBell({ counts, align = "left", iconOnly = true }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 });
  const btn = useRef(null);
  const panel = useRef(null);
  const id = useId();
  const notes = pendingNotes(counts);
  const total = totalNeeding(counts);

  const toggle = () => {
    if (!open && btn.current) {
      const r = btn.current.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 16);
      const left = align === "right" ? r.right - width : r.left;
      setPos({ top: r.bottom + 8, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)), width });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    const onDown = (e) => { if (!panel.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [open]);

  return (
    <>
      <button ref={btn} type="button" className="btn-secondary relative min-w-target px-2" aria-expanded={open} aria-controls={id}
        aria-label={total > 0 ? `Notifications, ${total} waiting for you` : "Notifications, nothing waiting"} onClick={toggle}>
        <IconBell />
        {!iconOnly && <span>Notifications</span>}
        {total > 0 && <span aria-hidden="true" className="notif-badge">{total > 99 ? "99+" : total}</span>}
      </button>
      {open && createPortal(
        <div ref={panel} id={id} role="region" aria-label="Notifications" className="notif-panel" style={{ top: pos.top, left: pos.left, width: pos.width }}>
          <h2 className="notif-title">{total > 0 ? "Waiting for you" : "All caught up"}</h2>
          {notes.length === 0 ? <p className="p-3 text-sm text-ink-muted">Nothing needs your attention right now.</p> : (
            <ul>
              {notes.map((n) => (
                <li key={n.key}>
                  <Link to={n.to} className="notif-item" onClick={() => setOpen(false)}>
                    <span className="notif-count" aria-hidden="true">{n.count}</span>
                    <span><span className="sr-only">{n.count} </span>{n.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
