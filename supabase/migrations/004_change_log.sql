-- 004: change log. Run in the SQL Editor of the event project (fnhamldmvpdcygjbzdls), after 003.
-- An append-only record of who changed what, shown to admins in Admin -> Change log.
-- It is filled by triggers (not by the browser), so it cannot be skipped or edited from the app: there are
-- no insert/update/delete policies, only an admin read policy.
-- Privacy: contact details and payment identifiers are recorded as "[changed]" without their values, and any
-- other value is cut to 200 characters. The log holds who/what/when, not copies of personal data.

create table public.change_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,                 -- null = SQL editor / service role
  actor_email text,
  table_name  text not null,
  row_id      text,
  event_id    uuid,
  action      text not null check (action in ('insert', 'update', 'delete')),
  label       text,                 -- what the row is (event title, kit name, ticket number, ...)
  changes     jsonb                 -- { column: { old, new } } for updates; { column: new } for inserts
);
create index change_log_at_idx on public.change_log (at desc, id desc);
create index change_log_event_idx on public.change_log (event_id, at desc);

alter table public.change_log enable row level security;
create policy change_log_admin_read on public.change_log for select to authenticated using (public.is_admin());

create function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  n jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  ignore text[] := array['id', 'created_at', 'updated_at', 'event_id', 'user_id', 'description', 'html_body', 'text_body', 'subject', 'terms_html', 'receipt_deleted_at', 'receipt_history', 'reference_history'];
  redact text[] := array['name', 'x_username', 'email', 'contact_number', 'facebook_url', 'sender_name', 'reference_number', 'receipt_path', 'notes', 'phone'];
  k text;
  diff jsonb := '{}'::jsonb;
  ov jsonb; nv jsonb;
  v_actor uuid := auth.uid();
  v_label text;
  v_event uuid;
begin
  for k in select jsonb_object_keys(r) loop
    continue when k = any(ignore);
    ov := o -> k; nv := n -> k;
    if tg_op = 'UPDATE' and ov is not distinct from nv then continue; end if;
    if k = any(redact) then
      diff := diff || jsonb_build_object(k, '[changed]');
    elsif tg_op = 'UPDATE' then
      diff := diff || jsonb_build_object(k, jsonb_build_object('old', left(ov #>> '{}', 200), 'new', left(nv #>> '{}', 200)));
    else
      diff := diff || jsonb_build_object(k, left(r -> k #>> '{}', 200));
    end if;
  end loop;
  if tg_op = 'UPDATE' and diff = '{}'::jsonb then return null; end if;   -- only ignored columns changed

  v_label := case tg_table_name
    when 'events' then r ->> 'title'
    when 'event_kits' then r ->> 'name'
    when 'registrations' then coalesce(r ->> 'ticket_number', 'registration ' || left(r ->> 'id', 8))
    when 'email_templates' then r ->> 'kind'
    when 'profiles' then r ->> 'email'
    when 'payments' then 'payment ' || left(r ->> 'id', 8)
  end;
  v_event := case tg_table_name when 'events' then (r ->> 'id')::uuid else nullif(r ->> 'event_id', '')::uuid end;

  insert into public.change_log (actor_id, actor_email, table_name, row_id, event_id, action, label, changes)
  values (v_actor, (select email from public.profiles where id = v_actor), tg_table_name, r ->> 'id', v_event, lower(tg_op), v_label, diff);
  return null;
end $$;

create trigger events_log          after insert or update or delete on public.events          for each row execute function public.log_change();
create trigger event_kits_log      after insert or update or delete on public.event_kits      for each row execute function public.log_change();
create trigger email_templates_log after insert or update or delete on public.email_templates for each row execute function public.log_change();
create trigger registrations_log   after insert or update or delete on public.registrations   for each row execute function public.log_change();
create trigger payments_log        after insert or update or delete on public.payments        for each row execute function public.log_change();
-- Profiles: only role changes (promote/demote); sign-ups and name edits are not logged.
create trigger profiles_role_log   after update of role on public.profiles                     for each row execute function public.log_change();
