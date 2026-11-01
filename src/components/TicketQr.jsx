import React from "react";
import { QRCodeSVG } from "qrcode.react";
import qrLogo from "../logo/qr-logo.png";

// The Teenfresh wordmark sits in the middle of every QR code. Level H (30% error correction) leaves plenty of room:
// the logo plate covers under 10% of the symbol, and the scan test decodes it.
const LOGO_RATIO = 128 / 600;

/** The QR payload is just the ticket number: the server looks it up, so a forged QR proves nothing.
 *  The ticket number is printed beside it, which is the text alternative (1.1.1). */
export default function TicketQr({ ticketNumber, size = 220 }) {
  return (
    <figure className="inline-flex flex-col items-center gap-2" aria-label={`Ticket QR code for ${ticketNumber}`}>
      <div className="rounded-xl border-2 border-ink bg-white p-3 text-ink" role="img" aria-label={`QR code. Ticket number ${ticketNumber}`}>
        <QRCodeSVG value={ticketNumber} size={size} level="H" marginSize={0} fgColor="currentColor" aria-hidden="true"
          imageSettings={{ src: qrLogo, width: Math.round(size * 0.4), height: Math.round(size * 0.4 * LOGO_RATIO), excavate: true }} />
      </div>
      <figcaption className="font-mono text-lg font-bold tracking-wider">{ticketNumber}</figcaption>
    </figure>
  );
}
