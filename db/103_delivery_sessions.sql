-- A session for every delivery: one row each time an order is with a rider, from being given to the rider to its
-- handover (or until it is taken back / cancelled). An order given to a second rider gets a second session, so every
-- attempt stays on record.
--
-- status       assigned -> picked_up -> delivered, or ended early: unassigned | reassigned | cancelled
-- pickup_*     where the rider's phone was when they picked it up
-- drop_*       where it was at the handover; drop_gap_m is how far that was from the customer's pin
-- metres       distance ridden between pickup and handover (from the phone's track, GPS jumps left out)
-- otp_checked  the customer's delivery code was checked (one-time orders; subscription orders need none)
-- ended_at     set when the session is over, for whatever reason (end_reason); at most one open session per order

create table if not exists shop_delivery_session (
  id            serial primary key,
  order_id      int not null references shop_order (id) on delete cascade,
  rider_id      int not null references shop_rider (id) on delete cascade,
  status        text not null default 'assigned'
                check (status in ('assigned', 'picked_up', 'delivered', 'unassigned', 'reassigned', 'cancelled')),
  assigned_at   timestamptz not null default now(),
  picked_up_at  timestamptz,
  pickup_lat    double precision,
  pickup_lng    double precision,
  delivered_at  timestamptz,
  drop_lat      double precision,
  drop_lng      double precision,
  drop_gap_m    int,
  metres        int,
  otp_checked   boolean,
  ended_at      timestamptz,
  end_reason    text,
  updated_at    timestamptz not null default now()
);

create unique index if not exists shop_delivery_session_open_ix on shop_delivery_session (order_id) where ended_at is null;
create index if not exists shop_delivery_session_order_ix on shop_delivery_session (order_id, assigned_at);
create index if not exists shop_delivery_session_rider_ix on shop_delivery_session (rider_id, assigned_at desc);
create index if not exists shop_delivery_session_day_ix on shop_delivery_session (assigned_at desc);

-- every order already with a rider gets its session from what the order recorded
insert into shop_delivery_session (order_id, rider_id, status, assigned_at, picked_up_at, delivered_at, otp_checked, ended_at, end_reason)
select o.id, o.rider_id,
       case when o.status = 'delivered' then 'delivered' when o.status = 'cancelled' then 'cancelled'
            when o.picked_up_at is not null then 'picked_up' else 'assigned' end,
       coalesce(o.assigned_at, o.created_at), o.picked_up_at, o.delivered_at,
       case when o.status = 'delivered' then o.subscription_day is null end,
       case when o.status in ('delivered', 'cancelled') then coalesce(o.delivered_at, o.updated_at) end,
       case when o.status = 'delivered' then 'delivered' when o.status = 'cancelled' then 'cancelled' end
  from shop_order o
 where o.rider_id is not null
   and not exists (select 1 from shop_delivery_session s where s.order_id = o.id);
