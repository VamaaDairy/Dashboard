-- Gaia Salesforce app (sales officers). Their logins stay in dist_login (kind = 'salesman'); this adds what the
-- field team does with the app: starting/ending the working day, store visits with the phone's location,
-- the location trail, and a link from the orders they book on behalf of distributors back to the visit.
-- Routes are not new: a sales officer's fixed route is the beats assigned to them (fp_staff_beat / fp_beat.staff_uid),
-- and a beat's stores are the customers mapped to it (fp_firm.beat_uid).

create table sf_day (
  id          serial primary key,
  staff_uid   uuid not null references fp_staff(uid) on delete cascade,
  work_date   date not null,
  started_at  timestamptz not null default now(),
  start_lat   double precision,
  start_lng   double precision,
  ended_at    timestamptz,
  end_lat     double precision,
  end_lng     double precision,
  unique (staff_uid, work_date)
);

create table sf_visit (
  id           serial primary key,
  staff_uid    uuid not null references fp_staff(uid) on delete cascade,
  firm_uid     uuid not null references fp_firm(uid) on delete cascade,
  beat_uid     uuid references fp_beat(uid) on delete set null,
  work_date    date not null,
  -- true when the store is on the officer's route for that day; false for an extra, off-route visit
  on_route     boolean not null default true,
  check_in_at  timestamptz not null default now(),
  in_lat       double precision not null,
  in_lng       double precision not null,
  in_accuracy  real,
  -- how far the phone was from the store's saved location (null when the store has none saved)
  distance_m   integer,
  -- checked in within the allowed radius of the store's saved location: a physically verified visit
  verified     boolean not null default false,
  check_out_at timestamptz,
  out_lat      double precision,
  out_lng      double precision,
  outcome      text check (outcome in ('order', 'no_order', 'shop_closed', 'follow_up')),
  notes        text,
  created_at   timestamptz not null default now()
);
create index sf_visit_staff_ix on sf_visit (staff_uid, work_date desc);
create index sf_visit_firm_ix on sf_visit (firm_uid, check_in_at desc);
-- one open visit per officer at a time
create unique index sf_visit_open_uq on sf_visit (staff_uid) where check_out_at is null;

create table sf_location (
  id          bigserial primary key,
  staff_uid   uuid not null references fp_staff(uid) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  accuracy    real,
  speed       real,
  battery     smallint,
  recorded_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index sf_location_staff_ix on sf_location (staff_uid, recorded_at desc);

alter table fp_booking_order add column if not exists sf_visit_id integer references sf_visit(id) on delete set null;
create index if not exists fp_booking_order_sf_visit_ix on fp_booking_order (sf_visit_id) where sf_visit_id is not null;
