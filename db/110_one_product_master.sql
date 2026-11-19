-- One product master: the Product Master (fp_product, named as product_label: the Gaia D2C app's name). The other
-- lists keep only what they need for their own work and take the name (and photo) from it:
--   route_order_product  Route sheet billing settings (Tally item, pack size, GST, weight)  - by sku_no, as before
--   sku                  production / packing / costing / credit notes                        - by master_sku_no (new)
--   cn_complaint         credit-note complaints                                               - by sku_no (new)
-- Every name changed here is kept in product_name_backup first.

create table if not exists product_name_backup (
  source     text not null,
  key        text not null,
  old_name   text not null,
  new_name   text,
  saved_at   timestamptz not null default now()
);

create or replace function pg_temp.master_name(n bigint) returns text language sql stable as $$
  select trim(concat_ws(' ', l.name, l.qty, l.unit)) from product_label l where l.sku_no = n order by l.sku_code ~ '^[0-9]+$' desc limit 1
$$;

-- ---- production SKUs: their codes are the stock app's, not the master's (1010 is Mishti Doi there, 1044 in the
-- master), so each is linked by what it is. Kadhi Dahi Bucket 1.5 kg and Khowa White are not in the master yet.
alter table sku add column if not exists master_sku_no bigint;
update sku s set master_sku_no = m.master
  from (values
    ('999', 999), ('1003', 1003), ('1005', 1005), ('1006', 1006), ('1007', 1007), ('1008', 1008), ('1009', 1009),
    ('1010', 1044), ('1011', 1011), ('1012', 1012), ('1013', 1013), ('1014', 1014), ('1015', 1015), ('1016', 1016),
    ('1019', 1019), ('1020', 1020), ('1021', 1021), ('1022', 1022), ('1023', 1023), ('1024', 1024),
    ('1026', 1017), ('1027', 1018), ('1028', 1026), ('1029', 1029), ('1030', 1030), ('1031', 1031), ('1032', 1032),
    ('1033', 1033), ('1034', 1034), ('1035', 1049), ('1037', 1037), ('1038', 1038), ('1039', 1039), ('1040', 1040),
    ('1041', 1041), ('1042', 1042), ('1043', 1043), ('1044', 1058), ('1045', 1045), ('1046', 1046), ('1047', 1047),
    ('1048', 1048), ('1049', 1025), ('1050', 1050), ('1051', 1051), ('1052', 1052), ('1053', 1053), ('1054', 1054),
    ('1055', 1055), ('1056', 1056), ('1059', 1035)
  ) as m(code, master)
 where s.code = m.code and s.master_sku_no is null;

-- ---- the master's own fixes: the 6-pack Rabdi box said "80g" (so it looked like the single box 1036)
update fp_product set sku_size = '6 x 80 g', updated_at = now() where sku_code = '1057' and sku_size = '80g';
update product_label set qty = '6 x 80', unit = 'g' where sku_code = '1057' and qty = '80';
-- the product names are worked out again from the master on the next read
delete from product_label_state;
