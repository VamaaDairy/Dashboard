-- =====================================================================
-- The Vamaa centres the plant reads milk from
--
-- One organisation in the Vamaa app has several centres: village collection
-- centres where farmers pour milk, and a tanker centre where milk bought from
-- other dairies is entered on the days a tanker arrives. Every fetch checks
-- every active centre for every day, and stores whatever it finds the same
-- way (vamaa_collection, vamaa_farmer, both keyed by centre).
--
--   kind = 'village' - farmers' milk, priced from the rate chart.
--   kind = 'tanker'  - another dairy's tanker. No CLR is recorded (SNF is
--                      sent directly) and the chart doesn't apply, so it
--                      carries no chart price.
-- =====================================================================

create table vamaa_center (
  center      text primary key,              -- the app's short_name, e.g. '5004'
  name        text not null,
  kind        text not null default 'village' check (kind in ('village', 'tanker')),
  is_active   boolean not null default true,
  sort_order  int not null default 0
);
