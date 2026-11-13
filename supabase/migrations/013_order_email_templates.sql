-- 013: Editable wording of the shop order emails. Run AFTER 012_order_emails.sql.
-- One row per email. The send-order-email function uses the row when it exists and its built-in wording otherwise,
-- so deleting a row (or "Restore default wording" in the admin) brings the original text back.
-- Placeholders in the text: {{Name}}, {{Order Number}}, {{Total}}.

create table if not exists public.order_email_templates (
  kind        text primary key check (kind in ('order_received', 'order_paid', 'order_shipped', 'order_cancelled')),
  subject     text not null check (char_length(btrim(subject)) between 1 and 200),
  heading     text not null check (char_length(btrim(heading)) between 1 and 120),
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  updated_at  timestamptz not null default now()
);

alter table public.order_email_templates enable row level security;
drop policy if exists order_email_templates_admin_all on public.order_email_templates;
create policy order_email_templates_admin_all on public.order_email_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
