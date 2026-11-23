-- Separate offers and banners for the Gaia Distributors app (distributors and retailers) and the D2C app.
--
-- shop_offer.audience / shop_banner.audience
--   d2c          the Gaia (D2C) app - everything that existed before
--   distributor  the Gaia Distributors app, distributor logins (and distributor parties a sales officer books for)
--   retailer     the same app, retailer logins (and retailer parties)
--   partners     both distributors and retailers
-- A partner offer is priced into the order lines (src/lib/distributor/offers.ts), so the invoice, route-sheet bill
-- and Tally file carry it; dist_order_offer records which offers an order used (limits, stats).

alter table shop_offer add column if not exists audience text not null default 'd2c' check (audience in ('d2c', 'distributor', 'retailer', 'partners'));
alter table shop_banner add column if not exists audience text not null default 'd2c' check (audience in ('d2c', 'distributor', 'retailer', 'partners'));
create index if not exists shop_offer_audience_ix on shop_offer (audience, active);
create index if not exists shop_banner_audience_ix on shop_banner (audience, active, priority desc);

create table if not exists dist_order_offer (
  order_uid  uuid not null references fp_booking_order (uid) on delete cascade, -- fp_booking_order.uid (as dist_order_event)
  offer_id   int not null references shop_offer (id) on delete restrict,
  title      text not null,
  discount   numeric(12, 2) not null default 0,
  free_units int not null default 0,
  primary key (order_uid, offer_id)
);
create index if not exists dist_order_offer_offer_ix on dist_order_offer (offer_id);
