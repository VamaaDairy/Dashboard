-- Wrong-PIN lockout for the app sign-ins: 5 wrong PINs for one number blocks it for 15 minutes.
-- Keyed by number (not by address), so changing IP or faking X-Forwarded-For does not help.
create table if not exists pin_attempt (
  scope        text not null,          -- rider | dist | sf | emp
  phone        text not null,
  fails        int  not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (scope, phone)
);
