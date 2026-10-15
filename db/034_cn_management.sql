-- =====================================================================
-- CN Management (complaint-led credit notes, per the CN Management SOP).
-- Separate from the older credit_note tables, which are left as they are.
--
-- One row per customer complaint; it moves through `stage`:
--   registered -> logged -> assigned -> rca_done -> recommended -> approved
--   -> posted -> closed          (rejected is a dead end: invalid, or CN refused)
-- Each stage stamps who did it and when. cn_event is the audit trail.
-- =====================================================================

create sequence cn_complaint_seq;

create table cn_complaint (
  id               uuid primary key default gen_random_uuid(),
  complaint_no     text not null unique default ('CMP-' || to_char(now(), 'YY') || '-' || lpad(nextval('cn_complaint_seq')::text, 5, '0')),
  stage            text not null default 'registered'
                   check (stage in ('registered','logged','assigned','rca_done','recommended','approved','posted','closed','rejected')),
  stage_on         date not null default current_date,         -- when it entered this stage (TAT clock)
  outcome          text check (outcome in ('cn_issued','no_cn','rejected')),

  -- registration
  complaint_date   date not null,
  customer_name    text not null,
  customer_type    text not null,
  region           text,
  contact_no       text,
  invoice_no       text not null,
  invoice_date     date,
  product_name     text not null,
  batch_no         text,
  qty_affected     numeric(14, 3) not null check (qty_affected > 0),
  qty_unit         text not null default 'Pcs',
  category         text not null,
  description      text not null,
  evidence_url     text not null,
  claim_value      numeric(14, 2) not null check (claim_value > 0),
  registered_by    text not null,
  created_at       timestamptz not null default now(),

  -- MIS verification
  mis_by           text,
  mis_on           date,
  mis_remark       text,

  -- department assignment
  department       text,
  assigned_by      text,
  assigned_on      date,
  tat_due          date,

  -- investigation, RCA, CAPA
  investigation    text,
  root_cause       text,
  corrective_action text,
  preventive_action text,
  capa_owner       text,
  capa_target_date date,
  rca_by           text,
  rca_on           date,

  -- credit note recommendation
  recommended_value numeric(14, 2),
  return_required   boolean not null default false,
  recommend_remark  text,
  recommended_by    text,
  recommended_on    date,

  -- approval (per the approval matrix)
  approval_level   text,                                        -- level the value needs
  approver_level   text,                                        -- level the approver acted at
  approved_value   numeric(14, 2),
  approved_by      text,
  approved_on      date,
  approval_remark  text,

  -- finance posting
  cn_number        text,
  cn_date          date,
  cn_value         numeric(14, 2),
  finance_by       text,
  finance_on       date,

  -- return material verification
  return_verified_by  text,
  return_verified_on  date,
  return_remark       text,

  -- closure
  closed_by        text,
  closed_on        date,
  closure_remark   text,

  -- CAPA effectiveness review
  capa_effective   boolean,
  capa_review_by   text,
  capa_review_on   date,
  capa_review_remark text
);

create unique index cn_complaint_cn_number_uq on cn_complaint (lower(cn_number)) where cn_number is not null;
create index cn_complaint_stage_idx on cn_complaint (stage, complaint_date desc);
create index cn_complaint_dup_idx on cn_complaint (lower(customer_name), lower(invoice_no), lower(product_name));

create table cn_event (
  id            uuid primary key default gen_random_uuid(),
  complaint_id  uuid not null references cn_complaint(id) on delete cascade,
  at            timestamptz not null default now(),
  by_name       text not null,
  action        text not null,
  remark        text
);
create index cn_event_complaint_idx on cn_event (complaint_id, at);
