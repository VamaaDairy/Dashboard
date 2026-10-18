-- =====================================================================
-- Credit notes: material a customer sends back, checked and then approved
-- or rejected.
--
-- status       : pending -> approved | rejected. "Partially approved" is not
--                stored; it is an approved note whose approved_qty is below
--                return_qty.
-- approved_*   : who decided and when (set when the note is approved or rejected).
-- =====================================================================

create table credit_note (
  id                   uuid primary key default gen_random_uuid(),
  challan_no           text not null,
  challan_date         date not null,
  customer_name        text not null,
  contact_no           text,
  address              text,
  checked_by           text,
  vehicle_no           text,
  dispatch_challan_no  text,
  dispatch_date        date,
  material_name        text not null,
  reason               text,
  ubd                  date,                                   -- use-by date
  return_qty           numeric(14, 3) not null check (return_qty > 0),
  return_unit          text not null default 'Pcs',
  approved_qty         numeric(14, 3) check (approved_qty >= 0),
  quality_remark       text,
  team_name            text,
  status               text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by          text,
  approved_on          date,
  decision_note        text,
  created_by           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index credit_note_status_idx on credit_note (status, challan_date desc);
