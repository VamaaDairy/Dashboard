-- Road plans for the Dispatch routes map and trips: the visiting order of a set of outlets from the plant by road
-- distance, and the road path through them (Ola Maps). Keyed by the exact points, so a plan is worked out once and
-- reused until an outlet, its pin or the plant changes.
create table if not exists dispatch_road_plan (
  key        text primary key,
  plan       jsonb not null,
  created_at timestamptz not null default now()
);
