-- =====================================================================
-- Outstandings: statement emails to Sundry Debtors
--
-- os_recipient   the address a party's statement actually goes to (Tally's own email is only a suggestion)
-- os_setting     singleton (id 1). Test mode starts ON so nothing reaches a real party until it is switched off
-- os_email_log   every send attempt, one row each
-- =====================================================================

create table if not exists os_recipient (
  ledger_name text primary key,
  email       text not null,
  updated_at  timestamptz not null default now()
);

create table if not exists os_setting (
  id                   int primary key check (id = 1),
  test_mode            boolean not null default true,
  test_recipient_email text not null default 'darshan@vamaadairy.com'
);
insert into os_setting (id) values (1) on conflict (id) do nothing;

create table if not exists os_email_log (
  id                 bigserial primary key,
  ledger_name        text not null,
  intended_recipient text not null default '',
  actual_recipient   text not null default '',
  test_mode          boolean not null,
  status             text not null check (status in ('sent', 'failed')),
  error              text,
  sent_at            timestamptz not null default now()
);
create index if not exists os_email_log_sent_idx on os_email_log (sent_at desc);
create index if not exists os_email_log_ledger_idx on os_email_log (ledger_name, sent_at desc);
