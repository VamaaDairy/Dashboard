-- A row cannot reference itself before it exists: self-referencing "required" columns are nullable.
alter table fp_delivery alter column delivery_uid drop not null;
