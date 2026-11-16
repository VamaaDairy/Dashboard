-- API keys: let another system (an app backend, Tally, a script) call the Dashboard API as one Dashboard user.
-- A key acts with exactly that user's access (their department plus their own), so it can never do more than the
-- user could on screen; switching the user off or revoking the key stops it at once.
--
-- The key itself is shown once when it is made and never stored: only its SHA-256 (key_hash). prefix is its first
-- characters, kept so a key can be recognised in the list ("gk_3f9a1c...").

create table if not exists api_key (
  id           serial primary key,
  name         text not null check (length(trim(name)) between 1 and 80),
  user_id      uuid not null references app_user (id) on delete cascade,
  prefix       text not null,
  key_hash     text not null unique,
  created_by   text not null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz,
  revoked_by   text
);

create index if not exists api_key_user_ix on api_key (user_id);
