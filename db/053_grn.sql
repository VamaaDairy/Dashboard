-- GRN (goods received): an invoice number with the photo of the GRN against it.
-- One row per upload; the same invoice can have more than one photo.

create table grn (
  id          serial primary key,
  invoice_no  text not null check (btrim(invoice_no) <> ''),
  image       bytea not null,
  image_mime  text not null,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index grn_invoice_ix on grn (lower(invoice_no));
create index grn_created_ix on grn (created_at desc);
