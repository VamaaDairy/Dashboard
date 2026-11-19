-- (after 110, once product_label is current) every list's name becomes the master's; the old ones go to the backup.
create or replace function pg_temp.master_name(n bigint) returns text language sql stable as $$
  select trim(concat_ws(' ', l.name, l.qty, l.unit)) from product_label l where l.sku_no = n order by l.sku_code ~ '^[0-9]+$' desc limit 1
$$;

insert into product_name_backup (source, key, old_name, new_name)
select 'sku', s.id::text, s.name, pg_temp.master_name(s.master_sku_no) from sku s
 where s.master_sku_no is not null and pg_temp.master_name(s.master_sku_no) is not null and s.name <> pg_temp.master_name(s.master_sku_no);
update sku s set name = pg_temp.master_name(s.master_sku_no)
 where s.master_sku_no is not null and pg_temp.master_name(s.master_sku_no) is not null and s.name <> pg_temp.master_name(s.master_sku_no);

insert into product_name_backup (source, key, old_name, new_name)
select 'route_order_product', r.id::text, r.name, pg_temp.master_name(r.sku_no) from route_order_product r
 where pg_temp.master_name(r.sku_no) is not null and r.name <> pg_temp.master_name(r.sku_no);
update route_order_product r set name = pg_temp.master_name(r.sku_no)
 where pg_temp.master_name(r.sku_no) is not null and r.name <> pg_temp.master_name(r.sku_no);

-- ---- credit-note complaints: which master product each is about
alter table cn_complaint add column if not exists sku_no bigint;
update cn_complaint c set sku_no = m.n
  from (values
    ('gaia doodh toned 500ml- pkt', 1003), ('gaia cow milk 500 ml (crt)', 999), ('gaia maxx uht 110ml', 1042),
    ('gaia maxx uht 400ml', 1045), ('gaia premium milk uht tetra pack 1 ltr', 1050)
  ) as m(name, n)
 where c.sku_no is null and lower(trim(c.product_name)) = m.name;
-- a complaint from the apps lists the order's lines: one line names its product
update cn_complaint c set sku_no = (c.items -> 0 ->> 'sku')::bigint
 where c.sku_no is null and jsonb_typeof(c.items) = 'array' and jsonb_array_length(c.items) = 1 and (c.items -> 0 ->> 'sku') ~ '^[0-9]+$';
insert into product_name_backup (source, key, old_name, new_name)
select 'cn_complaint', c.id::text, c.product_name, pg_temp.master_name(c.sku_no) from cn_complaint c
 where c.sku_no is not null and pg_temp.master_name(c.sku_no) is not null and c.product_name <> pg_temp.master_name(c.sku_no);
update cn_complaint c set product_name = pg_temp.master_name(c.sku_no)
 where c.sku_no is not null and pg_temp.master_name(c.sku_no) is not null and c.product_name <> pg_temp.master_name(c.sku_no);

-- ---- two leftovers from the old portal: switched off, on no app list, never ordered - removed with their photo and
-- rates when nothing else points at them (if something does, they simply stay)
do $$
declare p record;
begin
  for p in select uid, sku_code, sku_name from fp_product
            where sku_code in ('GAIAKADHIDAHIBUCKET5KG', 'GAIAMAXXUHTMILK120ML') and coalesce(active, 0) = 0
              and not exists (select 1 from fp_booking_order_item i where i.product_uid = fp_product.uid)
              and not exists (select 1 from app_product a where a.product_uid = fp_product.uid)
  loop
    begin
      insert into product_name_backup (source, key, old_name, new_name) values ('fp_product removed', p.sku_code, p.sku_name, null);
      delete from fp_product_image where product_uid = p.uid;
      delete from fp_channel_rate where product_uid = p.uid;
      delete from fp_slab_rate where product_uid = p.uid;
      delete from fp_product where uid = p.uid;
    exception when foreign_key_violation then
      raise notice 'kept % (still referenced)', p.sku_code;
    end;
  end loop;
end $$;
delete from product_label_state;
