-- =====================================================================
-- Product photos kept in our own database
--
-- fp_product_image only held links to the old system's storage. `data` / `mime`
-- keep the picture itself (so it survives that storage going away and can be
-- replaced from the Product Master); `source_url` remembers where an imported
-- picture came from. A row with `data` is served from /api/shop/product-image/<uid>.
-- =====================================================================

alter table fp_product_image
  add column if not exists data       bytea,
  add column if not exists mime       text,
  add column if not exists source_url text;
