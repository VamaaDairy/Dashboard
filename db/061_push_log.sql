-- =====================================================================
-- Push notifications: log of notifications sent by hand from the dashboard
-- =====================================================================

create table if not exists push_log (
  id         serial primary key,
  audience   text not null,
  title      text not null,
  body       text not null,
  sent       int  not null default 0,
  failed     int  not null default 0,
  sent_by    text,
  created_at timestamptz not null default now()
);
create index if not exists push_log_created_ix on push_log (created_at desc);
