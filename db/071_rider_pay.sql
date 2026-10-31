-- What a delivery partner earns: a fixed amount per delivery, set per rider on the dashboard (Shop orders ->
-- Riders). Each delivered order keeps the rate it was delivered at, so a later change of rate doesn't
-- rewrite what was already earned. The rider app shows it as income: today, this week, this month.

alter table shop_rider add column pay_per_delivery numeric(10,2) not null default 0 check (pay_per_delivery >= 0);
alter table shop_order add column rider_pay numeric(10,2) check (rider_pay >= 0);
