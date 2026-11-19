-- Photos sent from the apps, kept as files on the server (PHOTO_DIR, by default "gaia-photos" next to the Dashboard),
-- one folder per kind and owner:
--   outlets/<customer code>_<name>/                         a distributor's or retailer's own outlet (Gaia Distributors app)
--   customers/<customer id>_<name>/                         a home-delivery customer's delivery spot (Gaia app)
--   deliveries/home/<YYYY-MM>/<YYYY-MM-DD>/order-<no>/       the drop of a home delivery (Gaia Delivery app, delivery boy)
--   deliveries/trade/<YYYY-MM>/<YYYY-MM-DD>/order-<no>/      the drop of a distributor / retailer order (transporter)
-- Every photo is optional. This table is the index: what each file is, whose it is, and who sent it.
create table if not exists app_photo (
  id          serial primary key,
  kind        text not null check (kind in ('outlet', 'customer_location', 'delivery_home', 'delivery_trade')),
  -- whose: fp_firm.uid (outlet), shop_customer.id (customer_location), shop_order.id (delivery_home), fp_booking_order.uid (delivery_trade)
  ref         text not null,
  rel_path    text not null unique,
  bytes       int not null,
  mime        text not null,
  uploaded_by text,
  created_at  timestamptz not null default now()
);
create index if not exists app_photo_ref_ix on app_photo (kind, ref, created_at desc);
