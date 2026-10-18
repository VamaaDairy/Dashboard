-- A credit note is claimed and then approved; there is no separate return quantity.
update credit_note_item set claim_qty = return_qty where claim_qty is null and return_qty is not null;
alter table credit_note_item drop column return_qty;
