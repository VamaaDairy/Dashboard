-- Who added, changed, deactivated, reactivated or deleted a master record
-- (customers, employees, products, routes ...) from the /orders screens.
-- `slug` is the screen (e.g. distribution), `record_id` the row's uid / id.

create table master_audit (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  actor      text not null,
  slug       text not null,
  record_id  text not null,
  action     text not null check (action in ('create','update','deactivate','activate','delete')),
  summary    text,
  before     jsonb,
  after      jsonb
);
create index master_audit_record_ix on master_audit (slug, record_id, at desc);
create index master_audit_at_ix on master_audit (at desc);
