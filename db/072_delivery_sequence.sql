-- The order a rider delivers in. When a rider has several orders, the server works out the shortest way
-- round (picked-up orders first from where the rider is, then those still at the store from the store)
-- and stores each order's place in it; the rider app shows the stops in this order and the server only
-- lets the next picked-up stop be delivered. Recomputed only when an order joins the rider's list, so the
-- plan doesn't reshuffle while they ride.

alter table shop_order add column delivery_seq int;
alter table shop_order add column delivery_leg_m int;   -- road (or straight-line) metres from the stop before
