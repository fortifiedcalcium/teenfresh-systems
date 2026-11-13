-- 012: A log of the emails sent for shop orders. Run AFTER 011_orders.sql.
-- The send-order-email Edge Function writes it (service role); admins can read it.

create table if not exists public.order_emails (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.orders (id) on delete cascade,
  kind       text not null check (kind in ('order_received', 'order_paid', 'order_shipped', 'order_cancelled')),
  recipient  text not null,
  status     text not null check (status in ('sent', 'failed')),
  error      text,
  sent_at    timestamptz not null default now()
);
create index if not exists order_emails_order_idx on public.order_emails (order_id, sent_at desc);

alter table public.order_emails enable row level security;
drop policy if exists order_emails_admin_read on public.order_emails;
create policy order_emails_admin_read on public.order_emails for select to authenticated using (public.is_admin());
