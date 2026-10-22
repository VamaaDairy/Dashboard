-- =====================================================================
-- Electricity: keep the worked-out figures with each morning's reading
--
-- A day's units = (next morning's reading - this morning's) x 600, with no
-- division by 10 (the earlier version divided by 10 and came out 10x low).
-- The columns are filled by saveMeterReading and backfilled here.
-- =====================================================================

alter table electricity_reading
  add column if not exists kwh_diff   numeric(14, 2),   -- next kWh - this kWh
  add column if not exists kwh_units  numeric(14, 2),   -- kwh_diff x 600 = the day's kWh
  add column if not exists kvah_diff  numeric(14, 2),   -- next kVAh - this kVAh
  add column if not exists kvah_units numeric(14, 2);   -- kvah_diff x 600 = the day's kVAh

update electricity_reading r set
  kwh_diff   = n.kwh - r.kwh,
  kwh_units  = round((n.kwh - r.kwh) * 600, 2),
  kvah_diff  = case when n.kvah is not null and r.kvah is not null then n.kvah - r.kvah end,
  kvah_units = case when n.kvah is not null and r.kvah is not null then round((n.kvah - r.kvah) * 600, 2) end
from electricity_reading n
where n.scenario_id = r.scenario_id and n.day = r.day + 1;
