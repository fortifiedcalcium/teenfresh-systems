-- 022: The shopper can no longer change their courier once the shipping fee is set. Run AFTER 021_product_categories.sql.
-- Until an admin sets the fee (shipping_status = 'none') the shopper may still pick or change it. From then on the courier is
-- fixed for them, because the fee may depend on it. Admins can still change it (they update the order directly).

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
  if o.shipping_status <> 'none' then raise exception 'COURIER_LOCKED'; end if;
  if v_c is null or char_length(v_c) > 60 then raise exception 'INVALID_COURIER'; end if;
  update public.orders set preferred_courier = v_c, updated_at = now() where id = p_order;
  return jsonb_build_object('preferred_courier', v_c);
end $$;

revoke all on function public.set_preferred_courier(uuid, text) from public, anon;
grant execute on function public.set_preferred_courier(uuid, text) to authenticated;
