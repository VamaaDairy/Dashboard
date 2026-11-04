-- Subscription deliveries paid by UPI Autopay (Easebuzz Autocollect). See src/lib/shop/autopay.ts.
--
-- A customer authorises one UPI Autopay mandate (in their UPI app, through Easebuzz's page). Each subscription
-- delivery that is handed over becomes a charge: the evening it is delivered the customer's bank is notified
-- of the amount (NPCI requires it 24 h ahead), the next evening it is debited. No cash for these orders.

alter table shop_order drop constraint shop_order_payment_method_check;
alter table shop_order add constraint shop_order_payment_method_check check (payment_method in ('cod', 'online', 'autopay'));

create table shop_mandate (
  id             serial primary key,
  customer_id    int not null references shop_customer (id) on delete cascade,
  txn_id         text not null unique,                -- ours, Easebuzz's transaction_id for the mandate (letters and digits)
  easebuzz_id    text,                                -- Easebuzz's mandate id
  status         text not null default 'requested',   -- Easebuzz's word: requested, initiated, authorized, failed, rejected,
                                                      -- bounced, dropped, user_cancelled, cancelled, revoking, revoked, expired, completed
  max_amount     numeric(10,2) not null check (max_amount >= 1),
  start_date     date not null,
  end_date       date not null,
  access_key     text,                                -- opens Easebuzz's page where the customer approves it in their UPI app
  upi_handle     text,
  umrn           text,
  raw            jsonb,                               -- Easebuzz's last answer about it
  authorized_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index shop_mandate_customer_ix on shop_mandate (customer_id, created_at desc);

create table shop_charge (
  id             serial primary key,
  order_id       int not null unique references shop_order (id) on delete cascade,
  customer_id    int not null references shop_customer (id) on delete cascade,
  mandate_id     int references shop_mandate (id) on delete set null,
  amount         numeric(10,2) not null check (amount > 0),
  -- pending: delivered, to notify  ->  notifying -> notified (bank told; debit after 24 h)  ->  presenting -> paid
  -- failed: a step failed; tried again the next evening until attempts run out (then 'unpaid': the customer pays in the app)
  status         text not null default 'pending'
                 check (status in ('pending', 'notifying', 'notified', 'presenting', 'paid', 'failed', 'unpaid', 'cancelled')),
  attempts       int not null default 0,
  notify_no      text unique,                         -- notification_request_number of the current attempt
  debit_no       text unique,                         -- merchant_request_number of the current attempt
  notified_at    timestamptz,
  presented_at   timestamptz,
  paid_at        timestamptz,
  failure        text,                                -- why the last attempt failed, in Easebuzz's / the bank's words
  raw            jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index shop_charge_status_ix on shop_charge (status, updated_at);
create index shop_charge_customer_ix on shop_charge (customer_id, created_at desc);
