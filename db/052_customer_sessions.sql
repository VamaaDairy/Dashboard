-- A customer stays signed in on every phone they use: each sign-in is its own session, so
-- signing in on a new phone no longer signs the old one out. Sessions last until the customer
-- signs out on that phone (or the account is removed).

create table shop_customer_session (
  token       text primary key,
  customer_id int not null references shop_customer(id) on delete cascade,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index shop_customer_session_customer_ix on shop_customer_session (customer_id);

-- phones signed in before sessions existed carry on without signing in again
insert into shop_customer_session (token, customer_id)
select token, id from shop_customer where token is not null
on conflict do nothing;
