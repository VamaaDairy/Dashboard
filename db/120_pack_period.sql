-- How long each subscription pack covers, chosen by the customer: 4 weeks, a month, or up to a date of their own
-- (kept as a number of days, repeated at every renewal). The pack pays for the deliveries the plan makes in that
-- period; skipped days still do not use any, so a pack lasts until its deliveries are done.
alter table shop_customer add column if not exists pack_unit text not null default 'month' check (pack_unit in ('weeks', 'month', 'days'));
alter table shop_customer add column if not exists pack_len int not null default 1 check (pack_len between 1 and 366);
