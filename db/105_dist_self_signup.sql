-- Distributors and retailers can ask for an account themselves in the Gaia Distributors app ("Create account").
-- It lands in the same list the office already reviews (App orders > New customers): the request carries the PIN
-- they chose (hashed), and approving it creates the customer and switches on their app login with that PIN.
--
-- source    sales = a sales officer proposed it (Gaia Salesforce), app = the party signed up itself
-- pin_hash  only for source = app

alter table dist_firm_request alter column staff_uid drop not null;
alter table dist_firm_request alter column address drop not null;
alter table dist_firm_request add column if not exists source text not null default 'sales';
alter table dist_firm_request add column if not exists pin_hash text;
alter table dist_firm_request drop constraint if exists dist_firm_request_source_check;
alter table dist_firm_request add constraint dist_firm_request_source_check check (source in ('sales', 'app'));
create index if not exists dist_firm_request_phone_ix on dist_firm_request (phone, created_at desc);
