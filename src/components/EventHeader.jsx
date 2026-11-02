import React from "react";
import Badge from "./Badge.jsx";
import { fmtDate, fmtDeadline, fmtTimeRange, mapsUrl } from "../lib/availability.js";
import { peso } from "../lib/payment.js";
import { InfoList, InfoRow, NoWrap } from "./InfoRow.jsx";
import { IconCalendar, IconClock, IconLink, IconLock, IconMapPin, IconPackage, IconWallet } from "./NavIcons.jsx";

/** The event's key facts as real text (never only inside a poster image). */
export default function EventHeader({ event, st, kits = [] }) {
  const fee = Number(event.registration_fee);
  const paid = fee > 0 || kits.length > 0;
  return (
    <header className="card p-4">
      <h2 className="text-2xl">{event.title}</h2>
      {event.subtitle && <p className="text-ink-muted">{event.subtitle}</p>}
      <InfoList className="mt-3 text-ink sm:grid-cols-2 sm:gap-x-6">
        <InfoRow icon={<IconCalendar />} label="Date:">{fmtDate(event.event_date)}</InfoRow>
        <InfoRow icon={<IconClock />} label="Time:">{fmtTimeRange(event.event_date, event.ends_at)}</InfoRow>
        <InfoRow icon={<IconMapPin />} label="Venue:" className="sm:col-span-2">{[event.venue, event.venue_address].filter(Boolean).join(", ")} {(event.venue || event.venue_address) && <a href={mapsUrl(event)} target="_blank" rel="noopener noreferrer">Open in Google Maps{" "}<span className="sr-only">(opens in a new tab)</span></a>}</InfoRow>
        {kits.length > 0 ? (
          <InfoRow icon={<IconPackage />} label="Kits:" className="sm:col-span-2" note={event.fee_note ? `Prices are ${event.fee_note}.` : null}>
            <span className="block">{kits.map((k) => <span key={k.id} className="block">{k.name}: <NoWrap>{peso(k.unit_price)}</NoWrap></span>)}</span>
          </InfoRow>
        ) : fee > 0 && <InfoRow icon={<IconWallet />} label="Pre-registration fee:"><NoWrap>{peso(fee)}</NoWrap>{event.fee_note ? ` (${event.fee_note})` : ""}</InfoRow>}
        {paid && <InfoRow icon={<IconWallet />} label="Mode of payment:">GCash only</InfoRow>}
        {event.registration_deadline && <InfoRow icon={<IconLock />} label="Registration deadline:">{fmtDeadline(event.registration_deadline)}</InfoRow>}
        {event.hashtags?.length > 0 && <InfoRow icon={<IconLink />} label="Hashtags:">{event.hashtags.join(" ")}</InfoRow>}
      </InfoList>
      <p className="mt-3 flex flex-wrap items-center gap-2">
        {paid && <strong className="text-lg">1 Form = 1 Entry</strong>}
        {st?.canRegister && st.slotsLeft > 0 && <Badge tone="warn">LIMITED SLOTS ONLY! {st.slotsLeft} left</Badge>}
      </p>
      <p className="mt-3 text-sm text-ink-muted">* Indicates required question</p>
    </header>
  );
}
