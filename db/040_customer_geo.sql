-- Outlet coordinates, for the team / customer map.
alter table ord_customer add column lat numeric(9,6) check (lat between -90 and 90);
alter table ord_customer add column lng numeric(9,6) check (lng between -180 and 180);
