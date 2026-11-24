-- A new distributor onboards itself in the Gaia Distributors app with every detail Customer Masters keeps, follows its
-- application without signing in, and signs in with the PIN it chose once the office approves it and sets its rates.
--
-- dist_firm_request
--   landline, district, aadhar_no   the rest of the customer master's details (with what db/104, 105, 117 added)
--   ticket_hash                     sha-256 of the ticket the app keeps to read the application's status (no login yet)
--   price_list_uid, credit_limit, firm_class   what the office chose when approving (rates: a price list, or none =
--                                   the channel's rates)

alter table dist_firm_request add column if not exists landline text;
alter table dist_firm_request add column if not exists district text;
alter table dist_firm_request add column if not exists aadhar_no text;
alter table dist_firm_request add column if not exists ticket_hash text;
alter table dist_firm_request add column if not exists price_list_uid uuid;
alter table dist_firm_request add column if not exists credit_limit numeric(14, 2);
alter table dist_firm_request add column if not exists firm_class text;
create index if not exists dist_firm_request_ticket_ix on dist_firm_request (ticket_hash) where ticket_hash is not null;
