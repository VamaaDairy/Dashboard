-- Collections (invoices, payments, credit notes) and logistics (deliveries,
-- sales returns, van-stock transfers) for the Orders section.

create sequence ord_invoice_seq;
create sequence ord_cn_seq;
create sequence ord_return_seq;

-- raised automatically when an order is marked invoiced
create table ord_invoice (
  id           uuid primary key default gen_random_uuid(),
  invoice_no   text not null unique default ('INV-' || lpad(nextval('ord_invoice_seq')::text, 6, '0')),
  order_id     uuid unique references ord_order(id) on delete cascade,
  customer_id  uuid not null references ord_customer(id) on delete restrict,
  invoice_date date not null default current_date,
  due_date     date not null default current_date,
  amount       numeric(14,2) not null check (amount >= 0),
  created_at   timestamptz not null default now()
);
create index ord_invoice_customer on ord_invoice(customer_id);

create table ord_payment (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references ord_customer(id) on delete restrict,
  invoice_id  uuid references ord_invoice(id) on delete set null,
  pay_date    date not null default current_date,
  amount      numeric(14,2) not null check (amount > 0),
  mode        text not null default 'cash' check (mode in ('cash','upi','cheque','neft')),
  reference   text,
  status      text not null default 'pending' check (status in ('pending','cleared','bounced')),
  collected_by uuid references ord_staff(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index ord_payment_invoice on ord_payment(invoice_id);

create table ord_credit_note (
  id          uuid primary key default gen_random_uuid(),
  cn_no       text not null unique default ('CN-' || lpad(nextval('ord_cn_seq')::text, 5, '0')),
  customer_id uuid not null references ord_customer(id) on delete restrict,
  invoice_id  uuid references ord_invoice(id) on delete set null,
  cn_date     date not null default current_date,
  amount      numeric(14,2) not null check (amount > 0),
  reason      text,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now()
);

create table ord_delivery (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references ord_order(id) on delete cascade,
  delivery_date date not null default current_date,
  vehicle       text,
  driver        text,
  status        text not null default 'planned' check (status in ('planned','out_for_delivery','delivered','failed')),
  note          text
);

-- approving a return puts the stock back (done in app code)
create table ord_return (
  id          uuid primary key default gen_random_uuid(),
  return_no   text not null unique default ('RET-' || lpad(nextval('ord_return_seq')::text, 5, '0')),
  customer_id uuid not null references ord_customer(id) on delete restrict,
  product_id  uuid not null references ord_product(id) on delete restrict,
  qty         numeric(12,3) not null check (qty > 0),
  rate        numeric(12,2) not null default 0,
  reason      text not null default 'damaged' check (reason in ('damaged','expired','wrong_item','excess','other')),
  return_date date not null default current_date,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now()
);

-- stock handed to a salesman's van and brought back
create table ord_van_transfer (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid not null references ord_staff(id) on delete cascade,
  product_id    uuid not null references ord_product(id) on delete restrict,
  qty           numeric(12,3) not null check (qty > 0),
  direction     text not null default 'issue' check (direction in ('issue','return')),
  transfer_date date not null default current_date,
  note          text
);
