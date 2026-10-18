-- Quantity the customer is claiming credit for, alongside what was physically returned.
alter table credit_note_item add column claim_qty numeric(14, 3) check (claim_qty >= 0);
