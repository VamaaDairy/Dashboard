-- Forgot password: each user can keep a recovery email on their profile (separate from the email
-- they sign in with). A reset sends a 6-digit code there; only a hash of the code is stored.

alter table app_user add column recovery_email text;
create unique index app_user_recovery_email_uq on app_user (lower(recovery_email)) where recovery_email is not null;

create table password_reset (
  user_id    uuid primary key references app_user(id) on delete cascade,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   int not null default 0,
  sent_at    timestamptz not null default now()
);
