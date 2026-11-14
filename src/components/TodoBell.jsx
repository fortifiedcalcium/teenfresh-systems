import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { requiredCount } from "../lib/orderTodos.js";
import { setSoundEnabled, soundEnabled } from "../lib/chime.js";
import { usePopover } from "../hooks/usePopover.js";
import { IconBell } from "./NavIcons.jsx";

/** The shopper's notification button: a bell with the number of things waiting on them, and a list of what to do, each linking to its order.
 *  It is the same list as "What you need to do" on My orders. A new one also shows as a toast with a short chime (see AttendeeLayout). */
export default function TodoBell({ todos }) {
  const { open, toggle, close, btn, panel, pos, id } = usePopover("right");
  const [sound, setSound] = useState(() => soundEnabled("shopper"));
  const list = todos || [];
  const n = requiredCount(list);
  const flip = () => { const on = !sound; setSound(on); setSoundEnabled(on, "shopper"); };

  return (
    <>
      <button ref={btn} type="button" className="nav-link relative" aria-expanded={open} aria-controls={id} title="Notifications"
        aria-label={n > 0 ? `Notifications, ${n} for you to do` : "Notifications, nothing for you to do"} onClick={toggle}>
        <IconBell />
        {n > 0 && <span aria-hidden="true" className="notif-badge">{n > 99 ? "99+" : n}</span>}
      </button>
      {open && createPortal(
        <div ref={panel} id={id} role="region" aria-label="Notifications" className="notif-panel" style={{ top: pos.top, left: pos.left, width: pos.width }}>
          <h2 className="notif-title">What you need to do</h2>
          {list.length === 0 ? <p className="p-3 text-sm text-ink-muted">You are all set. Nothing is waiting on you right now.</p> : (
            <ul>
              {list.map((t) => (
                <li key={t.key}>
                  <Link to={t.to} className="notif-item notif-item--todo" onClick={close}>
                    <span className="text-xs font-semibold text-ink-muted">Order {t.orderNumber}{t.required ? "" : " · optional"}</span>
                    <span className="font-bold">{t.text}</span>
                    {t.note && <span className="text-xs font-normal">{t.note}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <label className="notif-sound">
            <input type="checkbox" role="switch" className="check" checked={sound} onChange={flip} />
            <span>Play a sound when something new needs me</span>
          </label>
        </div>,
        document.body,
      )}
    </>
  );
}
