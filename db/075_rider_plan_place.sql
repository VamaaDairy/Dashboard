-- Where and when a rider's delivery order was last worked out, so it is looked at again as they move
-- (every 300 m or 2 minutes) rather than only when an order is added.

alter table shop_rider add column plan_at timestamptz;
alter table shop_rider add column plan_lat double precision;
alter table shop_rider add column plan_lng double precision;
