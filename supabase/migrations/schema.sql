-- =====================================================================================
-- Event registration & attendance: single migration (Supabase / Postgres 15+)
-- Run once in the Supabase SQL Editor. Safe to read top to bottom.
-- =====================================================================================

-- ---------- profiles --------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null default '',
  full_name  text,
  role       text not null default 'attendee' check (role in ('attendee', 'admin')),
  created_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));

-- Every new auth user (email/password or Google) gets a profile with role 'attendee'.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''),
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- users that already exist when this migration runs
insert into public.profiles (id, email, full_name)
select id, coalesce(email, ''), coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name')
from auth.users on conflict (id) do nothing;

-- Used by every admin RLS policy and RPC. SECURITY DEFINER so it can read profiles without
-- recursing into profiles' own policies.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- A signed-in user may edit their own profile row but can never change their role or email.
-- (auth.uid() is null for the SQL editor / service role, so promoting by SQL still works.)
create function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.id := old.id; new.role := old.role; new.email := old.email;
  end if;
  return new;
end $$;
create trigger guard_profile_update before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------- events ----------------------------------------------------------------
create sequence public.ticket_seq;  -- one global sequence: ticket numbers never repeat

create table public.events (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  description       text,
  banner_url        text,
  event_date        timestamptz not null,
  venue             text,
  price_info        text,
  capacity          integer not null check (capacity > 0),
  registration_open boolean not null default true,
  ticket_prefix     text not null default 'TICKET' check (ticket_prefix ~ '^[A-Z0-9]{2,12}$'),
  -- The Terms live here, once. The registration form and the confirmation email both read them.
  terms_intro       text,
  terms_items       text[] not null default '{}',
  created_at        timestamptz not null default now()
);

-- Public, attendee-data-free counter. Realtime streams this table to the home page
-- (the registrations table itself is private, so it cannot be streamed to visitors).
create table public.event_counts (
  event_id   uuid primary key references public.events (id) on delete cascade,
  registered integer not null default 0
);

create function public.events_init_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_counts (event_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger events_init_count after insert on public.events
  for each row execute function public.events_init_count();

create view public.event_availability as
  select e.id as event_id, e.capacity, c.registered,
         greatest(e.capacity - c.registered, 0) as slots_left
  from public.events e join public.event_counts c on c.event_id = e.id;

-- ---------- registrations ---------------------------------------------------------
create table public.registrations (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  name             text not null,
  x_username       text not null,
  email            text not null,
  contact_number   text,
  ticket_number    text not null unique,
  status           text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  checked_in_at    timestamptz,
  checked_in_by    uuid,
  kit_claimed      boolean not null default false,
  receipt_verified boolean not null default false,
  created_at       timestamptz not null default now(),
  constraint registrations_event_user_key unique (event_id, user_id),
  constraint registrations_checked_in_by_fkey foreign key (checked_in_by) references public.profiles (id) on delete set null
);
create index registrations_event_idx on public.registrations (event_id, created_at);

create function public.refresh_event_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_event uuid := coalesce(new.event_id, old.event_id);
begin
  update public.event_counts
     set registered = (select count(*) from public.registrations where event_id = v_event and status = 'confirmed')
   where event_id = v_event;
  return null;
end $$;
create trigger registrations_count after insert or update of status or delete on public.registrations
  for each row execute function public.refresh_event_count();

-- Who changed an attendee's details and when (transfers, cancellations).
create table public.registration_changes (
  id              bigint generated always as identity primary key,
  registration_id uuid references public.registrations (id) on delete cascade,
  changed_by      uuid,
  action          text not null,
  old_values      jsonb,
  new_values      jsonb,
  changed_at      timestamptz not null default now()
);

create function public.log_registration_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.name, new.email, new.x_username) is distinct from (old.name, old.email, old.x_username) then
    insert into public.registration_changes (registration_id, changed_by, action, old_values, new_values)
    values (new.id, auth.uid(), 'transfer_or_edit',
            jsonb_build_object('name', old.name, 'email', old.email, 'x_username', old.x_username),
            jsonb_build_object('name', new.name, 'email', new.email, 'x_username', new.x_username));
  end if;
  if new.status is distinct from old.status then
    insert into public.registration_changes (registration_id, changed_by, action, old_values, new_values)
    values (new.id, auth.uid(), 'status', jsonb_build_object('status', old.status), jsonb_build_object('status', new.status));
  end if;
  return new;
