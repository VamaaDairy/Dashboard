-- =====================================================================
-- Packaging master details
--
-- The packaging master keeps one rate per item (the cost model reads it).
-- This holds the working and the particulars behind that rate - category,
-- spec, supplier, and the base rate, GST and freight it is built from - so
-- they can be looked up and used elsewhere. When a base rate is given, the
-- item's rate is base x (1 + GST %) + freight.
-- =====================================================================

create table packaging_detail (
  packaging_id  uuid primary key references cost_object(id) on delete cascade,
  category      text,
  spec          text,                                   -- e.g. 80 mic, 200 ml, 5 kg
  supplier      text,
  base_rate     numeric(20, 6) check (base_rate is null or base_rate >= 0),   -- per unit, before GST
  gst_pct       numeric(8, 4) not null default 0,
  freight       numeric(20, 6) not null default 0,      -- per unit
  note          text
);
