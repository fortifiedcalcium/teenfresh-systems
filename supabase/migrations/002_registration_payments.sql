-- =====================================================================================
-- 002: multi-step registration, GCash payments with receipt upload, admin verification,
--      replaceable event images. Run AFTER schema.sql, once, in the Supabase SQL Editor.
--
-- What this does to existing data:
--   * registrations keep their status (existing rows are already 'confirmed' or 'cancelled')
--   * the old "one registration per user per event" rule becomes "one active entry per X
--     username per event" (a user may now submit several forms)
--   * events.terms_intro/terms_items are copied into the new events.terms_html
--   * events.banner_url is copied into the new 'banner' image slot
--   * the old register_for_event() function is replaced by submit_registration()
--   * events.event_date stays the start time (this migration adds ends_at, not starts_at)
-- =====================================================================================

create function public.html_escape(t text) returns text language sql immutable as $$
  select replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
$$;

-- ---------- events: new fields -----------------------------------------------------
alter table public.events
  add column subtitle                text,
  add column venue_address           text,
  add column ends_at                 timestamptz,
  add column registration_deadline   timestamptz,
  add column registration_fee        numeric(10,2) not null default 0 check (registration_fee >= 0),
  add column fee_note                text,
  add column hashtags                text[] not null default '{}',
  add column kit_inclusions          text[] not null default '{}',
  add column terms_html              text,
  add column contact_links           jsonb not null default '[]'::jsonb,
  add column payment_account_name    text,   -- shown to people paying; store it already masked
  add column payment_account_number  text,
  add column send_ack_email          boolean not null default false,   -- "we received your registration" email
  add column receipt_retention_days  integer check (receipt_retention_days is null or receipt_retention_days >= 0);

-- Terms: copy the old plain-text rules into HTML (admins edit terms_html from now on)
update public.events e
   set terms_html = (case when e.terms_intro is not null then '<p>' || public.html_escape(e.terms_intro) || '</p>' else '' end)
                    || '<ol>' || coalesce((select string_agg('<li>' || public.html_escape(t) || '</li>', '' order by ord)
                                             from unnest(e.terms_items) with ordinality as x(t, ord)), '') || '</ol>'
 where e.terms_html is null and (e.terms_intro is not null or cardinality(e.terms_items) > 0);

-- ---------- event images (replaceable slots) ---------------------------------------
create table public.event_images (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  slot         text not null check (slot in ('poster', 'details_card', 'gcash_qr', 'banner', 'email_banner')),
  storage_path text,   -- object in the public 'event-media' bucket
  external_url text,   -- or a plain URL (used for the migrated banner_url)
  alt_text     text,
  updated_at   timestamptz not null default now(),
  constraint event_images_event_slot_key unique (event_id, slot),
  constraint event_images_one_source check (num_nonnulls(storage_path, external_url) = 1)
);

insert into public.event_images (event_id, slot, external_url, alt_text)
select id, 'banner', banner_url, title || ' banner' from public.events where banner_url is not null
on conflict do nothing;

-- ---------- payments ---------------------------------------------------------------
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events (id) on delete cascade,
  user_id            uuid not null,
  method             text not null default 'gcash',
  sender_name        text not null,
  amount_paid        numeric(10,2) not null check (amount_paid > 0),
  reference_number   text not null,
  receipt_path       text,                              -- private 'payment-receipts' bucket; null once purged
  receipt_history    text[] not null default '{}',      -- earlier receipts after a resubmission
  reference_history  text[] not null default '{}',
  status             text not null default 'pending' check (status in ('pending', 'verified', 'underpaid', 'rejected')),
  amount_due         numeric(10,2),                     -- set when marked underpaid
  review_note        text,
  reviewed_by        uuid,
  reviewed_at        timestamptz,
  resubmission_count integer not null default 0,
  receipt_deleted_at timestamptz,
  created_at         timestamptz not null default now(),
  constraint payments_event_reference_key unique (event_id, reference_number),
  constraint payments_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade,
  constraint payments_reviewed_by_fkey foreign key (reviewed_by) references public.profiles (id) on delete set null
);
create index payments_event_status_idx on public.payments (event_id, status, created_at);
create index payments_user_idx on public.payments (user_id);

