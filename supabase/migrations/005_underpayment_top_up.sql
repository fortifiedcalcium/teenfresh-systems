-- 005: pay only what is missing after an underpayment. Run in the SQL Editor of the event project (fnhamldmvpdcygjbzdls), after 004.
--
-- Before: an underpaid payment (e.g. 95 of 100, 5 still due) had to be resubmitted with the TOTAL paid, at least the full 100.
-- Now: the person sends only the missing amount (at least the amount due, 5) with a new receipt and reference number, and the
-- amount is ADDED to what they paid before (95 + 5 = 100). Rejected payments still need a full payment, as before.
-- amount_history keeps the earlier totals (like receipt_history and reference_history) so admins can see how it adds up.

alter table public.payments add column if not exists amount_history numeric(10,2)[] not null default '{}';

create or replace function public.resubmit_payment(
  p_payment_id uuid, p_sender_name text, p_amount numeric, p_reference text, p_receipt_path text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_pay    public.payments;
  v_event  public.events;
  v_ref    text := public.normalize_reference(p_reference);
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_needed numeric;
  v_min    numeric;
  v_missing numeric;   -- underpaid: what is still owed (the amount due the admin set, else forms total minus what was paid)
  v_revive integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_pay from public.payments where id = p_payment_id and user_id = v_uid for update;
  if not found or v_pay.status not in ('underpaid', 'rejected') then raise exception 'INVALID_PAYMENT'; end if;
  select * into v_event from public.events where id = v_pay.event_id for update;

  if char_length(trim(coalesce(p_sender_name, ''))) < 2 or char_length(trim(p_sender_name)) > 100 then raise exception 'INVALID_SENDER'; end if;
  if v_ref !~ '^[0-9]{8,20}$' then raise exception 'INVALID_REFERENCE'; end if;
  if p_receipt_path is null or not public.valid_receipt_path(p_receipt_path, v_uid) then raise exception 'INVALID_RECEIPT'; end if;
  if exists (select 1 from public.payments where event_id = v_pay.event_id and reference_number = v_ref and id <> v_pay.id) then
    raise exception 'DUPLICATE_REFERENCE';
  end if;
  if (select count(*) from public.payments where user_id = v_uid and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'RATE_LIMIT';
  end if;

  select coalesce(sum(total_amount) filter (where status in ('pending_verification', 'confirmed', 'rejected')), 0),
         count(*) filter (where status = 'rejected')
    into v_needed, v_revive from public.registrations where payment_id = v_pay.id;
  if v_pay.status = 'underpaid' then
    -- a top-up: the person sends only what is missing (e.g. 5 of 100). The amount they send is added to what they paid before.
    v_missing := greatest(coalesce(v_pay.amount_due, (case when v_needed > 0 then v_needed else v_event.registration_fee end) - v_pay.amount_paid), 0);
    v_min := greatest(v_missing, 0.01);
  else
    v_min := case when v_needed > 0 then v_needed else v_event.registration_fee end;   -- rejected: a full payment for the attached forms
  end if;
  if v_amount < v_min then raise exception 'AMOUNT_TOO_LOW'; end if;

  if v_revive > 0 then
    -- the slots were released when the payment was rejected: this is like a new registration
    if not v_event.registration_open or now() >= coalesce(v_event.registration_deadline, v_event.event_date) then raise exception 'REGISTRATION_CLOSED'; end if;
    if (select count(*) from public.registrations where event_id = v_event.id and status in ('pending_verification', 'confirmed')) + v_revive > v_event.capacity then
      raise exception 'SOLD_OUT';
    end if;
    begin
      update public.registrations set status = 'pending_verification' where payment_id = v_pay.id and status = 'rejected';
    exception when unique_violation then
      raise exception 'ALREADY_REGISTERED';
    end;
  end if;

  update public.payments
     set receipt_history = case when receipt_path is not null then receipt_history || receipt_path else receipt_history end,
         reference_history = reference_history || reference_number,
         amount_history = amount_history || v_pay.amount_paid,
         sender_name = trim(p_sender_name),
         amount_paid = case when v_pay.status = 'underpaid' then v_pay.amount_paid + v_amount else v_amount end,
         reference_number = v_ref, receipt_path = p_receipt_path,
         status = 'pending', amount_due = null, review_note = null, reviewed_by = null, reviewed_at = null,
         receipt_deleted_at = null, resubmission_count = resubmission_count + 1
   where id = v_pay.id;
  return jsonb_build_object('payment_id', v_pay.id, 'status', 'pending');
end $$;


-- The underpaid email now says to send only the remaining amount. New events get it from the default template below;
-- existing events get it by replacing the old sentence in their saved template (a template you rewrote yourself is left alone).
create or replace function public.default_email_template(p_kind text, out subject text, out html_body text, out text_body text)
language plpgsql immutable as $fn$
declare
  head text := $h$<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222;background:#ffffff;">
<div style="max-width:800px;margin:0 auto;">
{{Banner}}$h$;
  contact text := $c$<p style="margin:0 0 16px 0;">If you have any concerns, please do not hesitate to contact us in any of our social media accounts!<br>{{Contact Links}}</p>$c$;
  signature text := $s$<p style="margin:0 0 12px 0;">Best Regards,</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
<tr>
<td style="padding:0 16px 0 0;vertical-align:middle;"><img src="{{Logo URL}}" alt="Teenfresh" width="130" style="display:block;width:130px;height:auto;border:0;"></td>
<td style="vertical-align:middle;font-size:14px;line-height:1.7;color:#222222;">
<strong>Teenfresh</strong><br>
<img src="{{Facebook Icon URL}}" alt="" width="16" height="16" style="vertical-align:middle;border:0;"> <a href="https://www.facebook.com/TeenfreshPH" style="color:#1c5a85;text-decoration:underline;">/TeenfreshPH</a><br>
<img src="{{X Icon URL}}" alt="" width="16" height="16" style="vertical-align:middle;border:0;"> <a href="https://x.com/TeenfreshPH" style="color:#1c5a85;text-decoration:underline;">@TeenfreshPH</a>
</td>
</tr>
</table>
</div>
</div>$s$;
  tail text := E'\n\nIf you have any concerns, please do not hesitate to contact us in any of our social media accounts!\n{{Contact Links}}\n\nBest Regards,\nTeenfresh\n/TeenfreshPH (Facebook)\n@TeenfreshPH (X)\n';
begin
  if p_kind = 'confirmation' then
    subject := 'Confirmation email - {{Event Title}}';
    html_body := head || $b$
<p style="margin:0 0 16px 0;">Thank you for your interest in joining {{Event Title}}! This will serve as your confirmation email, to summarize:</p>
<p style="margin:0 0 16px 0;">Name: {{Name}}<br>Twitter Username: {{X/Twitter Username}}<br>Ticket Number: {{Ticket Number}}</p>
{{Terms}}
$b$ || contact || E'\n' || signature;
    text_body := E'Thank you for your interest in joining {{Event Title}}! This will serve as your confirmation email, to summarize:\n\nName: {{Name}}\nTwitter Username: {{X/Twitter Username}}\nTicket Number: {{Ticket Number}}\n\n{{Terms}}' || tail;
  elsif p_kind = 'payment_underpaid' then
    subject := 'Action needed: payment incomplete - {{Event Title}}';
    html_body := head || $b$
<p style="margin:0 0 16px 0;">Hi {{Name}},</p>
<p style="margin:0 0 16px 0;">Thank you for registering for {{Event Title}}. We received your GCash payment (reference number {{Reference Number}}, PHP {{Amount Paid}}), but it does not cover the full registration fee.</p>
<p style="margin:0 0 16px 0;"><strong>Remaining amount due: PHP {{Amount Due}}</strong></p>
<p style="margin:0 0 16px 0;">{{Reason}}</p>
<p style="margin:0 0 16px 0;">To complete your registration, sign in at {{Site URL}}, open <em>My registrations</em>, send only the remaining <strong>PHP {{Amount Due}}</strong> by GCash and upload the receipt of that transfer. You do not need to pay the full amount again. Your slot stays on hold while we wait. Convenience or transaction fees are not covered by the kit price.</p>
$b$ || contact || E'\n' || signature;
    text_body := E'Hi {{Name}},\n\nThank you for registering for {{Event Title}}. We received your GCash payment (reference number {{Reference Number}}, PHP {{Amount Paid}}), but it does not cover the full registration fee.\n\nRemaining amount due: PHP {{Amount Due}}\n\n{{Reason}}\n\nTo complete your registration, sign in at {{Site URL}}, open My registrations, send only the remaining PHP {{Amount Due}} by GCash and upload the receipt of that transfer. You do not need to pay the full amount again. Your slot stays on hold while we wait.' || tail;
  elsif p_kind = 'payment_rejected' then
    subject := 'Payment not verified - {{Event Title}}';
    html_body := head || $b$
<p style="margin:0 0 16px 0;">Hi {{Name}},</p>
<p style="margin:0 0 16px 0;">We could not verify your payment (reference number {{Reference Number}}) for {{Event Title}}, so your registration was not confirmed and the slot was released.</p>
<p style="margin:0 0 16px 0;"><strong>Reason:</strong> {{Reason}}</p>
<p style="margin:0 0 16px 0;">If slots are still available you can resubmit: sign in at {{Site URL}}, open <em>My registrations</em> and upload a correct receipt.</p>
$b$ || contact || E'\n' || signature;
    text_body := E'Hi {{Name}},\n\nWe could not verify your payment (reference number {{Reference Number}}) for {{Event Title}}, so your registration was not confirmed and the slot was released.\n\nReason: {{Reason}}\n\nIf slots are still available you can resubmit: sign in at {{Site URL}}, open My registrations and upload a correct receipt.' || tail;
  elsif p_kind = 'acknowledgment' then
    subject := 'We received your registration - {{Event Title}}';
    html_body := head || $b$
<p style="margin:0 0 16px 0;">Hi {{Name}},</p>
<p style="margin:0 0 16px 0;">We received your registration for {{Event Title}}. Your payment will be verified, and a confirmation email with your ticket will be sent within 48 to 72 hours. Kindly keep it confidential as it is your personal ticket for entry.</p>
$b$ || contact || E'\n' || signature;
    text_body := E'Hi {{Name}},\n\nWe received your registration for {{Event Title}}. Your payment will be verified, and a confirmation email with your ticket will be sent within 48 to 72 hours. Kindly keep it confidential as it is your personal ticket for entry.' || tail;
  else
    raise exception 'unknown template kind %', p_kind;
  end if;
end $fn$;

update public.email_templates set
  html_body = replace(html_body, $a$To complete your registration, sign in at {{Site URL}}, open <em>My registrations</em> and resubmit your payment with the new receipt. Your slot stays on hold while we wait. Convenience or transaction fees are not covered by the kit price.$a$, $b$To complete your registration, sign in at {{Site URL}}, open <em>My registrations</em>, send only the remaining <strong>PHP {{Amount Due}}</strong> by GCash and upload the receipt of that transfer. You do not need to pay the full amount again. Your slot stays on hold while we wait. Convenience or transaction fees are not covered by the kit price.$b$),
  text_body = replace(text_body, $c$To complete your registration, sign in at {{Site URL}}, open My registrations and resubmit your payment with the new receipt. Your slot stays on hold while we wait.$c$, $d$To complete your registration, sign in at {{Site URL}}, open My registrations, send only the remaining PHP {{Amount Due}} by GCash and upload the receipt of that transfer. You do not need to pay the full amount again. Your slot stays on hold while we wait.$d$)
 where kind = 'payment_underpaid';
