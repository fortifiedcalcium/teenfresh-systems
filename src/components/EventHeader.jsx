import React from "react";
import Badge from "./Badge.jsx";
import { fmtDate, fmtDeadline, fmtTimeRange, mapsUrl } from "../lib/availability.js";
import { peso } from "../lib/payment.js";
import { IconCalendar, IconClock, IconLink, IconLock, IconMapPin, IconPackage, IconWallet } from "./NavIcons.jsx";

/** The event's key facts as real text (never only inside a poster image). */
export default function EventHeader({ event, st, kits = [] }) {
  const fee = Number(event.registration_fee);
  const paid = fee > 0 || kits.length > 0;
  return (
    <header className="card p-4">
      <h2 className="text-2xl">{event.title}</h2>
      {event.subtitle && <p className="text-ink-muted">{event.subtitle}</p>}
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-2"><dt className="inline-flex items-center gap-1.5 font-semibold"><IconCalendar />Date:</dt><dd>{fmtDate(event.event_date)}</dd></div>
        <div className="flex gap-2"><dt className="inline-flex items-center gap-1.5 font-semibold"><IconClock />Time:</dt><dd>{fmtTimeRange(event.event_date, event.ends_at)}</dd></div>
        <div className="flex gap-2 sm:col-span-2"><dt className="inline-flex items-center gap-1.5 font-semibold"><IconMapPin />Venue:</dt><dd>{[event.venue, event.venue_address].filter(Boolean).join(", ")} {(event.venue || event.venue_address) && <a href={mapsUrl(event)} target="_blank" rel="noopener noreferrer">Open in Google Maps{" "}<span className="sr-only">(opens in a new tab)</span></a>}</dd></div>
        {kits.length > 0 ? (
          <div className="flex gap-2 sm:col-span-2"><dt className="inline-flex items-center gap-1.5 font-semibold"><IconPackage />Kits:</dt><dd><ul>{kits.map((k) => <li key={k.id}>{k.name}: {peso(k.unit_price)}</li>)}</ul>{event.fee_note && <span className="text-ink-muted">Prices are {event.fee_note}.</span>}</dd></div>
        ) : fee > 0 && <div className="flex gap-2"><dt className="inline-flex items-center gap-1.5 font-semibold"><IconWallet />Pre-registration fee:</dt><dd>{peso(fee)}{event.fee_note ? ` (${event.fee_note})` : ""}</dd></div>}
        {paid && <div className="flex gap-2"><dt className="inline-flex items-center gap-1.5 font-semibold"><IconWallet />Mode of payment:</dt><dd>GCash only</dd></div>}
        {event.registration_deadline && <div className="flex gap-2"><dt className="inline-flex items-center gap-1.5 font-semibold"><IconLock />Registration deadline:</dt><dd>{fmtDeadline(event.registration_deadline)}</dd></div>}
        {event.hashtags?.length > 0 && <div className="flex gap-2"><dt className="inline-flex items-center gap-1.5 font-semibold"><IconLink />Hashtags:</dt><dd>{event.hashtags.join(" ")}</dd></div>}
      </dl>
      <p className="mt-3 flex flex-wrap items-center gap-2">
        {paid && <strong className="text-lg">1 Form = 1 Entry</strong>}
        {st?.canRegister && st.slotsLeft > 0 && <Badge tone="warn">LIMITED SLOTS ONLY! {st.slotsLeft} left</Badge>}
      </p>
      <p className="mt-3 text-sm text-ink-muted">* Indicates required question</p>
    </header>
  );
}