-- ---------- registrations ----------------------------------------------------------
alter table public.registrations
  add column facebook_url      text,
  add column notes             text,
  add column payment_id        uuid,
  add column terms_accepted_at timestamptz;
alter table public.registrations add constraint registrations_payment_id_fkey
  foreign key (payment_id) references public.payments (id) on delete set null;
create index registrations_payment_idx on public.registrations (payment_id);

alter table public.registrations alter column ticket_number drop not null;  -- assigned when the payment is verified

alter table public.registrations drop constraint if exists registrations_status_check;
alter table public.registrations add constraint registrations_status_check
  check (status in ('pending_verification', 'confirmed', 'rejected', 'cancelled'));

-- 1 form = 1 entry per person: one active registration per (event, X username)
alter table public.registrations drop constraint if exists registrations_event_user_key;
do $$
declare dup text;
begin
  select string_agg(distinct lower(x_username), ', ') into dup from (
    select event_id, lower(x_username) as x_username from public.registrations
     where status in ('pending_verification', 'confirmed') group by 1, 2 having count(*) > 1) d;
  if dup is not null then
    raise exception 'Cannot enforce one entry per X username: these usernames are registered more than once for the same event: %. Cancel the extra registrations (Admin > Attendees) and run this migration again.', dup;
  end if;
end $$;
create unique index registrations_active_x_key on public.registrations (event_id, lower(x_username))
  where status in ('pending_verification', 'confirmed');

-- Both pending and confirmed forms hold a slot; rejected and cancelled release it.
create or replace function public.refresh_event_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_event uuid := coalesce(new.event_id, old.event_id);
begin
  update public.event_counts
     set registered = (select count(*) from public.registrations
                        where event_id = v_event and status in ('pending_verification', 'confirmed'))
   where event_id = v_event;
  return null;
end $$;
update public.event_counts c set registered =
  (select count(*) from public.registrations r where r.event_id = c.event_id and r.status in ('pending_verification', 'confirmed'));

-- ---------- email templates: one per kind ------------------------------------------
alter table public.email_templates add column kind text not null default 'confirmation'
  check (kind in ('confirmation', 'payment_underpaid', 'payment_rejected', 'acknowledgment'));
alter table public.email_templates drop constraint if exists email_templates_event_id_key;
alter table public.email_templates add constraint email_templates_event_kind_key unique (event_id, kind);

alter table public.email_logs drop constraint if exists email_logs_kind_check;
alter table public.email_logs add constraint email_logs_kind_check
  check (kind in ('confirmation', 'bulk', 'test', 'payment_underpaid', 'payment_rejected', 'acknowledgment'));

-- Default templates (same Gmail-like layout; the event title, banner, terms and contact links come from the event)
create function public.default_email_template(p_kind text, out subject text, out html_body text, out text_body text)
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
<p style="margin:0 0 16px 0;">To complete your registration, sign in at {{Site URL}}, open <em>My registrations</em> and resubmit your payment with the new receipt. Your slot stays on hold while we wait. Convenience or transaction fees are not covered by the kit price.</p>
$b$ || contact || E'\n' || signature;
    text_body := E'Hi {{Name}},\n\nThank you for registering for {{Event Title}}. We received your GCash payment (reference number {{Reference Number}}, PHP {{Amount Paid}}), but it does not cover the full registration fee.\n\nRemaining amount due: PHP {{Amount Due}}\n\n{{Reason}}\n\nTo complete your registration, sign in at {{Site URL}}, open My registrations and resubmit your payment with the new receipt. Your slot stays on hold while we wait.' || tail;
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

create function public.create_default_templates(p_event_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  foreach k in array array['confirmation', 'payment_underpaid', 'payment_rejected', 'acknowledgment'] loop
    insert into public.email_templates (event_id, kind, subject, html_body, text_body)
    select p_event_id, k, t.subject, t.html_body, t.text_body from public.default_email_template(k) t
    on conflict (event_id, kind) do nothing;
  end loop;
end $$;

create function public.events_default_templates() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.create_default_templates(new.id);
  return new;
end $$;
create trigger events_default_templates after insert on public.events
  for each row execute function public.events_default_templates();

select public.create_default_templates(id) from public.events;  -- fills in the kinds an existing event is missing

-- ---------- input normalisers (the browser mirrors these exactly) -------------------
create function public.normalize_x_username(t text) returns text language sql immutable as $$
  select regexp_replace(trim(coalesce(t, '')), '^@+', '');
$$;

create function public.normalize_phone(t text) returns text language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(t, ''), '[\s\-().]', '', 'g');
begin
  if d ~ '^09[0-9]{9}$' then return '+63' || substr(d, 2); end if;
  if d ~ '^\+639[0-9]{9}$' then return d; end if;
  return null;
