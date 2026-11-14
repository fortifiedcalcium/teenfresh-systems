import React from "react";

/** A labelled text box with a button beside it (for example "Shipping fee" and "Send shipping fee"), with the hint under both.
 *  The button lines up with the text box itself, not with the hint below it. */
export default function InputWithAction({ id, label, hint, action, className = "input", ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <input id={id} className={className} aria-describedby={hint ? `${id}-hint` : undefined} {...inputProps} />
        {action}
      </div>
      {hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
    </div>
  );
}
