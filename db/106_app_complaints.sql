-- Complaints raised from the apps land in CN Management (cn_complaint) with the order they are about.
--   source            dashboard = typed in by the office; d2c = Gaia app customer; distributor = Gaia Distributors app
--                     (a distributor or retailer about its own order); salesforce = a sales officer for one of their parties
--   shop_order_id     the D2C order (Gaia app), with shop_customer_id the customer who raised it
--   booking_order_uid the distributor / retailer order (fp_booking_order), with firm_uid the party it is for
--   raised_by_login   dist_login id of the distributor, retailer or sales officer who raised it (push notices go there)
--   raised_by_staff   the sales officer (fp_staff) who raised it from Gaia Salesforce
--   items             the order lines complained about: [{ sku, name, qty, unitPrice, value }]
-- D2C complaints end with a refund instead of a credit note: once approved, the office pays it (Easebuzz dashboard, UPI,
-- bank or cash) and records it here (refund_*), and the customer sees it in the app.
-- Photos sent from the apps are kept in cn_photo, so app complaints need no evidence link.

alter table cn_complaint add column if not exists source text not null default 'dashboard';
alter table cn_complaint drop constraint if exists cn_complaint_source_check;
alter table cn_complaint add constraint cn_complaint_source_check check (source in ('dashboard', 'd2c', 'distributor', 'salesforce'));
alter table cn_complaint add column if not exists shop_order_id integer references shop_order(id);
alter table cn_complaint add column if not exists shop_customer_id integer references shop_customer(id);
alter table cn_complaint add column if not exists booking_order_uid uuid;
alter table cn_complaint add column if not exists firm_uid uuid;
alter table cn_complaint add column if not exists raised_by_login integer;
alter table cn_complaint add column if not exists raised_by_staff uuid;
alter table cn_complaint add column if not exists items jsonb;
alter table cn_complaint add column if not exists refund_value numeric(14, 2);
alter table cn_complaint add column if not exists refund_mode text;
alter table cn_complaint add column if not exists refund_ref text;
alter table cn_complaint add column if not exists refund_on date;
alter table cn_complaint add column if not exists refund_by text;
alter table cn_complaint alter column evidence_url drop not null;

alter table cn_complaint drop constraint if exists cn_complaint_outcome_check;
alter table cn_complaint add constraint cn_complaint_outcome_check check (outcome in ('cn_issued', 'refunded', 'no_cn', 'rejected'));

create index if not exists cn_complaint_shop_customer_ix on cn_complaint (shop_customer_id, created_at desc) where shop_customer_id is not null;
create index if not exists cn_complaint_shop_order_ix on cn_complaint (shop_order_id) where shop_order_id is not null;
create index if not exists cn_complaint_booking_order_ix on cn_complaint (booking_order_uid) where booking_order_uid is not null;
create index if not exists cn_complaint_login_ix on cn_complaint (raised_by_login, created_at desc) where raised_by_login is not null;
create index if not exists cn_complaint_staff_ix on cn_complaint (raised_by_staff, created_at desc) where raised_by_staff is not null;
create index if not exists cn_complaint_firm_ix on cn_complaint (firm_uid) where firm_uid is not null;

create table if not exists cn_photo (
  id           serial primary key,
  complaint_id uuid not null references cn_complaint(id) on delete cascade,
  mime         text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  data         bytea not null,
  created_at   timestamptz not null default now()
);
create index if not exists cn_photo_complaint_ix on cn_photo (complaint_id);
