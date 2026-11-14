-- 020: The shopper's preferred courier. Run AFTER 019_order_tracking.sql.
-- The shopper picks it on their order page until the order ships; the admin sees it and uses it as the starting choice when shipping.
-- (orders.courier stays the courier the admin actually used.)

alter table public.orders
  add column if not exists preferred_courier text check (preferred_courier is null or char_length(btrim(preferred_courier)) between 1 and 60);

create or replace function public.set_preferred_courier(p_order uuid, p_courier text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_c   text := nullif(btrim(coalesce(p_courier, '')), '');
  o     public.orders;
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into o from public.orders where id = p_order and user_id = v_uid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status not in ('pending', 'paid') then raise exception 'ORDER_LOCKED'; end if;
  if v_c is null or char_length(v_c) > 60 then raise exception 'INVALID_COURIER'; end if;
  update public.orders set preferred_courier = v_c, updated_at = now() where id = p_order;
  return jsonb_build_object('preferred_courier', v_c);
end $$;

revoke all on function public.set_preferred_courier(uuid, text) from public, anon;
grant execute on function public.set_preferred_courier(uuid, text) to authenticated;
