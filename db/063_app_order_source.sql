-- Primary / secondary orders placed from the Gaia app (distributor, retailer or sales officer sign-in)
-- sit in fp_booking_order next to the portal's own orders. These columns say which ones came from the
-- app, who placed them and what they wrote, so the dashboard's App orders section can show them apart.
alter table fp_booking_order
  add column if not exists app_kind text check (app_kind in ('distributor', 'retailer', 'salesman')),
  add column if not exists app_login_id integer references dist_login(id) on delete set null,
  add column if not exists app_notes text;

create index if not exists fp_booking_order_app_ix on fp_booking_order (booking_time desc) where app_kind is not null;

-- orders placed before this: the app wrote "Gaia app (<kind>: <name>)" as the reference when there was no note
update fp_booking_order
   set app_kind = substring(reference from '^Gaia app \((distributor|retailer|salesman):')
 where app_kind is null and reference ~ '^Gaia app \((distributor|retailer|salesman):';
