-- eNACH (bank-account) autopay next to UPI Autopay. Easebuzz's approval page now offers both; the customer picks one.
--
-- shop_mandate.kind          'upi' or 'enach', from Easebuzz's mandate_type once the customer has chosen (null before).
-- shop_mandate.bank_account  the bank account an eNACH mandate debits, masked as Easebuzz gives it (e.g. XXXXXXXX8782).
--
-- An eNACH charge has no bank notice: pending -> presenting (debit raised; the bank answers in 24-48 h) -> paid.

alter table shop_mandate add column if not exists kind text check (kind in ('upi', 'enach'));
alter table shop_mandate add column if not exists bank_account text;

-- every mandate before this was UPI only
update shop_mandate set kind = 'upi' where kind is null;
