-- Distributor app logins (Gaia Flutter app, "Distributor sign in").
-- A login is either a distributor (a level-3 firm placing its own primary orders) or a
-- salesman (an fp_staff who places the order on behalf of a distributor he is the sales
-- contact of: fp_firm.sales_contact_uid). Both sign in with phone + PIN, like riders.
-- Orders land in fp_booking_order / fp_booking_order_item, which is what the dashboard's
-- Primary section (Primary Order Processing etc.) reads.

create table dist_login (
  id         serial primary key,
  kind       text not null check (kind in ('distributor', 'salesman')),
  firm_uid   uuid references fp_firm(uid) on delete cascade,
  staff_uid  uuid references fp_staff(uid) on delete cascade,
  phone      text not null unique check (phone ~ '^[6-9][0-9]{9}$'),
  pin_hash   text not null,
  -- the session token the app holds after login; a new login replaces it
  token      text unique,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  check ((kind = 'distributor' and firm_uid is not null and staff_uid is null)
      or (kind = 'salesman' and staff_uid is not null and firm_uid is null))
);
create unique index dist_login_firm_uq on dist_login (firm_uid) where firm_uid is not null;
create unique index dist_login_staff_uq on dist_login (staff_uid) where staff_uid is not null;
