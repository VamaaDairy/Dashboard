-- Every position a delivery partner's phone reports while on duty (about one every 6 s), so the Dashboard
-- can draw the route actually ridden: per order (Shop orders -> Route) and per rider per day (Riders ->
-- name). Kept 90 days (older rows are pruned as new ones arrive) and removed with the rider.

create table shop_rider_ping (
  id       bigserial primary key,
  rider_id int not null references shop_rider (id) on delete cascade,
  at       timestamptz not null default now(),
  lat      double precision not null,
  lng      double precision not null
);

create index shop_rider_ping_rider_at on shop_rider_ping (rider_id, at);
