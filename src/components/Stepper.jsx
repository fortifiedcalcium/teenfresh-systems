import React from "react";

/** A labelled ordered list of the form's steps. The current step has aria-current="step". */
export default function Stepper({ steps, current }) {
  return (
    <nav aria-label="Registration progress">
      <ol className="flex flex-wrap gap-x-4 gap-y-2">
        {steps.map((s, i) => {
          const state = i < current ? "completed" : i === current ? "current" : "upcoming";
          return (
            <li key={s.key} aria-current={state === "current" ? "step" : undefined} className="flex min-h-target items-center gap-2 text-sm">
              <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-bold ${state === "current" ? "border-ink bg-ink text-brand-ivory" : state === "completed" ? "border-success bg-brand-mint text-success" : "border-link bg-white text-ink"}`}>
                {state === "completed" ? "✓" : i + 1}
              </span>
              <span className={state === "current" ? "font-bold" : "text-ink-muted"}>
                <span className="sr-only">Step {i + 1} of {steps.length}: </span>{s.label}{" "}<span className="sr-only">({state})</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
