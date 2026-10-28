-- One category per kind of product, as the Gaia app shows them: Milk, Dahi, Paneer, Ghee, Desserts, Beverages.
-- The categories that split them (Plain / Kadhi Dahi, Peda / Shahi Rabdi / Shrikhand, Lassi / Masala Chaas,
-- UHT Milk, Low Fat Paneer ...) go; what made them different stays in the sub-category, which is filled in
-- from the old category wherever it was empty.

-- keep the detail first
update fp_product
   set sub_category = trim(category), updated_at = now()
 where nullif(trim(sub_category), '') is null
   and lower(trim(category)) in ('plain dahi', 'kadhi dahi', 'uht milk', 'low fat paneer', 'peda', 'shahi rabdi', 'rabdi',
                                 'shrikhand', 'shrikhand 6 pc', 'khowa', 'sweets', 'lassi', 'masala chaas', 'chaas');

update fp_product set category = 'Milk', updated_at = now()      where lower(trim(category)) in ('uht milk')                    and category <> 'Milk';
update fp_product set category = 'Dahi', updated_at = now()      where lower(trim(category)) in ('plain dahi', 'kadhi dahi')    and category <> 'Dahi';
update fp_product set category = 'Paneer', updated_at = now()    where lower(trim(category)) in ('low fat paneer')              and category <> 'Paneer';
update fp_product set category = 'Desserts', updated_at = now()
 where lower(trim(category)) in ('peda', 'shahi rabdi', 'rabdi', 'shrikhand', 'shrikhand 6 pc', 'khowa', 'sweets') and category <> 'Desserts';
update fp_product set category = 'Beverages', updated_at = now() where lower(trim(category)) in ('lassi', 'masala chaas', 'chaas') and category <> 'Beverages';

insert into master_audit (actor, slug, record_id, action, summary, before, after)
values ('Migration 065', 'fpproducts', 'categories', 'update',
        'Merged product categories: Milk, Dahi, Paneer, Ghee, Desserts, Beverages (old category kept as sub-category)', null, null);
