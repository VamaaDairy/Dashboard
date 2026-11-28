-- Tally names in the masters: what each customer and product is called in Tally, so a sales voucher can be built for
-- Tally from the Dashboard alone (the XML file is imported into Tally by hand; nothing here writes to Tally).
--   fp_firm.tally_name     the Tally ledger the customer is billed to (a stockist's outlet: the stockist's ledger)
--   fp_product.tally_name  the Tally stock item the product is sold as
-- Both start from the route sheet's mapping (route_order_party / route_order_product), which came from the demand
-- sheet workbook, and stay in step with it from now on (either screen saves both).

alter table fp_firm add column if not exists tally_name text;
alter table fp_product add column if not exists tally_name text;

update fp_firm f
   set tally_name = trim(rp.tally_ledger)
  from route_order_party rp
 where rp.firm_uid = f.uid
   and coalesce(trim(rp.tally_ledger), '') <> ''
   and coalesce(trim(f.tally_name), '') = '';

update fp_product p
   set tally_name = trim(rp.tally_item)
  from route_order_product rp
 where rp.sku_no::text = regexp_replace(p.sku_code, '\D', '', 'g')
   and coalesce(trim(rp.tally_item), '') <> ''
   and coalesce(trim(p.tally_name), '') = '';

-- Tally's own names, read from Tally (read only) for the masters to pick from and to check against
create table if not exists tally_name (
  kind       text not null check (kind in ('ledger', 'item', 'unit')),
  name       text not null,
  -- ledger: its group; item: its base unit
  parent     text,
  gstin      text,
  -- a ledger somewhere under Sundry Debtors
  debtor     boolean not null default false,
  read_at    timestamptz not null default now(),
  primary key (kind, name)
);
create index if not exists tally_name_key on tally_name (kind, (regexp_replace(lower(name), '[^a-z0-9]', '', 'g')));
create index if not exists tally_name_gstin on tally_name (upper(gstin)) where gstin is not null;

-- each read from Tally: who, when, and what it filled in the masters
create table if not exists tally_name_read (
  id       serial primary key,
  read_at  timestamptz not null default now(),
  read_by  text,
  ledgers  int not null default 0,
  items    int not null default 0,
  filled   jsonb not null default '[]'
);
