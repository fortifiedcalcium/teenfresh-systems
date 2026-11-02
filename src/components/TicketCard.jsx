import React from "react";
import TicketQr from "./TicketQr.jsx";
import { fmtDateTime } from "../lib/availability.js";

/** The ticket and QR code. Only a confirmed registration has a ticket number; anything else shows its status instead. */
export default function TicketCard({ registration, event }) {
  const confirmed = registration.status === "confirmed" && registration.ticket_number;
  return (
    <div className="card mx-auto max-w-md p-6 text-center">
      <h2 className="text-lg font-black">{event?.title}</h2>
      {confirmed ? <div className="my-4"><TicketQr ticketNumber={registration.ticket_number} /></div>
        : <p className={`alert ${registration.status === "pending_verification" ? "alert-warn" : "alert-bad"} my-6 justify-center font-semibold`}>{registration.status === "pending_verification" ? "Your ticket will appear here once your payment is verified." : registration.status === "rejected" ? "This registration was rejected." : "This registration was cancelled."}</p>}
      <dl className="space-y-1 text-left text-sm">
        <div className="flex justify-between gap-4"><dt className="text-ink-muted">Name</dt><dd className="font-medium">{registration.name}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-ink-muted">X username</dt><dd className="font-medium">@{registration.x_username}</dd></div>
        {event?.event_date && <div className="flex justify-between gap-4"><dt className="text-ink-muted">When</dt><dd className="font-medium">{fmtDateTime(event.event_date)}</dd></div>}
        {event?.venue && <div className="flex justify-between gap-4"><dt className="text-ink-muted">Venue</dt><dd className="font-medium">{event.venue}</dd></div>}
        {registration.checked_in_at && <div className="flex justify-between gap-4"><dt className="text-ink-muted">Checked in</dt><dd className="font-medium text-success">{fmtDateTime(registration.checked_in_at)}</dd></div>}
      </dl>
    </div>
  );
}
