-- Peda is bought, priced and billed by the box only (no pieces): Gaia Milk Peda 200 g (1034), Gaia Kesar Peda 200 g
-- (1049). One unit = one box, at the box price the price lists already hold (₹104 / ₹120 dealer). Replaces 131's
-- split into 16 pieces for ordering and billing.
--   Product Master   unit BOX, no pack split: the app orders whole boxes at the box price
--   Tally billing    1 box ordered = 1 CBX
-- Production keeps counting boxes (it packs whole boxes only).

update fp_product set primary_unit = '"BOX"'::jsonb, secondary_units = null, updated_at = now()
 where sku_code in ('1034', '1049');

update route_order_product set pack_size = 1, tally_unit = 'CBX'
 where sku_no in (1034, 1049);
