-- =====================================================================
-- Push notifications (Firebase Cloud Messaging)
--
-- push_device   one row per phone (FCM token) per signed-in role. session_hash is the sha256 of the
--               sign-in token the phone registered with, so a push only goes while that session is
--               still the live one: signing out (or a rider/distributor signing in elsewhere) stops it
-- =====================================================================

create table if not exists push_device (
  token         text not null,
  role          text not null check (role in ('customer', 'rider', 'distributor')),
  owner_id      int  not null,
  session_hash  text not null,
  platform      text not null default 'android' check (platform in ('android', 'ios')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (token, role)
);
create index if not exists push_device_owner_ix on push_device (role, owner_id);
