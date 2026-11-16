-- Indexes for lookups that had none, found from production's scan statistics (pg_stat_user_tables) and the queries
-- in src/. All are plain b-tree indexes on small-to-medium tables, so they build in well under a second.

-- an order by its number: /api/orders/{id}, invoices, and the next number when an app order is placed
create index if not exists fp_booking_order_order_id_ix on fp_booking_order (order_id);

-- the retailers under a distributor (retailer requirements, Customer Master)
create index if not exists fp_firm_parent_firm_uid_ix on fp_firm (parent_firm_uid) where parent_firm_uid is not null;

-- a tank's movements up to a day (balances, daily tank page): the existing index starts with scenario_id, which these
-- queries do not filter on, so the table was read in full ~36,000 times
create index if not exists tank_movement_tank_day_ix on tank_movement (tank_id, movement_date);

-- packaging materials joined by packaging (SKU packing costs): read in full ~32,000 times
create index if not exists sku_pack_material_packaging_ix on sku_pack_material (packaging_id);

-- one day's subscription orders across customers (subscription day summary, order board)
create index if not exists shop_order_subscription_day_only_ix on shop_order (subscription_day) where subscription_day is not null;

-- milk collections of a day across all centres (the largest table, 166k rows)
create index if not exists vamaa_collection_day_ix on vamaa_collection (day);
