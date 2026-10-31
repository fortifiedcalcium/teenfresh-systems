import React from "react";
import Badge from "./Badge.jsx";
import { fmtDate, fmtDeadline, fmtTimeRange, mapsUrl } from "../lib/availability.js";
import { peso } from "../lib/payment.js";

/** The event's key facts as real text (never only inside a poster image). */
export default function EventHeader({ event, st }) {
  const fee = Number(event.registration_fee);
  return (
    <header className="card p-4">
      <h2 className="text-2xl">{event.title}</h2>
      {event.subtitle && <p className="text-ink-muted">{event.subtitle}</p>}
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-2"><dt className="font-semibold">Date:</dt><dd>{fmtDate(event.event_date)}</dd></div>
        <div className="flex gap-2"><dt className="font-semibold">Time:</dt><dd>{fmtTimeRange(event.event_date, event.ends_at)}</dd></div>
        <div className="flex gap-2 sm:col-span-2"><dt className="font-semibold">Venue:</dt><dd>{[event.venue, event.venue_address].filter(Boolean).join(", ")} {(event.venue || event.venue_address) && <a href={mapsUrl(event)} target="_blank" rel="noopener noreferrer">Open in Google Maps{" "}<span className="sr-only">(opens in a new tab)</span></a>}</dd></div>
        {fee > 0 && <div className="flex gap-2"><dt className="font-semibold">Pre-registration fee:</dt><dd>{peso(fee)}{event.fee_note ? ` (${event.fee_note})` : ""}</dd></div>}
        {fee > 0 && <div className="flex gap-2"><dt className="font-semibold">Mode of payment:</dt><dd>GCash only</dd></div>}
        {event.registration_deadline && <div className="flex gap-2"><dt className="font-semibold">Registration deadline:</dt><dd>{fmtDeadline(event.registration_deadline)}</dd></div>}
        {event.hashtags?.length > 0 && <div className="flex gap-2"><dt className="font-semibold">Hashtags:</dt><dd>{event.hashtags.join(" ")}</dd></div>}
      </dl>
      <p className="mt-3 flex flex-wrap items-center gap-2">
        {fee > 0 && <strong className="text-lg">1 Form = 1 Entry</strong>}
        {st?.canRegister && st.slotsLeft > 0 && <Badge tone="warn">LIMITED SLOTS ONLY! {st.slotsLeft} left</Badge>}
      </p>
      <p className="mt-3 text-sm text-ink-muted">* Indicates required question</p>
    </header>
  );
}
