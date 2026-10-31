-- =====================================================================================
-- 003: kit options, quantity and price per kit. Run AFTER 002_registration_payments.sql.
--
-- An event can offer several kit options (name, price per kit, how many one form may order).
-- A form picks one kit and a quantity; the amount to pay is quantity x price, calculated by the
-- database (never trusted from the browser). Events with NO kit options keep working exactly as
-- before: one flat registration fee, quantity 1.
--
-- Existing registrations keep their data: they are marked quantity 1 at the event's old fee.
-- Shared payments now work by BALANCE (paid minus the totals of the forms already attached)
-- instead of "one form per full fee", because forms can now cost different amounts.
-- =====================================================================================

create table public.event_kits (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 1 and 80),
  description   text,
  unit_price    numeric(10,2) not null check (unit_price > 0),    -- amount per kit
  max_per_order integer not null default 5 check (max_per_order between 1 and 50),
  sort_order    integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index event_kits_event_idx on public.event_kits (event_id, sort_order);

alter table public.event_kits enable row level security;
-- Visitors see active kits (the form needs them); admins see and manage all, including switched-off ones.
create policy event_kits_read on public.event_kits for select to anon, authenticated using (active or public.is_admin());
create policy event_kits_admin_all on public.event_kits for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.event_kits to anon, authenticated;

-- What was ordered is copied onto the registration, so later price changes or a deleted kit never rewrite history.
alter table public.registrations
  add column kit_id         uuid,
  add column kit_name       text,
  add column kit_quantity   integer not null default 1 check (kit_quantity between 1 and 50),
  add column kit_unit_price numeric(10,2),
  add column total_amount   numeric(10,2) not null default 0 check (total_amount >= 0);
alter table public.registrations add constraint registrations_kit_id_fkey
  foreign key (kit_id) references public.event_kits (id) on delete set null;

update public.registrations r
   set kit_unit_price = e.registration_fee, total_amount = e.registration_fee,
       kit_name = case when e.registration_fee > 0 then 'Registration' end
  from public.events e where e.id = r.event_id;

-- ---------- submit_registration: now with a kit and a quantity ------------------------
drop function if exists public.submit_registration(uuid, text, text, text, text, text, text, boolean, uuid, text, numeric, text, text);

create function public.submit_registration(
  p_event_id uuid, p_name text, p_x_username text, p_email text, p_facebook text, p_contact text,
  p_notes text, p_agreed boolean,
  p_payment_id uuid default null,                       -- reuse one of my earlier payments ...
  p_sender_name text default null, p_amount numeric default null,   -- ... or enter a new one
  p_reference text default null, p_receipt_path text default null,
  p_kit_id uuid default null, p_quantity integer default 1
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_event  public.events;
  v_kit    public.event_kits;
  v_name   text := trim(coalesce(p_name, ''));
  v_x      text := public.normalize_x_username(p_x_username);
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_fb     text := public.normalize_facebook(p_facebook);
  v_phone  text := public.normalize_phone(p_contact);
  v_notes  text := nullif(trim(coalesce(p_notes, '')), '');
  v_qty    integer := coalesce(p_quantity, 1);
  v_unit   numeric;
  v_total  numeric;
  v_kitname text;
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
  if (select count(*) from public.registrations where event_id = p_event_id and status in ('pending_verification', 'confirmed')) >= v_event.capacity then
    raise exception 'SOLD_OUT';
  end if;
  if exists (select 1 from public.registrations where event_id = p_event_id and lower(x_username) = lower(v_x)
              and status in ('pending_verification', 'confirmed')) then
    raise exception 'ALREADY_REGISTERED';
  end if;

  -- WHAT IS BEING ORDERED, and what it costs. The price always comes from the kit row, never from the browser.
  if exists (select 1 from public.event_kits where event_id = p_event_id and active) then
    select * into v_kit from public.event_kits where id = p_kit_id and event_id = p_event_id and active;
    if not found then raise exception 'INVALID_KIT'; end if;
    if v_qty < 1 or v_qty > v_kit.max_per_order then raise exception 'INVALID_QUANTITY'; end if;
    v_unit := v_kit.unit_price; v_kitname := v_kit.name;
  else
    if v_qty <> 1 or p_kit_id is not null then raise exception 'INVALID_QUANTITY'; end if;   -- no kit options: one flat fee
    v_unit := v_event.registration_fee; v_kitname := case when v_unit > 0 then 'Registration' end;
  end if;
  v_total := round(v_unit * v_qty, 2);

  if v_total > 0 then
    if p_payment_id is not null then
      -- shared payment: what is left = amount paid minus the totals of the forms already attached to it
      select * into v_pay from public.payments where id = p_payment_id and user_id = v_uid and event_id = p_event_id for update;
      if not found or v_pay.status not in ('pending', 'verified') then raise exception 'INVALID_PAYMENT'; end if;
      if v_pay.amount_paid - coalesce((select sum(total_amount) from public.registrations
           where payment_id = v_pay.id and status in ('pending_verification', 'confirmed')), 0) < v_total then
        raise exception 'PAYMENT_BALANCE_TOO_LOW';
      end if;
      if v_pay.status = 'verified' then v_status := 'confirmed'; end if;   -- already verified: no second review needed
    else
      if char_length(trim(coalesce(p_sender_name, ''))) < 2 or char_length(trim(p_sender_name)) > 100 then raise exception 'INVALID_SENDER'; end if;
      if v_amount < v_total then raise exception 'AMOUNT_TOO_LOW'; end if;
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
                                    payment_id, terms_accepted_at, status, ticket_number,
                                    kit_id, kit_name, kit_quantity, kit_unit_price, total_amount)
  values (p_event_id, v_uid, v_name, v_x, v_email, v_fb, v_phone, v_notes, v_pay.id, now(), v_status, v_ticket,
          v_kit.id, v_kitname, v_qty, v_unit, v_total)
  returning * into v_reg;

  return jsonb_build_object('registration_id', v_reg.id, 'payment_id', v_pay.id, 'status', v_reg.status, 'ticket_number', v_reg.ticket_number,
                            'kit_name', v_reg.kit_name, 'kit_quantity', v_reg.kit_quantity, 'total_amount', v_reg.total_amount);
