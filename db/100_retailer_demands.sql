-- Retailer requirements: a retailer on the Gaia Distributors app no longer orders from Gaia directly. It sends its
-- requirement to its distributor (fp_firm.parent_firm_uid), who sees the requirements of all its retailers, adds them
-- to its own cart and places one primary order - billed to the distributor, delivered to the distributor.
--
-- dist_demand       one requirement a retailer sent
--   status          open      waiting for the distributor
--                   ordered   the distributor put it in its order (order_uid)
--                   declined  the distributor turned it down
--                   cancelled the retailer withdrew it
-- dist_demand_line  what it asks for: qty in pieces, units the split as entered (e.g. {"CRT": 2, "PCS": 5}),
--                   rate the retailer's own price when it was sent (only to show an estimate)

create table if not exists dist_demand (
  id                   serial primary key,
  retailer_firm_uid    uuid not null,
  distributor_firm_uid uuid not null,
  login_id             integer,
  created_at           timestamptz not null default now(),
  status               text not null default 'open' check (status in ('open', 'ordered', 'declined', 'cancelled')),
  notes                text,
  order_uid            uuid references fp_booking_order (uid) on delete set null,
  closed_at            timestamptz,
  closed_by            text
);

create index if not exists dist_demand_distributor_ix on dist_demand (distributor_firm_uid, status, created_at desc);
create index if not exists dist_demand_retailer_ix on dist_demand (retailer_firm_uid, created_at desc);

create table if not exists dist_demand_line (
  demand_id  integer not null references dist_demand (id) on delete cascade,
  line_no    integer not null,
  sku        text not null,
  name       text not null,
  qty        integer not null check (qty > 0),
  units      jsonb,
  rate       numeric(12, 2),
  primary key (demand_id, line_no)
);
