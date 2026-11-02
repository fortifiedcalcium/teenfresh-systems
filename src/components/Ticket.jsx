import React from "react";

/** A vertical ticket: the main section on top (`image`, then `children`) and the stub underneath, split by a dashed
 *  perforation with a round notch cut out of each side (see src/styles/ticket.css). Purely presentational.
 *  `status`: confirmed | pending | attention | rejected | cancelled (a rejected ticket also gets a VOID stamp).
 *  The notches, perforation and stamp are decorative: aria-hidden, never focusable. */
export function Ticket({ status = "confirmed", labelledBy, image, children, stub }) {
  return (
    <article className="ticket" data-status={status} aria-labelledby={labelledBy}>
      <div className="ticket__top">
        <div className="ticket__fill">
          {image}
          {status === "rejected" && <span className="ticket__stamp" aria-hidden="true">VOID</span>}
          <div className="ticket__content">{children}</div>
        </div>
      </div>
      <div className="ticket__bottom">
        <div className="ticket__fill"><div className="ticket__stub">{stub}</div></div>
      </div>
    </article>
  );
}

/** The stub's small heading, and its content */
export const TicketStub = ({ label, children }) => (
  <>
    {label && <p className="ticket__label">{label}</p>}
    {children}
  </>
);

/** Decorative barcode strip, drawn from the ticket number so every ticket looks different. It is NOT a scannable code. */
export function TicketBarcode({ value = "" }) {
  let seed = 7;
  for (const ch of String(value)) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
  const next = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed; };
  const bars = [];
  for (let x = 0; x < 200;) {
    const w = 1 + (next() % 3), gap = 1 + (next() % 3);
    if (x + w > 200) break;
    bars.push(<rect key={x} x={x} y="0" width={w} height="40" />);
    x += w + gap;
  }
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 200 40" preserveAspectRatio="none" className="h-9 w-full text-ink" fill="currentColor">{bars}</svg>;
}