end $$;

-- ---------- resubmit_payment: the minimum is the total of the forms, not fee x forms ----
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
  v_min := case when v_needed > 0 then v_needed else v_event.registration_fee end;   -- what the attached forms add up to
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
         sender_name = trim(p_sender_name), amount_paid = v_amount, reference_number = v_ref, receipt_path = p_receipt_path,
         status = 'pending', amount_due = null, review_note = null, reviewed_by = null, reviewed_at = null,
         receipt_deleted_at = null, resubmission_count = resubmission_count + 1
   where id = v_pay.id;
  return jsonb_build_object('payment_id', v_pay.id, 'status', 'pending');
end $$;

-- ---------- review_payment: expected = the sum of the linked forms' totals ---------------
create or replace function public.review_payment(
  p_payment_id uuid, p_decision text, p_reason text default null,
  p_override boolean default false, p_amount_due numeric default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pay      public.payments;
  v_event    public.events;
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
    select coalesce(sum(total_amount), 0) into v_expected from public.registrations
     where payment_id = v_pay.id and status in ('pending_verification', 'confirmed');
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

-- ---------- check-in: show the kit so it can be handed over at the door ------------------
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
      'kit_name', v_reg.kit_name, 'kit_quantity', v_reg.kit_quantity,
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
    'kit_name', v_reg.kit_name, 'kit_quantity', v_reg.kit_quantity,
    'checked_in_at', v_reg.checked_in_at, 'checked_in_by_name', v_by,
    'kit_claimed', v_reg.kit_claimed, 'receipt_verified', v_reg.receipt_verified);
end $$;

revoke execute on function public.submit_registration(uuid, text, text, text, text, text, text, boolean, uuid, text, numeric, text, text, uuid, integer) from public, anon;
grant execute on function public.submit_registration(uuid, text, text, text, text, text, text, boolean, uuid, text, numeric, text, text, uuid, integer) to authenticated;
revoke execute on function public.resubmit_payment(uuid, text, numeric, text, text) from public, anon;
grant execute on function public.resubmit_payment(uuid, text, numeric, text, text) to authenticated;
revoke execute on function public.review_payment(uuid, text, text, boolean, numeric) from public, anon;
grant execute on function public.review_payment(uuid, text, text, boolean, numeric) to authenticated;
revoke execute on function public.check_in_attendee(text, boolean, boolean) from public, anon;
grant execute on function public.check_in_attendee(text, boolean, boolean) to authenticated;

-- Seed: one kit for ODD PLATINUM, at the reference form's price (edit or add more in Admin > Events > Kits)
insert into public.event_kits (event_id, name, description, unit_price, max_per_order, sort_order)
select e.id, 'Event kit', array_to_string(e.kit_inclusions, ', '), 100.00, 5, 0
  from public.events e
 where e.title = 'IVEMON: ODD PLATINUM Cupsleeve Event'
   and not exists (select 1 from public.event_kits k where k.event_id = e.id);
