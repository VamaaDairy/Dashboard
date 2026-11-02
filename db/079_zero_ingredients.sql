-- A batch can record an ingredient at 0 (not used that day): quantities may now be zero, never negative.
alter table bulk_batch_ingredient drop constraint if exists bulk_batch_ingredient_qty_check;
alter table bulk_batch_ingredient add constraint bulk_batch_ingredient_qty_check check (qty >= 0);
