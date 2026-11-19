-- Which way Easebuzz's word on a payment attempt reached us (lib/payments/easebuzz.ts):
--   webhook       Easebuzz's server posting to /api/payments/easebuzz (the URL set in the Easebuzz dashboard)
--   payment page  the customer's phone coming back from the checkout to the same URL (surl / furl)
--   app check     our own question to Easebuzz (Transaction API) when the app asks, or on a switch to cash
-- heard: the first time each way brought a signed reply. confirmed_by: the way that brought the success first.
alter table shop_payment add column if not exists heard jsonb not null default '{}'::jsonb;
alter table shop_payment add column if not exists confirmed_by text;