end $$;
create trigger registrations_log_change after update on public.registrations
  for each row execute function public.log_registration_change();

-- ---------- email -----------------------------------------------------------------
create table public.email_templates (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null unique references public.events (id) on delete cascade,
  subject    text not null,
  html_body  text not null,
  text_body  text not null,
  updated_at timestamptz not null default now()
);

create table public.email_logs (
  id              bigint generated always as identity primary key,
  registration_id uuid references public.registrations (id) on delete cascade,
  recipient       text,
  kind            text not null default 'confirmation' check (kind in ('confirmation', 'bulk', 'test')),
  status          text not null check (status in ('sent', 'failed')),
  error           text,
  sent_at         timestamptz not null default now()
);
create index email_logs_reg_idx on public.email_logs (registration_id, sent_at desc);

-- Latest confirmation-email result per registration (RLS of the caller applies).
create view public.registration_email_status with (security_invoker = true) as
  select distinct on (l.registration_id) l.registration_id, r.event_id, l.status, l.error, l.sent_at
  from public.email_logs l join public.registrations r on r.id = l.registration_id
  where l.kind = 'confirmation'
  order by l.registration_id, l.sent_at desc, l.id desc;

-- ---------- attendance audit log --------------------------------------------------
create table public.attendance_logs (
  id                    bigint generated always as identity primary key,
  registration_id       uuid references public.registrations (id) on delete set null,
  ticket_number_scanned text,
  result                text not null check (result in ('success', 'duplicate', 'invalid')),
  scanned_by            uuid,
  scanned_at            timestamptz not null default now(),
  constraint attendance_logs_scanned_by_fkey foreign key (scanned_by) references public.profiles (id) on delete set null
);
create index attendance_logs_time_idx on public.attendance_logs (scanned_at desc);

-- =====================================================================================
-- RPCs
-- =====================================================================================

