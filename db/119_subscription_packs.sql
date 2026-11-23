-- Subscriptions paid 30 deliveries at a time (src/lib/shop/packs.ts).
--
-- A customer on autopay buys a "pack": one debit for their next 30 delivery days. Each day's subscription order uses one
-- day ('prepaid' orders, already paid); skipped / paused / out-of-stock days use nothing, so the pack lasts until 30
-- deliveries are done. A few days before it runs out the next pack is debited. The money balance (packs paid minus
-- prepaid orders) settles any change in quantity or price at the next renewal.
--
-- shop_charge.kind       'delivery' (one order, the old per-delivery debit) or 'pack' (order_id null, [days] deliveries).
-- shop_subscription.renew           false once the customer cancels: no more packs for it.
-- shop_subscription.ends_after_day  its last paid delivery-day number (the customer's own count) - it ends after that.

alter table shop_charge alter column order_id drop not null;
alter table shop_charge add column if not exists kind text not null default 'delivery' check (kind in ('delivery', 'pack'));
alter table shop_charge add column if not exists days int check (days > 0);
alter table shop_charge drop constraint if exists shop_charge_amount_check;
alter table shop_charge add constraint shop_charge_amount_check check (amount > 0 or (kind = 'pack' and amount >= 0));
alter table shop_charge add constraint shop_charge_kind_shape check ((kind = 'delivery' and order_id is not null) or (kind = 'pack' and order_id is null and days is not null));
-- at most one pack on its way per customer (a second request can never debit twice)
create unique index if not exists shop_charge_one_open_pack on shop_charge (customer_id)
  where kind = 'pack' and status in ('pending', 'notifying', 'notified', 'presenting', 'failed');

alter table shop_order drop constraint shop_order_payment_method_check;
alter table shop_order add constraint shop_order_payment_method_check check (payment_method in ('cod', 'online', 'autopay', 'prepaid'));

alter table shop_subscription add column if not exists renew boolean not null default true;
alter table shop_subscription add column if not exists ends_after_day int;
