-- UHT Milk stays its own category (where 065 had already put it under Milk, it goes back), and the two
-- Gaia Maxx UHT packs are not sold in the customer (D2C) shop - distributors and retailers still order them.
update fp_product set category = 'UHT Milk', updated_at = now()
 where category = 'Milk' and (sub_category ilike '%uht%' or sku_name ilike '%uht%');

insert into shop_item (sku_code, visible)
select sku_code, false from fp_product where sku_name ilike '%maxx%'
on conflict (sku_code) do update set visible = false, updated_at = now();
