-- Customers sign in to the Gaia app with mobile number + a 5-digit PIN (no SMS / OTP for now).
-- Their order history is every order placed with that mobile number, so it survives a reinstall.

create table shop_customer (
  id           serial primary key,
  name         text not null,
  phone        text not null unique check (phone ~ '^[6-9][0-9]{9}$'),
  pin_hash     text not null,
  -- the session token the app holds after login; a new login replaces it
  token        text unique,
  -- wrong-PIN counter; too many in a row locks sign-in for a while
  failed_tries int not null default 0,
  locked_until timestamptz,
  created_at   timestamptz not null default now()
);

create index shop_order_phone_ix on shop_order (phone, created_at desc);
