-- 026: Live notifications for orders. Run AFTER 025_universal_change_log.sql.
-- The admin bell and its toasts update the moment an order changes, through Supabase Realtime. Payments already do (migration 002);
-- this adds orders. Without it the bell still works: it re-counts every minute and whenever the page is opened.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.orders;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
