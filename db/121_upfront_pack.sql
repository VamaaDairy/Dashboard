-- The first payment of a subscription is taken when the customer approves autopay in their UPI app (Easebuzz's
-- upfront presentment). shop_charge.upfront_txn: the mandate whose approval pays this pack; until that mandate says
-- how it went, the pack is not sent to the bank any other way.
alter table shop_charge add column if not exists upfront_txn text;
create index if not exists shop_charge_upfront_ix on shop_charge (upfront_txn) where upfront_txn is not null;