end $$;

create function public.normalize_facebook(t text) returns text language plpgsql immutable as $$
declare m text[];
begin
  m := regexp_match(trim(coalesce(t, '')), '^(?:https?://)?(?:www\.|m\.|web\.|mbasic\.)?(?:facebook\.com|fb\.com)/([A-Za-z0-9._~%+=&?/-]{1,200})$', 'i');
  if m is null then return null; end if;
  return 'https://www.facebook.com/' || m[1];
end $$;

create function public.normalize_reference(t text) returns text language sql immutable as $$
  select regexp_replace(coalesce(t, ''), '[\s-]', '', 'g');
$$;

-- ---------- receipts: path check and a per-user upload rate limit -------------------
create function public.valid_receipt_path(p_path text, p_uid uuid) returns boolean language sql immutable as $$
  select p_path ~ ('^' || p_uid::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|pdf)$');
$$;

-- ---------- submit_registration (replaces register_for_event) ----------------------
drop function if exists public.register_for_event(uuid, text, text, text, text, boolean);

create function public.submit_registration(
  p_event_id uuid, p_name text, p_x_username text, p_email text, p_facebook text, p_contact text,
  p_notes text, p_agreed boolean,
  p_payment_id uuid default null,                       -- reuse one of my earlier payments ...
  p_sender_name text default null, p_amount numeric default null,   -- ... or enter a new one
  p_reference text default null, p_receipt_path text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_event  public.events;
  v_name   text := trim(coalesce(p_name, ''));
  v_x      text := public.normalize_x_username(p_x_username);
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_fb     text := public.normalize_facebook(p_facebook);
  v_phone  text := public.normalize_phone(p_contact);
  v_notes  text := nullif(trim(coalesce(p_notes, '')), '');
  v_fee    numeric;
  v_pay    public.payments;
  v_ref    text := public.normalize_reference(p_reference);
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_status text := 'pending_verification';
  v_ticket text;
  v_reg    public.registrations;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce(p_agreed, false) then raise exception 'TERMS_NOT_ACCEPTED'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 100 then raise exception 'INVALID_NAME'; end if;
  if v_x !~ '^[A-Za-z0-9_]{1,15}$' then raise exception 'INVALID_X_USERNAME'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'INVALID_EMAIL'; end if;
  if v_fb is null then raise exception 'INVALID_FACEBOOK'; end if;
  if v_phone is null then raise exception 'INVALID_CONTACT'; end if;
  if v_notes is not null and char_length(v_notes) > 500 then raise exception 'INVALID_NOTES'; end if;

  -- rate limit: at most 10 forms per user per hour
  if (select count(*) from public.registrations where user_id = v_uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'RATE_LIMIT';
  end if;

  -- CAPACITY LOCK: FOR UPDATE queues concurrent submissions for this event, so the counts below are current
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not v_event.registration_open or now() >= coalesce(v_event.registration_deadline, v_event.event_date)
     or v_event.event_date <= now() then
    raise exception 'REGISTRATION_CLOSED';
  end if;
  -- pending forms hold a slot too, so the last slot cannot be promised twice
  if (select count(*) from public.registrations where event_id = p_event_id and status in ('pending_verification', 'confirmed')) >= v_event.capacity then
    raise exception 'SOLD_OUT';
  end if;
  if exists (select 1 from public.registrations where event_id = p_event_id and lower(x_username) = lower(v_x)
              and status in ('pending_verification', 'confirmed')) then
    raise exception 'ALREADY_REGISTERED';
  end if;

  v_fee := v_event.registration_fee;
  if v_fee > 0 then
    if p_payment_id is not null then
      -- shared payment: coverage = floor(paid / fee) minus the forms already linked to it
      select * into v_pay from public.payments where id = p_payment_id and user_id = v_uid and event_id = p_event_id for update;
      if not found or v_pay.status not in ('pending', 'verified') then raise exception 'INVALID_PAYMENT'; end if;
      if floor(v_pay.amount_paid / v_fee) - (select count(*) from public.registrations
           where payment_id = v_pay.id and status in ('pending_verification', 'confirmed')) < 1 then
        raise exception 'PAYMENT_COVERAGE_EXCEEDED';
      end if;
      if v_pay.status = 'verified' then v_status := 'confirmed'; end if;   -- already verified: no second review needed
    else
      if char_length(trim(coalesce(p_sender_name, ''))) < 2 or char_length(trim(p_sender_name)) > 100 then raise exception 'INVALID_SENDER'; end if;
      if v_amount < v_fee then raise exception 'AMOUNT_TOO_LOW'; end if;
      if v_amount > 1000000 then raise exception 'INVALID_AMOUNT'; end if;
      if v_ref !~ '^[0-9]{8,20}$' then raise exception 'INVALID_REFERENCE'; end if;
      if p_receipt_path is null or not public.valid_receipt_path(p_receipt_path, v_uid) then raise exception 'INVALID_RECEIPT'; end if;
      if exists (select 1 from public.payments where event_id = p_event_id and reference_number = v_ref) then
        raise exception 'DUPLICATE_REFERENCE';
      end if;
      insert into public.payments (event_id, user_id, sender_name, amount_paid, reference_number, receipt_path)
      values (p_event_id, v_uid, trim(p_sender_name), v_amount, v_ref, p_receipt_path) returning * into v_pay;
    end if;
  else
    v_status := 'confirmed';   -- free event: nothing to verify
  end if;

  if v_status = 'confirmed' then
    v_ticket := v_event.ticket_prefix || '-' || lpad(nextval('public.ticket_seq')::text, 6, '0');
  end if;

  insert into public.registrations (event_id, user_id, name, x_username, email, facebook_url, contact_number, notes,
                                    payment_id, terms_accepted_at, status, ticket_number)
  values (p_event_id, v_uid, v_name, v_x, v_email, v_fb, v_phone, v_notes, v_pay.id, now(), v_status, v_ticket)
  returning * into v_reg;

  return jsonb_build_object('registration_id', v_reg.id, 'payment_id', v_pay.id, 'status', v_reg.status, 'ticket_number', v_reg.ticket_number);
end $$;

-- ---------- resubmit_payment: fix an underpaid or rejected payment ------------------
create function public.resubmit_payment(
  p_payment_id uuid, p_sender_name text, p_amount numeric, p_reference text, p_receipt_path text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_pay    public.payments;
  v_event  public.events;
  v_ref    text := public.normalize_reference(p_reference);
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_forms  integer;
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

  select count(*) filter (where status in ('pending_verification', 'confirmed', 'rejected')),
         count(*) filter (where status = 'rejected')
    into v_forms, v_revive from public.registrations where payment_id = v_pay.id;
  if v_amount < v_event.registration_fee * greatest(v_forms, 1) then raise exception 'AMOUNT_TOO_LOW'; end if;

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
         sender_name = trim(p_sender_name), amount_paid = v_amount, reference_number = v_ref, receipt_path = p_receipt_path,
         status = 'pending', amount_due = null, review_note = null, reviewed_by = null, reviewed_at = null,
         receipt_deleted_at = null, resubmission_count = resubmission_count + 1
   where id = v_pay.id;
  return jsonb_build_object('payment_id', v_pay.id, 'status', 'pending');
end $$;

-- ---------- review_payment: the admin's decision ------------------------------------
create function public.review_payment(
  p_payment_id uuid, p_decision text, p_reason text default null,
  p_override boolean default false, p_amount_due numeric default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pay      public.payments;
  v_event    public.events;
  v_forms    integer;
  v_expected numeric;
  v_ids      uuid[] := '{}';
  v_tickets  text[] := '{}';
  r          record;
  v_ticket   text;
  v_reason   text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_decision not in ('verified', 'underpaid', 'rejected') then raise exception 'INVALID_DECISION'; end if;
  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_pay.status not in ('pending', 'underpaid') then raise exception 'ALREADY_REVIEWED'; end if;
  select * into v_event from public.events where id = v_pay.event_id;

  if p_decision = 'verified' then
    select count(*) into v_forms from public.registrations where payment_id = v_pay.id and status in ('pending_verification', 'confirmed');
    v_expected := v_event.registration_fee * v_forms;
    if v_pay.amount_paid < v_expected then
      if not coalesce(p_override, false) then raise exception 'INSUFFICIENT_AMOUNT'; end if;
      if v_reason is null then raise exception 'OVERRIDE_REASON_REQUIRED'; end if;
    end if;
    update public.payments set status = 'verified', reviewed_by = auth.uid(), reviewed_at = now(),
           review_note = v_reason, amount_due = null where id = v_pay.id;
    for r in select id from public.registrations where payment_id = v_pay.id and status = 'pending_verification' order by created_at, id for update loop
      v_ticket := v_event.ticket_prefix || '-' || lpad(nextval('public.ticket_seq')::text, 6, '0');
      update public.registrations set status = 'confirmed', ticket_number = v_ticket where id = r.id;
      v_ids := v_ids || r.id; v_tickets := v_tickets || v_ticket;
    end loop;

  elsif p_decision = 'underpaid' then
    if p_amount_due is null or p_amount_due <= 0 then raise exception 'AMOUNT_DUE_REQUIRED'; end if;
    update public.payments set status = 'underpaid', amount_due = round(p_amount_due, 2), reviewed_by = auth.uid(),
           reviewed_at = now(), review_note = v_reason where id = v_pay.id;   -- the forms stay pending and keep their slots

  else  -- rejected
    if v_reason is null then raise exception 'REASON_REQUIRED'; end if;
    update public.payments set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = v_reason, amount_due = null where id = v_pay.id;
    update public.registrations set status = 'rejected' where payment_id = v_pay.id and status = 'pending_verification';  -- releases the slots
  end if;

  return jsonb_build_object('decision', p_decision, 'payment_id', v_pay.id, 'registration_ids', to_jsonb(v_ids), 'ticket_numbers', to_jsonb(v_tickets));
end $$;

-- ---------- check-in: confirmed tickets only ---------------------------------------
create or replace function public.check_in_attendee(
  p_ticket text, p_kit boolean default null, p_receipt boolean default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ticket text := upper(trim(coalesce(p_ticket, '')));
  v_reg    public.registrations;
  v_found  boolean;
  v_by     text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_reg from public.registrations where ticket_number = v_ticket for update;
  v_found := found;

  if not v_found or v_reg.status <> 'confirmed' then
    insert into public.attendance_logs (registration_id, ticket_number_scanned, result, scanned_by)
    values (case when v_found then v_reg.id end, left(coalesce(p_ticket, ''), 64), 'invalid', auth.uid());
    return jsonb_build_object('result', 'invalid', 'ticket_number', v_ticket, 'reason', case when v_found then v_reg.status else 'not_found' end);
  end if;

  if v_reg.checked_in_at is not null then
    select coalesce(full_name, email) into v_by from public.profiles where id = v_reg.checked_in_by;
    insert into public.attendance_logs (registration_id, ticket_number_scanned, result, scanned_by)
    values (v_reg.id, v_ticket, 'duplicate', auth.uid());
    return jsonb_build_object('result', 'duplicate', 'registration_id', v_reg.id, 'name', v_reg.name,
      'x_username', v_reg.x_username, 'ticket_number', v_reg.ticket_number,
      'checked_in_at', v_reg.checked_in_at, 'checked_in_by_name', v_by,
      'kit_claimed', v_reg.kit_claimed, 'receipt_verified', v_reg.receipt_verified);
  end if;

  update public.registrations
     set checked_in_at = now(), checked_in_by = auth.uid(),
         kit_claimed = coalesce(p_kit, kit_claimed), receipt_verified = coalesce(p_receipt, receipt_verified)
   where id = v_reg.id returning * into v_reg;
  insert into public.attendance_logs (registration_id, ticket_number_scanned, result, scanned_by)
  values (v_reg.id, v_ticket, 'success', auth.uid());
  select coalesce(full_name, email) into v_by from public.profiles where id = auth.uid();

  return jsonb_build_object('result', 'success', 'registration_id', v_reg.id, 'name', v_reg.name,
    'x_username', v_reg.x_username, 'ticket_number', v_reg.ticket_number,
    'checked_in_at', v_reg.checked_in_at, 'checked_in_by_name', v_by,
    'kit_claimed', v_reg.kit_claimed, 'receipt_verified', v_reg.receipt_verified);
end $$;

create or replace function public.mark_attendance(p_registration_id uuid, p_present boolean) returns public.registrations
language plpgsql security definer set search_path = public as $$
declare v_reg public.registrations;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.registrations
     set checked_in_at = case when p_present then coalesce(checked_in_at, now()) end,
         checked_in_by = case when p_present then coalesce(checked_in_by, auth.uid()) end
   where id = p_registration_id and status = 'confirmed' and ticket_number is not null returning * into v_reg;
  if not found then raise exception 'NOT_FOUND'; end if;
  return v_reg;
end $$;

revoke execute on function public.submit_registration(uuid, text, text, text, text, text, text, boolean, uuid, text, numeric, text, text) from public, anon;
revoke execute on function public.resubmit_payment(uuid, text, numeric, text, text) from public, anon;
revoke execute on function public.review_payment(uuid, text, text, boolean, numeric) from public, anon;
revoke execute on function public.check_in_attendee(text, boolean, boolean) from public, anon;
revoke execute on function public.mark_attendance(uuid, boolean) from public, anon;
grant execute on function public.submit_registration(uuid, text, text, text, text, text, text, boolean, uuid, text, numeric, text, text) to authenticated;
grant execute on function public.resubmit_payment(uuid, text, numeric, text, text) to authenticated;
grant execute on function public.review_payment(uuid, text, text, boolean, numeric) to authenticated;
grant execute on function public.check_in_attendee(text, boolean, boolean) to authenticated;
grant execute on function public.mark_attendance(uuid, boolean) to authenticated;

-- ---------- Row Level Security ------------------------------------------------------
alter table public.payments     enable row level security;
alter table public.event_images enable row level security;

-- Attendees read only their own payments. There is no insert/update policy: the RPCs are the only way to write.
create policy payments_select_own on public.payments for select to authenticated using (user_id = auth.uid());
create policy payments_admin_all  on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy event_images_public_read on public.event_images for select to anon, authenticated using (true);
create policy event_images_admin_all   on public.event_images for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.event_images to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.payments; exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------- Storage -----------------------------------------------------------------
-- event-media: public read, admin write.   payment-receipts: PRIVATE; people upload into their own folder
-- (<user id>/<uuid>.<ext>) and read only their own files; admins read everything (signed URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('event-media',      'event-media',      true,  5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('payment-receipts', 'payment-receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- at most 20 receipt uploads per user per hour (counted without RLS so the policy cannot recurse)
create function public.can_upload_receipt() returns boolean
language sql stable security definer set search_path = public, storage as $$
  select count(*) < 20 from storage.objects
   where bucket_id = 'payment-receipts' and name like auth.uid()::text || '/%' and created_at > now() - interval '1 hour';
$$;

drop policy if exists event_media_read on storage.objects;
drop policy if exists event_media_admin_insert on storage.objects;
drop policy if exists event_media_admin_update on storage.objects;
drop policy if exists event_media_admin_delete on storage.objects;
drop policy if exists receipts_insert_own on storage.objects;
drop policy if exists receipts_select_own_or_admin on storage.objects;
drop policy if exists receipts_admin_delete on storage.objects;

create policy event_media_read         on storage.objects for select to anon, authenticated using (bucket_id = 'event-media');
create policy event_media_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'event-media' and public.is_admin());
create policy event_media_admin_update on storage.objects for update to authenticated using (bucket_id = 'event-media' and public.is_admin()) with check (bucket_id = 'event-media' and public.is_admin());
create policy event_media_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'event-media' and public.is_admin());

create policy receipts_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text and public.can_upload_receipt());
create policy receipts_select_own_or_admin on storage.objects for select to authenticated
  using (bucket_id = 'payment-receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy receipts_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'payment-receipts' and public.is_admin());

-- =====================================================================================
-- Seed: IVEMON: ODD PLATINUM Cupsleeve Event (dates and details exactly as in the reference form)
-- The default email templates are created by the events_default_templates trigger.
-- NOTE: the dates below are in the past, so the form shows "Registration closed". To test the form,
-- run the commented UPDATE at the bottom, or change the dates in Admin > Events.
-- ASSUMPTIONS: capacity 100 (the reference form gives none), ticket prefix IVEMONOP, the payment
-- account name is the masked example from the brief and the number is a placeholder.
-- =====================================================================================
insert into public.events (
  title, subtitle, description, venue, venue_address, event_date, ends_at, registration_deadline,
  capacity, ticket_prefix, registration_fee, fee_note, price_info, hashtags, kit_inclusions,
  payment_account_name, payment_account_number, contact_links, terms_html
)
select
  'IVEMON: ODD PLATINUM Cupsleeve Event',
  'IVE''s Kim Gaeul Cupsleeve Event hosted by Teenfresh',
  'IVE''s Kim Gaeul Cupsleeve Event hosted by Teenfresh',
  'Psicom Blue Club',
  '6 Yale St., Cubao, Quezon City, Philippines, 1109',
  timestamptz '2026-10-04 14:00:00+08',
  timestamptz '2026-10-04 17:00:00+08',
  timestamptz '2026-09-30 23:59:59+08',
  100, 'IVEMONOP', 100.00,
  'exclusive of food and drinks',
  '100 PHP pre-registration (exclusive of food and drinks)',
  array['#IVEMON_OP', '#Teenfresh', '#IVE', '#Gaeul'],
  array['(1) Cupsleeve', '(1) Trading Card', '(2) Mezastar Tags'],
  'BR**N CA**O S.', '09XXXXXXXXX',
  '[{"label":"Facebook","url":"https://www.facebook.com/TeenfreshPH"},
    {"label":"X","url":"https://x.com/TeenfreshPH"},
    {"label":"Instagram","url":"https://www.instagram.com/teenfreshph"},
    {"label":"TikTok","url":"https://www.tiktok.com/@teenfreshph"},
    {"label":"Gmail","url":"mailto:teenfreshph@gmail.com"}]'::jsonb,
  $terms$<p>Please read these Terms and Conditions ("Terms", "Terms and Conditions") carefully before filling up the form.</p>
<ol>
<li>Be 101% sure before you place your order(s). Make sure that you have written the correct information(s) on the form. Double or Triple check your details before submitting the form.</li>
<li>Strictly <strong>NO CANCELLATION</strong> of order(s) and/or <strong>REFUNDS</strong>. Slots are transferrable for those who are unable to attend on the event date, unclaimed kits after the event will be <strong>FORFEITED</strong>. Shipment of the kits are <strong>NOT ALLOWED</strong> and must be claimed only at the event proper.</li>
<li>Pre-Registration fee is 100 PHP (food and drinks not included) and must be paid upon filling up this form. <strong>1 Form = 1 Entry per person only</strong>, same payment details can be used in the <strong>payment section</strong> of this form. Kindly avoid using 'Money Protect' feature to avoid inconveniences and cancellation of your slot.</li>
<li>Buy any food and drinks at the venue worth <strong>ATLEAST 200 PHP</strong> in total. Kindly present the receipt of your food purchase to the registration area to claim your Kit. Outside food and drinks are <strong>NOT ALLOWED</strong> inside the venue.</li>
<li>Registration area at the venue opens at 2 pm. Kindly present your confirmation email to confirm your attendance and claim your kits.</li>
<li>Convenience/Transaction fees (e.g Cash in thru Store outlets) are <strong>NOT COVERED</strong> in the kit price, hence sending insufficient amount for the kits because of the said fees will not be counted unless the remaining amount is paid.</li>
<li>Transferring of slots can be made by sending your confirmation email to the new owner by forwarding it, <strong>we are not responsible for any unauthorized leaks of your ticket for transferring slots.</strong></li>
<li>A confirmation email will be sent within 48-72 hours after submitting the form. <strong>Kindly keep it confidential as it is your personal ticket for entry.</strong></li>
<li>In any case of delays on some inclusions of the kit, participants will be notified thru email on how to claim them.</li>
<li><strong>By submitting this form</strong>, you consent to being featured in photos and videos taken during the event, which may be posted on our social media pages.</li>
</ol>$terms$
where not exists (select 1 from public.events where title = 'IVEMON: ODD PLATINUM Cupsleeve Event');

-- To test the form today, move the ODD PLATINUM dates into the future (uncomment and run):
-- update public.events
--    set event_date = now() + interval '30 days',
--        ends_at = now() + interval '30 days 3 hours',
--        registration_deadline = now() + interval '25 days'
--  where title = 'IVEMON: ODD PLATINUM Cupsleeve Event';
