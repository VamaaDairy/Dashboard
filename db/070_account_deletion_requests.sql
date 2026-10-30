-- Gaia app customers ask for their account to be deleted from a public web page (/delete-account), as
-- the Play Store requires. Nothing is deleted automatically: the request is recorded once the number and
-- PIN prove the account is theirs, and the team handles it from Shop orders -> Deletion requests.

create table shop_deletion_request (
  id          serial primary key,
  customer_id int references shop_customer (id) on delete set null,
  name        text not null,
  phone       text not null,
  reason      text,
  status      text not null default 'pending' check (status in ('pending', 'done', 'rejected')),
  created_at  timestamptz not null default now(),
  handled_at  timestamptz,
  handled_by  text
);
-- one open request per number; asking again just finds the one already there
create unique index shop_deletion_request_open_ix on shop_deletion_request (phone) where status = 'pending';
