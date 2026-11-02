import React from "react";

/** The list that holds the event facts (Date, Time, Venue, Kits, …). Every row has the same 12 px gap. */
export const InfoList = ({ className = "", children, ...rest }) => <ul className={`info-list ${className}`} {...rest}>{children}</ul>;

/** One fact: an icon plus ONE text block ("Label: value"), top-aligned, so a row that wraps keeps the icon and the label on its
 *  first line and the wrapped text starts under the left edge of the text block. `note` goes on its own muted line. */
export function InfoRow({ icon, label, note, className = "", children }) {
  return (
    <li className={`info-row ${className}`}>
      <span className="info-icon" aria-hidden="true">{icon}</span>
      <p className="info-text">
        <strong>{label}</strong>{" "}{children}
        {note && <span className="info-note">{note}</span>}
      </p>
    </li>
  );
}

/** A value that must not break in the middle (an amount such as "₱150.00 to ₱250.00 each"). */
export const NoWrap = ({ children }) => <span className="nowrap">{children}</span>;
