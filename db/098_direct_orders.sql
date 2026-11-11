-- Phase 1 of order -> dispatch -> delivery: direct orders from the Gaia Distributors app (distributor and
-- retailer sign-ins, not sales officers) are reviewed, edited and confirmed by the office on the App orders pages.
--
-- delivery_date  the day the order is for. App orders default to the day after they are placed. The buyer may
--                edit or cancel a pending order until the cutoff: 20:00 IST on the day before delivery_date.
-- dist_order_event  every step of an order's life, with who did it and, for edits, what changed:
--   placed | edited | confirmed | cancelled | reopened
--   actor_kind: 'office' (Dashboard user) or 'app' (the buyer, from the app)
--   changes:    for 'edited', [{ sku, name, from, to }] (from 0 = added, to 0 = removed)

alter table fp_booking_order add column if not exists delivery_date date;

update fp_booking_order
   set delivery_date = (booking_time at time zone 'Asia/Kolkata')::date + 1
 where delivery_date is null and app_kind is not null;

create index if not exists fp_booking_order_delivery_ix on fp_booking_order (delivery_date) where app_kind is not null;

create table if not exists dist_order_event (
  id         serial primary key,
  order_uid  uuid not null references fp_booking_order (uid) on delete cascade,
  at         timestamptz not null default now(),
  action     text not null check (action in ('placed', 'edited', 'confirmed', 'cancelled', 'reopened')),
  actor      text not null,
  actor_kind text not null check (actor_kind in ('office', 'app')),
  note       text,
  changes    jsonb
);

create index if not exists dist_order_event_order_ix on dist_order_event (order_uid, at);

-- every app order so far starts its history with being placed
insert into dist_order_event (order_uid, at, action, actor, actor_kind)
select b.uid, coalesce(b.booking_time, now()), 'placed', coalesce(dl.phone, 'app'), 'app'
  from fp_booking_order b
  left join dist_login dl on dl.id = b.app_login_id
 where b.app_kind is not null
   and not exists (select 1 from dist_order_event e where e.order_uid = b.uid);
