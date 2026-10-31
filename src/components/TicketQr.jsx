import React from "react";
import { QRCodeSVG } from "qrcode.react";

/** The QR payload is just the ticket number: the server looks it up, so a forged QR proves nothing.
 *  The ticket number is printed beside it, which is the text alternative (1.1.1). */
export default function TicketQr({ ticketNumber, size = 220 }) {
  return (
    <figure className="inline-flex flex-col items-center gap-2" aria-label={`Ticket QR code for ${ticketNumber}`}>
      <div className="rounded-xl border-2 border-ink bg-white p-3" role="img" aria-label={`QR code. Ticket number ${ticketNumber}`}>
        <QRCodeSVG value={ticketNumber} size={size} level="M" marginSize={0} aria-hidden="true" />
      </div>
      <figcaption className="font-mono text-lg font-bold tracking-wider">{ticketNumber}</figcaption>
    </figure>
  );
}
