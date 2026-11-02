import React from "react";
import { peso } from "../lib/payment.js";

/** Choose one kit (radio group) and see the total. One form orders one kit, so there is no quantity.
 *  The total is announced when the choice changes. The database recalculates the price from the kit itself,
 *  so nothing here can change what is charged. */
export default function KitOrder({ kits, register, errors, order }) {
  return (
    <div className="space-y-5">
      <fieldset aria-describedby={errors.kit_id ? "kit-err" : undefined}>
        <legend className="label">Kit <span className="font-normal text-ink-muted">(required)</span></legend>
        <div className="space-y-2">
          {kits.map((k) => (
            <label key={k.id} className="flex min-h-target cursor-pointer items-start gap-3 rounded-lg border border-link bg-white p-3 has-[:checked]:border-2 has-[:checked]:border-ink has-[:checked]:bg-brand-sky">
              <input type="radio" value={k.id} className="check mt-1" aria-describedby={`kit-${k.id}`} {...register("kit_id")} />
              <span id={`kit-${k.id}`} className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3"><span className="font-bold">{k.name}</span><span className="font-bold">{peso(k.unit_price)}</span></span>
                {k.description && <span className="block text-sm text-ink-muted">{k.description}</span>}
              </span>
            </label>
          ))}
        </div>
        {errors.kit_id && <p id="kit-err" className="mt-1 flex gap-1 text-sm font-semibold text-danger"><span aria-hidden="true">✕</span>{errors.kit_id.message}</p>}
      </fieldset>

      <p role="status" aria-live="polite" className="rounded-lg border border-link bg-brand-ivory p-3 text-lg font-bold">
        {order.kit ? <>Total to pay: {peso(order.total)}</> : "Choose a kit to see the total."}
      </p>
    </div>
  );
}
