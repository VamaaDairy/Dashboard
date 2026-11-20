-- The Distributors, Delivery and SalesForce apps stay signed in on every phone they are used on, as the Gaia app
-- already does (052_customer_sessions): each sign-in is its own session, so signing in on a new phone no longer
-- signs the old one out. A session lasts until that phone signs out; a new PIN, or the office switching the
-- sign-in off, ends all of them.

create table dist_session (
  token      text primary key,
  login_id   int not null references dist_login(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create index dist_session_login_ix on dist_session (login_id);

create table shop_rider_session (
  token      text primary key,
  rider_id   int not null references shop_rider(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create index shop_rider_session_rider_ix on shop_rider_session (rider_id);

create table emp_session (
  token      text primary key,
  login_id   int not null references emp_login(id) on delete cascade,
  device     text,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create index emp_session_login_ix on emp_session (login_id);

-- phones signed in before sessions existed carry on without signing in again
insert into dist_session (token, login_id) select token, id from dist_login where token is not null on conflict do nothing;
insert into shop_rider_session (token, rider_id) select token, id from shop_rider where token is not null on conflict do nothing;
insert into emp_session (token, login_id, device) select token, id, device from emp_login where token is not null on conflict do nothing;
