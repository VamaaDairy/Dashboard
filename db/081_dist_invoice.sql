-- Invoices for the orders distributors and retailers place from the Gaia Partners app.
-- Each order gets one, numbered per financial year (GP/26-27/00001). Its seller, buyer and lines are frozen
-- when it is issued, so a later change of price or address never rewrites it. Prices include GST.

create table dist_invoice (
  id                serial primary key,
  booking_order_uid uuid not null unique references fp_booking_order (uid) on delete cascade,
  invoice_no        text not null unique,
  fy                text not null,
  seq               int not null,
  issued_at         timestamptz not null default now(),
  data              jsonb not null,
  unique (fy, seq)
);
