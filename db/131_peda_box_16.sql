-- Peda is tracked by the box from now on: 16 pieces a box (as the plant stock app has it), for Gaia Milk Peda 200 g
-- (1034) and Gaia Kesar Peda 200 g (1049).
--   Product Master   the pack: BOX = 16 pieces, so distributors order whole boxes (retailers still by the piece) and
--                    dispatch loads count boxes; prices stay per piece
--   Tally billing    16 pieces = 1 CBX (was 1), so a bill says 2 CBX for 32 pieces, at the box rate
--   production       boxes of 16 (was 20)

update fp_product set secondary_units = '{"BOX": 0.0625, "PCS": 1}'::jsonb, updated_at = now()
 where sku_code in ('1034', '1049');

update route_order_product set pack_size = 16, tally_unit = 'CBX'
 where sku_no in (1034, 1049);

update sku set pcs_per_case = 16
 where master_sku_no::text in ('1034', '1049');
