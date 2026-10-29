-- Online payment for Gaia app orders through Easebuzz. Cash on delivery stays.
--
-- An order paid online is created as 'awaiting_payment' and becomes 'placed' (and reaches the team) only
-- once Easebuzz confirms the money: from its webhook, the success page, or our own check with its
-- Transaction API - never from what the phone says. Every attempt is one shop_payment row (its txnid is
-- what Easebuzz knows the payment by); an order can be tried again or switched to cash.

alter table shop_order drop constraint shop_order_payment_method_check;
alter table shop_order add constraint shop_order_payment_method_check check (payment_method in ('cod', 'online'));

alter table shop_order drop constraint shop_order_payment_status_check;
alter table shop_order add constraint shop_order_payment_status_check check (payment_status in ('pending', 'paid', 'refunded'));

alter table shop_order drop constraint shop_order_status_check;
alter table shop_order add constraint shop_order_status_check
  check (status in ('awaiting_payment', 'placed', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'));

create table shop_payment (
  id          serial primary key,
  order_id    int not null references shop_order (id) on delete cascade,
  txnid       text not null unique,                 -- ours, sent to Easebuzz: "<order no>-<attempt>"
  amount      numeric(12,2) not null check (amount > 0),
  status      text not null default 'initiated',    -- initiated, then Easebuzz's word: success, failure, usercancelled, dropped, bounced ...
  access_key  text,                                 -- what the app opens the Easebuzz checkout with
  easepayid   text,                                 -- Easebuzz's own id for the payment
  mode        text,                                 -- UPI, card, net banking ...
  raw         jsonb,                                -- the last verified reply from Easebuzz, as it came
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index shop_payment_order_ix on shop_payment (order_id, created_at desc);
