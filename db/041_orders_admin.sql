-- Orders admin: organisation settings and the integration (ERP sync) log.

create table ord_setting (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

create table ord_sync_log (
  id        uuid primary key default gen_random_uuid(),
  entity    text not null check (entity in ('customers','products','inventory','stock_transfer','bills','transactions','orders','van_stock')),
  run_at    timestamptz not null default now(),
  status    text not null default 'success' check (status in ('success','partial','failed')),
  records   int not null default 0 check (records >= 0),
  message   text
);
create index ord_sync_log_entity on ord_sync_log(entity, run_at desc);
