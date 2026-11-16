-- Phase 2 of order -> dispatch -> delivery for distributor (trade) orders, the groundwork for distributor books,
-- and new distributors proposed by sales officers.
--
-- dist_trip        one vehicle run for a day, usually one route: the office plans it on the Dispatch page and gives
--                  it to a transporter (shop_rider kind 'transporter'); the transporter runs it in the Gaia Delivery app.
--   status         planned -> on_the_way (started: the orders are dispatched) -> completed, or cancelled
-- dist_trip_stop   one confirmed order on the trip, in delivery order (seq)
--   status         pending -> delivered, or not_delivered (with a note); lat/lng where the phone was, gap_m how far
--                  that was from the customer's map pin, received_by who took it
-- The truck's track is the transporter's shop_rider_ping rows between the trip's start and end.

create table if not exists dist_trip (
  id             serial primary key,
  trip_date      date not null,
  route_id       int references route_order_route (id) on delete set null,
  route_name     text not null,
  transporter_id int references shop_rider (id) on delete set null,
  vehicle_no     text,
  status         text not null default 'planned' check (status in ('planned', 'on_the_way', 'completed', 'cancelled')),
  notes          text,
  created_by     text,
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  start_lat      double precision,
  start_lng      double precision,
  ended_at       timestamptz,
  end_lat        double precision,
  end_lng        double precision,
  updated_at     timestamptz not null default now()
);
create index if not exists dist_trip_day_ix on dist_trip (trip_date, status);
create index if not exists dist_trip_transporter_ix on dist_trip (transporter_id, trip_date desc);

create table if not exists dist_trip_stop (
  id           serial primary key,
  trip_id      int not null references dist_trip (id) on delete cascade,
  order_uid    uuid not null references fp_booking_order (uid) on delete cascade,
  seq          int not null,
  status       text not null default 'pending' check (status in ('pending', 'delivered', 'not_delivered')),
  delivered_at timestamptz,
  lat          double precision,
  lng          double precision,
  gap_m        int,
  received_by  text,
  note         text,
  updated_at   timestamptz not null default now()
);
-- an order is on one trip at a time (a cancelled trip's stops are removed)
create unique index if not exists dist_trip_stop_order_ux on dist_trip_stop (order_uid);
create index if not exists dist_trip_stop_trip_ix on dist_trip_stop (trip_id, seq);

-- the order's history gains the road: dispatched (the trip started), delivered / not delivered (at the stop)
alter table dist_order_event drop constraint if exists dist_order_event_action_check;
alter table dist_order_event add constraint dist_order_event_action_check
  check (action in ('placed', 'edited', 'confirmed', 'cancelled', 'reopened', 'dispatched', 'delivered', 'not_delivered'));
alter table dist_order_event drop constraint if exists dist_order_event_actor_kind_check;
alter table dist_order_event add constraint dist_order_event_actor_kind_check
  check (actor_kind in ('office', 'app', 'transporter'));

-- Books (groundwork; no screens yet): every money movement with a distributor, one row each.
--   kind     opening | invoice | payment | credit_note | debit_note | adjustment
--   debit    what the distributor owes us more (an invoice); credit what it paid or was given back
--   ref      the document number (invoice no., receipt no. ...); one row per kind + ref per firm
create table if not exists dist_ledger (
  id          serial primary key,
  firm_uid    uuid not null,
  entry_date  date not null,
  kind        text not null check (kind in ('opening', 'invoice', 'payment', 'credit_note', 'debit_note', 'adjustment')),
  ref         text,
  order_uid   uuid references fp_booking_order (uid) on delete set null,
  debit       numeric(14, 2) not null default 0 check (debit >= 0),
  credit      numeric(14, 2) not null default 0 check (credit >= 0),
  notes       text,
  created_by  text,
  created_at  timestamptz not null default now()
);
create unique index if not exists dist_ledger_ref_ux on dist_ledger (firm_uid, kind, ref) where ref is not null;
create index if not exists dist_ledger_firm_ix on dist_ledger (firm_uid, entry_date, id);

-- each distributor's balance (positive: it owes us)
create or replace view dist_ledger_balance as
select firm_uid, sum(debit)::numeric(14, 2) as debit, sum(credit)::numeric(14, 2) as credit,
       (sum(debit) - sum(credit))::numeric(14, 2) as balance, max(entry_date) as last_entry
  from dist_ledger group by firm_uid;

-- every invoice of a confirmed (or later) order goes on its buyer's books
insert into dist_ledger (firm_uid, entry_date, kind, ref, order_uid, debit, notes, created_by)
select b.from_firm_uid, (i.issued_at at time zone 'Asia/Kolkata')::date, 'invoice', i.invoice_no, i.booking_order_uid,
       coalesce((i.data -> 'totals' ->> 'total')::numeric, 0), 'Order ' || b.order_id, 'Migration 104'
  from dist_invoice i join fp_booking_order b on b.uid = i.booking_order_uid
 where b.from_firm_uid is not null and lower(b.status) !~ '^(pending|cancel|reject)'
on conflict do nothing;

-- New distributors (or other parties) a sales officer proposes from the Sales app. Nothing is created in Customer
-- Masters until the office approves it; approving creates the customer, mapped to the officer.
--   status   pending -> approved (firm_uid) | rejected (reason)
create table if not exists dist_firm_request (
  id              serial primary key,
  staff_uid       uuid not null,
  login_id        int,
  name            text not null,
  contact_person  text,
  phone           text not null,
  email           text,
  address         text not null,
  city            text,
  pincode         text,
  state           text,
  lat             double precision,
  lng             double precision,
  gstin           text,
  kind            text not null default 'Distributor',
  notes           text,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  firm_uid        uuid,
  reason          text,
  decided_by      text,
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists dist_firm_request_status_ix on dist_firm_request (status, created_at desc);
create index if not exists dist_firm_request_staff_ix on dist_firm_request (staff_uid, created_at desc);
