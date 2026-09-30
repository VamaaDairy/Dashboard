-- =====================================================================
-- Each bulk product's standing ingredient list
--
-- Which ingredients a product is made with - Sweet Lassi takes sugar and
-- culture, Paneer takes citric acid - set once on the product master. The
-- daily production page lists exactly these for each product, each starting
-- at zero, so only the day's quantities have to be typed. Quantities are
-- never stored here; they belong to the day (bulk_batch_ingredient).
-- =====================================================================

create table bulk_product_ingredient (
  bulk_product_id  uuid not null references bulk_product(id) on delete cascade,
  ingredient_id    uuid not null references cost_object(id) on delete cascade,
  unit             text not null default 'kg',   -- the unit the day's quantity is entered in
  sort_order       int not null default 0,
  primary key (bulk_product_id, ingredient_id)
);
