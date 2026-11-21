-- Production · SKU packing names the batch each SKU was packed from: a SKU's line on a day carries the bulk batch it
-- came out of (asked for when it is packed; days saved before this have none). A SKU can also be counted in whole
-- cases only: Peda is counted in boxes of 20, never in loose pieces.
alter table sku_pack_day add column if not exists bulk_batch_id uuid references bulk_batch(id) on delete set null;
create index if not exists sku_pack_day_batch_ix on sku_pack_day (bulk_batch_id);
alter table sku add column if not exists cases_only boolean not null default false;

-- Rabdi comes 6 cups to a box, not 12 (it was set up at 12). Pieces are always worked out as boxes x pieces per box,
-- so the days already entered are counted at 6 too; the boxes entered stay as they are.
update sku set pcs_per_case = 6
 where (category ilike '%rabdi%' or name ilike '%rabdi%') and pcs_per_case = 12 and upper(case_unit) in ('CBX', 'BOX');

-- Peda is packed in boxes of 20 and counted in boxes only.
update sku set cases_only = true
 where (category ilike '%peda%' or name ilike '%peda%') and pcs_per_case = 20 and upper(case_unit) in ('CBX', 'BOX');

-- Ghee boxes as the plant packs them (21 Nov 2026): 20 ml 300 a box (6 packets of 50), 200 ml 90, 500 ml 36, 1 litre
-- 18, 5 litre 4 (already right). Matched by SKU code; past days are recounted at these too, as for Rabdi. The Ceka
-- packs (1 litre, 900 ml) and the 15 kg tin were not in the list and are left as they are.
update sku set pcs_per_case = 300 where code = '1055' and category ilike '%ghee%';
update sku set pcs_per_case = 90 where code in ('1029', '1039') and category ilike '%ghee%';
update sku set pcs_per_case = 36 where code in ('1030', '1040') and category ilike '%ghee%';
update sku set pcs_per_case = 18 where code in ('1031', '1041') and category ilike '%ghee%';
update sku set pcs_per_case = 4  where code = '1032' and category ilike '%ghee%';
