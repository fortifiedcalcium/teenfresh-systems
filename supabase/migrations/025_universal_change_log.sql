-- 025: One change log for everything, not only events. Run AFTER 024_underpaid_balance.sql.
-- The log already recorded who changed what for events, kits, registrations, payments, email templates and admin roles.
-- It now also records the shop: products, categories, couriers, checkout settings, orders and the order email wording.
-- Privacy is the same as before: names, addresses, phone numbers, emails, reference numbers, receipt files and long texts are
-- written as "[changed]" without their values, and any other value is cut to 200 characters.

create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  n jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  ignore text[] := array['id', 'created_at', 'updated_at', 'event_id', 'user_id', 'description', 'html_body', 'text_body', 'subject', 'terms_html', 'receipt_deleted_at', 'receipt_history', 'reference_history'];
  redact text[] := array['name', 'x_username', 'email', 'contact_number', 'facebook_url', 'sender_name', 'reference_number', 'receipt_path', 'notes', 'phone',
                         'address', 'city', 'postal_code', 'shipping_sender_name', 'shipping_reference_number', 'shipping_receipt_path',
                         'balance_sender_name', 'balance_reference_number', 'balance_receipt_path', 'admin_note',
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

drop trigger if exists products_log              on public.products;
drop trigger if exists product_categories_log    on public.product_categories;
drop trigger if exists couriers_log              on public.couriers;
drop trigger if exists shop_settings_log         on public.shop_settings;
drop trigger if exists orders_log                on public.orders;
drop trigger if exists order_email_templates_log on public.order_email_templates;
create trigger products_log              after insert or update or delete on public.products              for each row execute function public.log_change();
create trigger product_categories_log    after insert or update or delete on public.product_categories    for each row execute function public.log_change();
create trigger couriers_log              after insert or update or delete on public.couriers              for each row execute function public.log_change();
create trigger shop_settings_log         after insert or update or delete on public.shop_settings         for each row execute function public.log_change();
create trigger orders_log                after insert or update or delete on public.orders                for each row execute function public.log_change();
create trigger order_email_templates_log after insert or update or delete on public.order_email_templates for each row execute function public.log_change();
