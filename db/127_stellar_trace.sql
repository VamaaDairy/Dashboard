-- Production batches recorded on the Stellar blockchain (2026-11-25).
-- A production batch becomes a public "trace": one batch twin on the batch-registry contract,
-- plus one anchored record per recording. The record's exact bytes are kept here and served at
-- /api/trace/records/<hash>; only their SHA-256 goes on chain, so anyone can re-hash and compare.

create table trace_batch (
  trace_id      text primary key,                       -- the public batch id on chain and in the QR link
  bulk_batch_id uuid unique references bulk_batch (id) on delete set null,
  product_uid   uuid references fp_product (uid) on delete set null,   -- the SKU shown to customers (name, photo)
  title         text not null,                          -- product name as shown on the public page
  network       text not null,                          -- testnet / mainnet
  contract_id   text not null,
  tx_hash       text,                                   -- create_batch transaction
  created_by    text,
  created_at    timestamptz not null default now()
);

create table trace_record (
  id          uuid primary key default gen_random_uuid(),
  trace_id    text not null references trace_batch (trace_id) on delete cascade,
  kind        text not null,                            -- step: processed, packed, ...
  hash        text not null unique,                     -- sha256 of body, hex
  body        bytea not null,                           -- exact canonical JSON bytes that were hashed
  anchor_no   integer,                                  -- index in the contract's event list
  tx_hash     text,
  ledger      integer,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index trace_record_trace_ix on trace_record (trace_id, created_at);
