-- One price per product: the MRP. The D2C app used to have its own selling price (shop_item.price, empty = MRP);
-- where it was set and differed, the app price becomes the MRP, and the separate price is cleared.

insert into master_audit (actor, slug, record_id, action, summary, before, after)
select 'Migration 096', 'fpproducts', p.uid::text, 'update', 'MRP set to the D2C app price (' || p.sku_code || ')',
       json_build_object('mrp', p.mrp), json_build_object('mrp', si.price)
  from fp_product p join shop_item si on si.sku_code = p.sku_code
 where si.price > 0 and si.price is distinct from p.mrp;

update fp_product p set mrp = si.price, updated_at = now()
  from shop_item si
 where si.sku_code = p.sku_code and si.price > 0 and si.price is distinct from p.mrp;

update shop_item set price = null, updated_at = now() where price is not null;

comment on column shop_item.price is 'Not used since migration 096: every app sells at the product MRP.';
