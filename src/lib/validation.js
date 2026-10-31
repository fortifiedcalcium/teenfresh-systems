import { z } from "zod";
import { isUnusualReferenceLength, isValidReference, normalizeFacebook, normalizePhone, normalizeX, parseAmount } from "./payment.js";

/* One zod schema per step of the registration form. The browser checks each step as you move forward;
   the submit_registration function repeats every check on the server. */

const email = z.string().trim().min(1, "Email is required").email("Enter a valid email address, like name@example.com");

export const step1Schema = z.object({
  email,
  agree: z.boolean().refine((v) => v === true, "You must agree to the Terms and Conditions to continue"),
});

export const step2Schema = z.object({
  name: z.string().trim().min(2, "Enter your name or nickname").max(100, "Name is too long (100 characters at most)"),
  x_username: z.string().trim()
    .refine((v) => normalizeX(v).length > 0, "Your X / Twitter username is required")
    .refine((v) => normalizeX(v).length === 0 || /^[A-Za-z0-9_]{1,15}$/.test(normalizeX(v)), "Use only letters, numbers and underscores (15 characters at most)"),
  facebook_url: z.string().trim()
    .min(1, "Your Facebook profile link is required")
    .refine((v) => !v || normalizeFacebook(v) !== null, "Enter a Facebook profile link, like fb.com/TeenfreshPH"),
  contact_number: z.string().trim()
    .min(1, "Your contact number is required")
    .refine((v) => !v || normalizePhone(v) !== null, "Enter a Philippine mobile number, like 09171234567 or +639171234567"),
});

/** Payment step. `fee` is the event's registration fee; with a reused payment only the notes are checked. */
export const makeStep3Schema = (fee) =>
  z.object({
    reuse_payment_id: z.string().optional(),
    sender_name: z.string().trim(),
    amount_paid: z.string().trim(),
    reference_number: z.string().trim(),
    notes: z.string().max(500, "Notes can be 500 characters at most"),
  }).superRefine((v, ctx) => {
    if (v.reuse_payment_id) return;
    const issue = (path, message) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.sender_name.length < 2) issue("sender_name", "Enter the name of the GCash sender");
    else if (v.sender_name.length > 100) issue("sender_name", "Sender name is too long (100 characters at most)");
    const amount = parseAmount(v.amount_paid);
    if (!v.amount_paid) issue("amount_paid", "Enter the amount you paid");
    else if (Number.isNaN(amount)) issue("amount_paid", "Enter the amount as a number with at most 2 decimals, like 100 or 100.00");
    else if (amount < fee) issue("amount_paid", `The amount must be at least ${fee.toFixed(2)} PHP. Convenience or transaction fees are not covered by the kit price.`);
    if (!v.reference_number) issue("reference_number", "Enter the GCash reference number");
    else if (!isValidReference(v.reference_number)) issue("reference_number", "The reference number must be 8 to 20 digits, with no letters");
  });

export const stepSchemaFor = (key, fee) => (key === "info" ? step1Schema : key === "participant" ? step2Schema : key === "payment" ? makeStep3Schema(fee) : z.object({}));

export { isUnusualReferenceLength };
