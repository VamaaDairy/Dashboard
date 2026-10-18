-- =====================================================================
-- A credit note can return several materials: move the per-material
-- columns off credit_note onto credit_note_item (one row per material).
-- Approved quantity is now decided per item; the note's status stays on
-- credit_note, and "partially approved" means the approved total is below
-- the returned total.
-- =====================================================================

create table credit_note_item (
  id              uuid primary key default gen_random_uuid(),
  credit_note_id  uuid not null references credit_note(id) on delete cascade,
  position        int  not null default 0,
  material_name   text not null,
  reason          text,
  ubd             date,
  return_qty      numeric(14, 3) not null check (return_qty > 0),
  return_unit     text not null default 'Pcs',
  approved_qty    numeric(14, 3) check (approved_qty >= 0),
  quality_remark  text
);
create index credit_note_item_note_idx on credit_note_item (credit_note_id, position);

insert into credit_note_item (credit_note_id, material_name, reason, ubd, return_qty, return_unit, approved_qty, quality_remark)
select id, material_name, reason, ubd, return_qty, return_unit, approved_qty, quality_remark from credit_note;

alter table credit_note
  drop column material_name, drop column reason, drop column ubd, drop column return_qty,
  drop column return_unit, drop column approved_qty, drop column quality_remark;
