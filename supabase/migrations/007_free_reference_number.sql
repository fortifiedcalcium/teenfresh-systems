-- 007: the reference number can be entered exactly as the banking app shows it. Run AFTER 006_one_kit_per_form.sql.
-- Before: 8 to 20 digits only, and hyphens were removed. Now: any text up to 64 characters, no spaces
-- (spaces are removed, hyphens and letters are kept). The same reference still cannot be used twice for one
-- event (that duplicate check protects against one payment being claimed by two people).
-- Existing payments are not changed: every reference saved so far is digits only.

create or replace function public.normalize_reference(t text) returns text language sql immutable as $$
  select regexp_replace(coalesce(t, ''), '\s', '', 'g');
$$;

-- Replace the old "8 to 20 digits" test inside the two functions that save a payment
-- (submit_registration and resubmit_payment) without retyping them.
do $$
declare
  f record;
  def text;
  old_test constant text := 'if v_ref !~ ''^[0-9]{8,20}$'' then raise exception ''INVALID_REFERENCE''; end if;';
  new_test constant text := 'if v_ref = '''' or char_length(v_ref) > 64 or v_ref ~ ''[[:cntrl:]]'' then raise exception ''INVALID_REFERENCE''; end if;';
begin
  for f in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('submit_registration', 'resubmit_payment')
  loop
    def := pg_get_functiondef(f.oid);
    if position(old_test in def) = 0 then
      raise exception '007: expected the digits-only reference test in %, nothing changed', f.proname;
    end if;
    execute replace(def, old_test, new_test);
  end loop;
end $$;
