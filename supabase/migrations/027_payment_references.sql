-- 027: Every reference number of an order is kept, so the admin can list them. Run AFTER 026_notifications_realtime.sql.
-- Once everything is paid the receipts are deleted and only reference numbers are kept. An order can have several payments: the items,
-- an extra payment for the items, the shipping fee, an extra payment for the shipping fee. The first two references already have their own columns;
-- confirmed extra payments are now recorded in balance_references, as [{"for": "items" | "shipping", "reference": "..."}], in the order they were confirmed.

alter table public.orders add column if not exists balance_references jsonb not null default '[]'::jsonb;

-- extra payments confirmed before this migration: the last one is still in balance_reference_number
update public.orders
   set balance_references = jsonb_build_array(jsonb_build_object('for', balance_for, 'reference', balance_reference_number))
 where balance_references = '[]'::jsonb and balance_status = 'none' and balance_paid_php > 0 and balance_reference_number is not null and balance_for is not null;

create or replace function public.review_balance_payment(p_order uuid, p_approve boolean, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.balance_status <> 'pending_review' then raise exception 'NOT_PENDING'; end if;
  if p_approve then
    update public.orders set balance_paid_php = balance_paid_php + balance_due_php,
           balance_references = balance_references || jsonb_build_array(jsonb_build_object('for', balance_for, 'reference', balance_reference_number)),
           balance_status = 'none', balance_due_php = null, balance_note = null, updated_at = now() where id = p_order;
    return jsonb_build_object('balance_status', 'none');
  end if;
  if v_note is null or char_length(v_note) > 300 then raise exception 'REASON_REQUIRED'; end if;
  update public.orders set balance_status = 'awaiting_payment', balance_note = v_note, balance_sender_name = null, balance_reference_number = null, balance_receipt_path = null, updated_at = now() where id = p_order;
  return jsonb_build_object('balance_status', 'awaiting_payment');
end $$;

create or replace function public.reference_in_use(p_ref text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders where status <> 'cancelled'
    and public.normalize_reference(p_ref) in (public.normalize_reference(reference_number), public.normalize_reference(shipping_reference_number), public.normalize_reference(balance_reference_number)))
  or exists (select 1 from public.orders o, jsonb_array_elements(o.balance_references) e
    where o.status <> 'cancelled' and public.normalize_reference(p_ref) = public.normalize_reference(e ->> 'reference'));
$$;
revoke all on function public.reference_in_use(text) from public, anon, authenticated;

create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  n jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  ignore text[] := array['id', 'created_at', 'updated_at', 'event_id', 'user_id', 'description', 'html_body', 'text_body', 'subject', 'terms_html', 'receipt_deleted_at', 'receipt_history', 'reference_history'];
  redact text[] := array['name', 'x_username', 'email', 'contact_number', 'facebook_url', 'sender_name', 'reference_number', 'receipt_path', 'notes', 'phone',
                         'address', 'city', 'postal_code', 'shipping_sender_name', 'shipping_reference_number', 'shipping_receipt_path',
                         'balance_sender_name', 'balance_reference_number', 'balance_receipt_path', 'balance_references', 'admin_note',
                         'info_description', 'info_specs', 'info_shipping', 'info_notes', 'body'];   -- long texts say only that they changed
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
    when 'products' then (r ->> 'artist') || ': ' || (r ->> 'title')
    when 'product_categories' then r ->> 'name'
    when 'couriers' then r ->> 'name'
    when 'shop_settings' then 'checkout settings'
    when 'orders' then 'order ' || (r ->> 'order_number')
    when 'order_email_templates' then r ->> 'kind'
  end;
  v_event := case tg_table_name when 'events' then (r ->> 'id')::uuid else nullif(r ->> 'event_id', '')::uuid end;

  insert into public.change_log (actor_id, actor_email, table_name, row_id, event_id, action, label, changes)
  values (v_actor, (select email from public.profiles where id = v_actor), tg_table_name, r ->> 'id', v_event, lower(tg_op), v_label, diff);
  return null;
end $$;
