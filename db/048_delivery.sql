-- Delivery: riders, where each order is going, who is taking it, and the proof of handover.
-- Riders sign in to the Gaia app with phone + PIN; they share their location while on a delivery.

create table shop_rider (
  id          serial primary key,
  name        text not null,
  phone       text not null unique check (phone ~ '^[6-9][0-9]{9}$'),
  pin_hash    text not null,
  -- the session token the app holds after login; a new login replaces it
  token       text unique,
  active      boolean not null default true,
  lat         double precision,
  lng         double precision,
  location_at timestamptz,
  created_at  timestamptz not null default now()
);

alter table shop_order
  add column lat           double precision check (lat between -90 and 90),
  add column lng           double precision check (lng between -180 and 180),
  add column rider_id      int references shop_rider(id),
  add column assigned_at   timestamptz,
  add column picked_up_at  timestamptz,
  add column delivered_at  timestamptz,
  -- the customer reads this out at the door; the rider enters it to complete the delivery
  add column delivery_otp  text not null default lpad((floor(random() * 10000))::int::text, 4, '0');

create index shop_order_rider_ix on shop_order (rider_id, status);