-- Atomic, capacity-safe registration. Attendees have NO insert policy on registrations; this
-- function is the only way in, so the checks below cannot be skipped from the browser.
create function public.register_for_event(
  p_event_id uuid, p_name text, p_x_username text, p_email text,
  p_contact text default null, p_agreed boolean default false
) returns public.registrations
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_event public.events;
  v_x     text := regexp_replace(trim(coalesce(p_x_username, '')), '^@+', '');
  v_name  text := trim(coalesce(p_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_reg   public.registrations;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce(p_agreed, false) then raise exception 'TERMS_NOT_ACCEPTED'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 100 then raise exception 'INVALID_NAME'; end if;
  if v_x !~ '^[A-Za-z0-9_]{1,15}$' then raise exception 'INVALID_X_USERNAME'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'INVALID_EMAIL'; end if;
  if nullif(trim(coalesce(p_contact, '')), '') is not null and trim(p_contact) !~ '^[0-9+()\- ]{7,20}$' then
    raise exception 'INVALID_CONTACT';
  end if;

  -- CAPACITY LOCK: FOR UPDATE on the event row makes concurrent registrations for the same
  -- event queue up. The count below is therefore always current, so two people can never
  -- both take the last slot.
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not v_event.registration_open or v_event.event_date <= now() then raise exception 'REGISTRATION_CLOSED'; end if;
  if exists (select 1 from public.registrations where event_id = p_event_id and user_id = v_uid) then
    raise exception 'ALREADY_REGISTERED';
  end if;
  if (select count(*) from public.registrations where event_id = p_event_id and status = 'confirmed') >= v_event.capacity then
    raise exception 'SOLD_OUT';
  end if;

  insert into public.registrations (event_id, user_id, name, x_username, email, contact_number, ticket_number)
  values (p_event_id, v_uid, v_name, v_x, v_email, nullif(trim(coalesce(p_contact, '')), ''),
          v_event.ticket_prefix || '-' || lpad(nextval('public.ticket_seq')::text, 6, '0'))
  returning * into v_reg;
  return v_reg;
end $$;

-- Server-side check-in for the scanner and the manual fallback. Admin only.
create function public.check_in_attendee(
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

  -- Row lock: two staff scanning the same ticket at once cannot both "succeed".
  select * into v_reg from public.registrations where ticket_number = v_ticket for update;
  v_found := found;

  if not v_found or v_reg.status <> 'confirmed' then
    insert into public.attendance_logs (registration_id, ticket_number_scanned, result, scanned_by)
    values (case when v_found then v_reg.id end, left(coalesce(p_ticket, ''), 64), 'invalid', auth.uid());
    return jsonb_build_object('result', 'invalid', 'ticket_number', v_ticket,
                              'reason', case when v_found then 'cancelled' else 'not_found' end);
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

-- Manual attendance toggle from the Attendees table.
create function public.mark_attendance(p_registration_id uuid, p_present boolean) returns public.registrations
language plpgsql security definer set search_path = public as $$
declare v_reg public.registrations;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.registrations
     set checked_in_at = case when p_present then coalesce(checked_in_at, now()) end,
         checked_in_by = case when p_present then coalesce(checked_in_by, auth.uid()) end
   where id = p_registration_id returning * into v_reg;
  if not found then raise exception 'NOT_FOUND'; end if;
  return v_reg;
end $$;

revoke execute on function public.register_for_event(uuid, text, text, text, text, boolean) from public, anon;
revoke execute on function public.check_in_attendee(text, boolean, boolean) from public, anon;
revoke execute on function public.mark_attendance(uuid, boolean) from public, anon;
grant execute on function public.register_for_event(uuid, text, text, text, text, boolean) to authenticated;
grant execute on function public.check_in_attendee(text, boolean, boolean) to authenticated;
grant execute on function public.mark_attendance(uuid, boolean) to authenticated;

-- =====================================================================================
-- Row Level Security
-- =====================================================================================
alter table public.profiles             enable row level security;
alter table public.events               enable row level security;
alter table public.event_counts         enable row level security;
alter table public.registrations        enable row level security;
alter table public.registration_changes enable row level security;
alter table public.email_templates      enable row level security;
alter table public.email_logs           enable row level security;
alter table public.attendance_logs      enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy events_public_read on public.events for select to anon, authenticated using (true);
create policy events_admin_all on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy counts_public_read on public.event_counts for select to anon, authenticated using (true);

-- Attendees: read their own rows only. No insert/update/delete policy: writes go through the RPC.
create policy registrations_select_own on public.registrations for select to authenticated using (user_id = auth.uid());
create policy registrations_admin_all on public.registrations for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy changes_admin_read on public.registration_changes for select to authenticated using (public.is_admin());
create policy templates_admin_all on public.email_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy email_logs_admin_all on public.email_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy attendance_admin_all on public.attendance_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.event_availability to anon, authenticated;
grant select on public.registration_email_status to authenticated;

-- ---------- Realtime --------------------------------------------------------------
-- Realtime respects RLS: visitors get event_counts only; admins also get registrations/logs.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.event_counts, public.registrations, public.attendance_logs;
  end if;
end $$;

-- =====================================================================================
-- Seed: the IVEMON event + its confirmation email template
-- ASSUMPTIONS: date 20 Dec 2026, 2 pm Manila time; capacity 100; venue "To be announced".
-- Change them in Admin > Events.
-- =====================================================================================
insert into public.events (title, description, banner_url, event_date, venue, price_info, capacity, ticket_prefix, terms_intro, terms_items)
values (
  'IVEMON: BRILLIANT FORCE & SHINING EIGHT Cupsleeve Event',
  'Join us for the IVEMON: BRILLIANT FORCE & SHINING EIGHT Cupsleeve Event!',
  '/banners/ivemon.png',
  timestamptz '2026-12-20 14:00:00+08',
  'To be announced',
  'Free registration. Minimum food & drink purchase of PHP 200 at the venue.',
  100,
  'IVEMON',
  $t$Please read these Terms and Conditions ("Terms", "Terms and Conditions") carefully.$t$,
  array[
    $t$Strictly NO CANCELLATION of order(s) and/or REFUNDS. Slots are transferrable for those who are unable to attend on the event date, unclaimed kits will be FORFEITED. Shipment of the kits are NOT ALLOWED and must be claimed only at the event proper.$t$,
    $t$Buy any food and drinks at the venue worth ATLEAST 200 PHP in total. Kindly present the receipt of your food purchase to the registration area to claim your Kit. Outside food and drinks are NOT ALLOWED inside the venue.$t$,
    $t$Registration area at the venue opens at 2 pm. Kindly present this confirmation email alongside the stub that will be given to you by the cashier upon ordering.$t$,
    $t$Transferring of slots can be made by sending your confirmation email to the new owner by forwarding it, we are not responsible for any unauthorized leaks of your ticket for transferring slots.$t$,
    $t$Kindly keep this confirmation email confidential as it is your personal ticket for entry.$t$,
    $t$In any case of delays on some inclusions of the kit, participants will be notified thru email on how to claim them.$t$
  ]
);

insert into public.email_templates (event_id, subject, html_body, text_body)
select id,
$s$Confirmation email - IVEMON: BRILLIANT FORCE & SHINING EIGHT Cupsleeve Event$s$,
$html$<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222;background:#ffffff;">
<div style="max-width:800px;margin:0 auto;">
<img src="{{Banner URL}}" alt="IVEMON: Brilliant Force &amp; Shining Eight" width="800" style="display:block;width:100%;max-width:800px;height:auto;border:0;margin:0 0 20px 0;">
<p style="margin:0 0 16px 0;">Thank you for your interest in joining IVEMON: BRILLIANT FORCE &amp; SHINING EIGHT Cupsleeve Event! This will serve as your confirmation email, to summarize:</p>
<p style="margin:0 0 16px 0;">Name: {{Name}}<br>Twitter Username: {{X/Twitter Username}}<br>Ticket Number: {{Ticket Number}}</p>
{{Terms}}
<p style="margin:0 0 16px 0;">If you have any concerns, please do not hesitate to contact us in any of our social media accounts!<br>Facebook: <a href="https://www.facebook.com/TeenfreshPH" style="color:#1c5a85;text-decoration:underline;">https://www.facebook.com/TeenfreshPH</a><br>X: <a href="https://x.com/TeenfreshPH" style="color:#1c5a85;text-decoration:underline;">https://x.com/TeenfreshPH</a></p>
<p style="margin:0 0 12px 0;">Best Regards,</p>
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
</div>$html$,
$text$Thank you for your interest in joining IVEMON: BRILLIANT FORCE & SHINING EIGHT Cupsleeve Event! This will serve as your confirmation email, to summarize:

Name: {{Name}}
Twitter Username: {{X/Twitter Username}}
Ticket Number: {{Ticket Number}}

{{Terms}}

If you have any concerns, please do not hesitate to contact us in any of our social media accounts!
Facebook: https://www.facebook.com/TeenfreshPH
X: https://x.com/TeenfreshPH

Best Regards,
Teenfresh
/TeenfreshPH (Facebook)
@TeenfreshPH (X)
$text$
from public.events where ticket_prefix = 'IVEMON';

-- =====================================================================================
-- Make yourself an admin (after you have signed up once):
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- =====================================================================================
