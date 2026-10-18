-- =====================================================================
-- A SKU's packing cost per piece
--
-- The real packing cost of one piece of a SKU, as costed by the plant
-- ("Price as per items.xlsx" - Rate per PC). Where a SKU has it, a day's
-- packing material is one line: pieces packed x this rate, instead of being
-- worked out from the standing packing list. SKUs without it keep using
-- their packing list.
-- =====================================================================

alter table sku add column if not exists pack_rate_per_pc numeric(20, 6) check (pack_rate_per_pc >= 0);
