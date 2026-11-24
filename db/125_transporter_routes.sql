-- Delivery transporters in full: who to call, their papers, their vehicles, and the routes they run.
-- Every trip on a route goes with that route's transporter (route_order_route.transporter_id).

alter table transporter
  add column if not exists contact_person text,
  add column if not exists phone          text,
  add column if not exists alt_phone      text,
  add column if not exists address        text,
  add column if not exists gstin          text,
  add column if not exists pan            text;

-- The vehicles a transporter sends, and who drives each.
create table if not exists transporter_vehicle (
  id             uuid primary key default gen_random_uuid(),
  transporter_id uuid not null references transporter (id) on delete cascade,
  vehicle_no     text not null,
  vehicle_type   text,          -- e.g. "Tata 407 (reefer)", "Pickup"
  capacity       text,          -- as the transporter states it: "3 t", "250 crates"
  driver_name    text,
  driver_phone   text,
  active         boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (transporter_id, vehicle_no)
);
drop trigger if exists transporter_vehicle_touch on transporter_vehicle;
create trigger transporter_vehicle_touch before update on transporter_vehicle
  for each row execute function touch_updated_at();

-- The transporter that runs each route.
alter table route_order_route add column if not exists transporter_id uuid references transporter (id) on delete set null;

-- Who runs which route today (2026-11-24). Routes not named here stay unassigned.
with s as (select id from scenario order by (status = 'active') desc, created_at desc limit 1),
     pick (route, code) as (values
       ('Bhilai', 'balaji_transport'), ('Rajnandgaon', 'balaji_transport'),
       ('Raigarh', 'roshni_transport'),
       ('Bilaspur', 'mahadev_transport'), ('Korba', 'mahadev_transport'),
       ('Raipur 2', 'khollari_transport'),
       ('Raipur 1', 'plant_own_transport'), ('Raipur 3', 'plant_own_transport'))
update route_order_route r set transporter_id = t.id
  from pick p, transporter t, s
 where r.name = p.route and r.transporter_id is null
   and t.scenario_id = s.id and t.section = 'delivery' and t.code = p.code;
