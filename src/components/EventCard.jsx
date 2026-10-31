import React from "react";
import { Link } from "react-router-dom";
import AvailabilityBar from "./AvailabilityBar.jsx";
import Badge from "./Badge.jsx";
import EventImage from "./EventImage.jsx";
import { eventStatus, fmtDate, fmtDeadline, fmtTimeRange, STATUS_TONE } from "../lib/availability.js";
import { peso } from "../lib/payment.js";

export default function EventCard({ event, registered, bannerImage, onChanged }) {
  const st = eventStatus(event, registered);
  const explainId = `explain-${event.id}`;
  const fee = Number(event.registration_fee);
  const slotsText = st.key === "closed" ? "Registration is closed" : `${st.slotsLeft} of ${event.capacity} slots left`;
  return (
    <article className="card flex flex-col overflow-hidden" aria-labelledby={`title-${event.id}`}>
      <EventImage slot="banner" event={event} image={bannerImage} onChanged={onChanged} lightbox={false} fit="cover" className="!rounded-none !border-0" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`title-${event.id}`} className="min-w-0 flex-1 text-lg font-bold leading-snug">{event.title}</h2>
          <Badge tone={STATUS_TONE[st.key]}>{st.label}</Badge>
        </div>
        {event.subtitle && <p className="-mt-1 text-sm text-ink-muted">{event.subtitle}</p>}
        <dl className="space-y-1 text-sm text-ink-muted">
          <div className="flex gap-2"><dt className="font-semibold">Date:</dt><dd>{fmtDate(event.event_date)}</dd></div>
          <div className="flex gap-2"><dt className="font-semibold">Time:</dt><dd>{fmtTimeRange(event.event_date, event.ends_at)}</dd></div>
          {event.venue && <div className="flex gap-2"><dt className="font-semibold">Venue:</dt><dd>{event.venue}</dd></div>}
          <div className="flex gap-2"><dt className="font-semibold">Fee:</dt><dd>{fee > 0 ? `${peso(fee)}${event.fee_note ? ` (${event.fee_note})` : ""}` : event.price_info || "Free"}</dd></div>
          {event.registration_deadline && <div className="flex gap-2"><dt className="font-semibold">Registration closes:</dt><dd>{fmtDeadline(event.registration_deadline)}</dd></div>}
        </dl>
        <div className="mt-auto space-y-2">
          <AvailabilityBar registered={registered} capacity={event.capacity} label={`Slots taken for ${event.title}`} />
          <p className="text-sm font-semibold text-ink">{slotsText}</p>
          {st.canRegister ? (
            <Link to={`/events/${event.id}/register`} className="btn-primary w-full" aria-label={`Register for ${event.title}`}>Register</Link>
          ) : (
            <>
              <button type="button" className="btn-primary w-full" aria-disabled="true" aria-describedby={explainId} onClick={(e) => e.preventDefault()}>Register</button>
              <p id={explainId} className="text-sm text-danger">Registration is unavailable. {st.reason}</p>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
