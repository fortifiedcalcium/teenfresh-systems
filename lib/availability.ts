/** Status of an event card. "Few slots left" = 10% or less of the capacity remains.
 *  Registration closes at the deadline (or when the event starts); pending forms already hold a slot. */
export function eventStatus(event, registered, now = Date.now()) {
  const slotsLeft = Math.max(event.capacity - registered, 0);
  const closesAt = new Date(event.registration_deadline || event.event_date).getTime();
  const started = new Date(event.event_date).getTime() <= now;
  if (!event.registration_open) return { key: "closed", label: "Registration closed", reason: "Registration has been closed by the organizers.", slotsLeft, canRegister: false };
  if (started || now >= closesAt) return { key: "closed", label: "Registration closed", reason: "The registration deadline has passed.", slotsLeft, canRegister: false };
  if (slotsLeft <= 0) return { key: "sold_out", label: "Sold out", reason: "All slots are taken.", slotsLeft, canRegister: false };
  if (slotsLeft <= event.capacity * 0.1) return { key: "few", label: "Few slots left", slotsLeft, canRegister: true };
  return { key: "available", label: "Available", slotsLeft, canRegister: true };
}

// Status badge tone + progress fill per status. The fill is always `link` (4.97:1 on the sky track),
// so availability never depends on colour: the text "X of Y slots left" is always shown too.
export const STATUS_TONE = { available: "ok", few: "warn", sold_out: "bad", closed: "bad" };
export const STATUS_BAND = ["bg-brand-sky", "bg-brand-blush", "bg-brand-mint"]; // rotated per event card

export const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Manila" });
export const fmtTime = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }) : "");

export const fmtTimeRange = (start, end) => (end ? `${fmtTime(start)} to ${fmtTime(end)}` : fmtTime(start));
export const fmtDeadline = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
/** "Open in Google Maps" link built from the venue and address */
export const mapsUrl = (event) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([event.venue, event.venue_address].filter(Boolean).join(", "));
