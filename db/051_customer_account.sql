-- Ordering in the Gaia app needs an account: every order belongs to the customer who placed it,
-- and the account remembers the last delivery address so the next checkout is pre-filled.

alter table shop_order add column customer_id int references shop_customer(id);
create index shop_order_customer_ix on shop_order (customer_id, created_at desc);

-- orders placed before accounts existed belong to whoever now owns that mobile number
update shop_order o set customer_id = c.id from shop_customer c where o.customer_id is null and o.phone = c.phone;

alter table shop_customer
  add column address    text,
  add column pincode    text,
  add column lat        double precision check (lat between -90 and 90),
  add column lng        double precision check (lng between -180 and 180),
  add column last_login timestamptz;
