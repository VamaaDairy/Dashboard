-- Return Qty. is filled in after the material has been checked, so a note can be created without it.
-- It is required before a note can be approved (enforced in the app).
alter table credit_note_item alter column return_qty drop not null;
