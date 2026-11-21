-- UHT milk is made outside and comes in packed; its batches are entered separately. A SKU marked made outside is not
-- asked for a batch on Production -> SKU packing and is left out of "packed against yield". The SKU setup has the switch.
alter table sku add column if not exists made_outside boolean not null default false;
update sku set made_outside = true where category ilike '%uht%';
