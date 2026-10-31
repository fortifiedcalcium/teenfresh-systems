import React from "react";

/** Track = sky, fill = link (3:1+ non-text contrast). Not the only cue: the card always prints "X of Y slots left". */
export default function AvailabilityBar({ registered, capacity, label = "Slots taken" }) {
  const taken = Math.min(registered, capacity);
  const pct = Math.round((taken / capacity) * 100);
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={taken} aria-valuetext={`${taken} of ${capacity} slots taken`} aria-label={label} className="progress-track h-3 w-full overflow-hidden rounded-full bg-brand-sky">
      <div className="progress-fill h-full rounded-full bg-link transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}
