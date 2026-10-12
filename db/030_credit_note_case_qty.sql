-- Quantities are packed like the stock app does it: whole cases plus loose pieces.
-- credit_note_item keeps every quantity (return, claim, approved) as TOTAL PIECES,
-- with the SKU's case unit (return_unit: CRT / CBX / PCS / KG ...) and how many
-- pieces make a case. pcs_per_case = 1 means the quantity is simply counted in return_unit.
alter table credit_note_item
  add column sku_code      text,
  add column pcs_per_case  int not null default 1 check (pcs_per_case > 0);
