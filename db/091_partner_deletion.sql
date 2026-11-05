-- Delivery partners can ask to delete their account from the Gaia Delivery Partner app (Play requires an in-app way
-- for any app that lets people create an account). Their requests sit with the customers' ones, marked by kind.
alter table shop_deletion_request add column if not exists kind text not null default 'customer'
  check (kind in ('customer', 'delivery_partner'));
alter table shop_deletion_request add column if not exists rider_id int references shop_rider (id) on delete set null;
-- one open request per number and kind (a customer and a partner may share a number)
drop index if exists shop_deletion_request_open_ix;
create unique index shop_deletion_request_open_ix on shop_deletion_request (kind, phone) where status = 'pending';
