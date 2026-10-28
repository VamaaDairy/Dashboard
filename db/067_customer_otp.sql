-- SMS one-time codes for Gaia customers: confirming a mobile number when an account is created,
-- and resetting a forgotten PIN. Only a keyed hash of the code is stored; one live code per number.

create table shop_customer_otp (
  phone          text primary key check (phone ~ '^[6-9][0-9]{9}$'),
  purpose        text not null check (purpose in ('signup', 'reset')),
  code_hash      text not null,
  expires_at     timestamptz not null,
  attempts       int not null default 0,
  sent_at        timestamptz not null default now(),
  -- SMS costs money: a number can be sent only so many codes per hour
  window_start   timestamptz not null default now(),
  sent_in_window int not null default 1
);
