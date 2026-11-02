import React from "react";
import { Link } from "react-router-dom";
import AvailabilityBar from "./AvailabilityBar.jsx";
import Badge from "./Badge.jsx";
import EventImage from "./EventImage.jsx";
import { eventStatus, fmtDate, fmtDeadline, fmtTimeRange, STATUS_TONE } from "../lib/availability.js";
import { peso, priceBounds } from "../lib/payment.js";
import { InfoList, InfoRow, NoWrap } from "./InfoRow.jsx";
import { IconCalendar, IconClock, IconLock, IconMapPin, IconPackage, IconTicket, IconWallet } from "./NavIcons.jsx";

/** "₱100.00 each", "₱100.00 to ₱250.00 each" (wraps only at "to"), or just "₱100.00" for a single kit */
export function KitPrices({ kits }) {
  const b = priceBounds(kits);
  if (!b) return null;
  if (kits.length === 1) return <NoWrap>{b.lo}</NoWrap>;
  return b.hi ? <><NoWrap>{b.lo}</NoWrap> to <NoWrap>{b.hi} each</NoWrap></> : <NoWrap>{b.lo} each</NoWrap>;
}

export default function EventCard({ event, registered, bannerImage, onChanged, kits = [] }) {
  const st = eventStatus(event, registered);
  const explainId = `explain-${event.id}`;
  const fee = Number(event.registration_fee);
  const slotsText = st.key === "closed" ? "Registration is closed" : `${st.slotsLeft} of ${event.capacity} slots left`;
  return (
    <article className="card flex h-full w-full flex-col overflow-hidden" aria-labelledby={`title-${event.id}`}>
      <EventImage slot="banner" event={event} image={bannerImage} onChanged={onChanged} lightbox={false} fit="cover" className="!rounded-none !border-0" />
      <div className="flex flex-1 flex-col p-4">
        <div className={`flex items-start justify-between gap-3 ${event.subtitle ? "mb-1" : "mb-4"}`}>
          <h2 id={`title-${event.id}`} className="line-clamp-2 min-w-0 flex-1 text-lg font-black leading-snug" title={event.title}>{event.title}</h2>
          <Badge tone={STATUS_TONE[st.key]}>{st.label}</Badge>
        </div>
        {event.subtitle && <p className="mb-4 line-clamp-2 text-sm text-ink-muted" title={event.subtitle}>{event.subtitle}</p>}
        <InfoList>
          <InfoRow icon={<IconCalendar />} label="Date:">{fmtDate(event.event_date)}</InfoRow>
          <InfoRow icon={<IconClock />} label="Time:">{fmtTimeRange(event.event_date, event.ends_at)}</InfoRow>
          {event.venue && <InfoRow icon={<IconMapPin />} label="Venue:">{event.venue}</InfoRow>}
          {kits.length > 0
            ? <InfoRow icon={<IconPackage />} label="Kits:" note={event.fee_note ? `(${event.fee_note})` : null}><KitPrices kits={kits} /></InfoRow>
            : <InfoRow icon={<IconWallet />} label="Fee:" note={fee > 0 && event.fee_note ? `(${event.fee_note})` : null}>{fee > 0 ? <NoWrap>{peso(fee)}</NoWrap> : event.price_info || "Free"}</InfoRow>}
          {event.registration_deadline && <InfoRow icon={<IconLock />} label="Registration closes:">{fmtDeadline(event.registration_deadline)}</InfoRow>}
        </InfoList>
        <div className="mt-auto space-y-2 pt-4">
          <AvailabilityBar registered={registered} capacity={event.capacity} label={`Slots taken for ${event.title}`} />
          <p className="text-sm font-semibold text-ink">{slotsText}</p>
          {st.canRegister ? (
            <Link to={`/events/${event.id}/register`} className="btn-primary w-full" aria-label={`Register for ${event.title}`}><IconTicket />Register</Link>
          ) : (
            <>
              <button type="button" className="btn-primary w-full" aria-disabled="true" aria-describedby={explainId} onClick={(e) => e.preventDefault()}><IconTicket />Register</button>
              <p id={explainId} className="text-sm text-danger">Registration is unavailable. {st.reason}</p>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
