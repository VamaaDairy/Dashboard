-- A distributor's ledger as last read from Tally (read only), for the Gaia Distributors app: shown again while Tally
-- can't be reached. One row per Tally ledger and period (months back from today).
create table if not exists tally_ledger_cache (
  ledger   text not null,
  months   int not null,
  data     jsonb not null,
  read_at  timestamptz not null default now(),
  primary key (ledger, months)
);
