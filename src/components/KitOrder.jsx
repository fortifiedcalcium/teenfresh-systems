import React from "react";
import { peso } from "../lib/payment.js";
import { IconMinus, IconPlus } from "./NavIcons.jsx";

/** Choose a kit (radio group), a quantity (number field with plus/minus buttons) and see the total.
 *  The price is shown per kit; the total is quantity x price and is also announced when it changes.
 *  The database recalculates the price from the kit itself, so nothing here can change what is charged. */
export default function KitOrder({ kits, register, errors, kitId, quantity, onQuantity, order }) {
  const kit = kits.find((k) => k.id === kitId);
  const max = kit?.max_per_order ?? 1;
  const n = Number.parseInt(quantity, 10);
  const step = (d) => onQuantity(String(Math.min(max, Math.max(1, (Number.isInteger(n) ? n : 1) + d))));
  const qErr = errors.quantity?.message;
  return (
    <div className="space-y-5">
      <fieldset aria-describedby={errors.kit_id ? "kit-err" : undefined}>
        <legend className="label">Kit <span className="font-normal text-ink-muted">(required)</span></legend>
        <div className="space-y-2">
          {kits.map((k) => (
            <label key={k.id} className="flex min-h-target cursor-pointer items-start gap-3 rounded-lg border border-link bg-white p-3 has-[:checked]:border-2 has-[:checked]:border-ink has-[:checked]:bg-brand-sky">
              <input type="radio" value={k.id} className="check mt-1" aria-describedby={`kit-${k.id}`} {...register("kit_id")} />
              <span id={`kit-${k.id}`} className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3"><span className="font-bold">{k.name}</span><span className="font-bold">{peso(k.unit_price)} each</span></span>
                {k.description && <span className="block text-sm text-ink-muted">{k.description}</span>}
                <span className="block text-sm text-ink-muted">Up to {k.max_per_order} per form</span>
              </span>
            </label>
          ))}
        </div>
        {errors.kit_id && <p id="kit-err" className="mt-1 flex gap-1 text-sm font-semibold text-danger"><span aria-hidden="true">✕</span>{errors.kit_id.message}</p>}
      </fieldset>

      <div>
        <label htmlFor="quantity" className="label">Quantity <span className="font-normal text-ink-muted">(required)</span></label>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => step(-1)} disabled={!kit || n <= 1} aria-label="Decrease quantity"><IconMinus /></button>
          <input id="quantity" type="number" inputMode="numeric" min="1" max={max} step="1" className="input w-24 text-center" aria-required="true" aria-invalid={qErr ? "true" : undefined} aria-describedby={`quantity-hint${qErr ? " quantity-err" : ""}`} {...register("quantity")} />
          <button type="button" className="btn-secondary" onClick={() => step(1)} disabled={!kit || n >= max} aria-label="Increase quantity"><IconPlus /></button>
        </div>
        <p id="quantity-hint" className="hint">{kit ? `Up to ${max} of this kit per form.` : "Choose a kit first."}</p>
        {qErr && <p id="quantity-err" className="mt-1 flex gap-1 text-sm font-semibold text-danger"><span aria-hidden="true">✕</span>{qErr}</p>}
      </div>

      <p role="status" aria-live="polite" className="rounded-lg border border-link bg-brand-ivory p-3 text-lg font-bold">
        {order.kit && order.qty ? <>Total to pay: {order.qty} × {peso(order.unit)} = {peso(order.total)}</> : "Choose a kit and a quantity to see the total."}
      </p>
    </div>
  );
}
