-- Every retailer is served by a distributor (or super stockist): the one it orders from. The retailer picks it when
-- it signs up in the Gaia Distributors app; a sales officer picks it when adding a retailer in the Sales app. Kept on
-- the request until it becomes the customer's "Served by" (fp_firm.parent_firm_uid).
alter table dist_firm_request add column if not exists parent_firm_uid uuid references fp_firm (uid) on delete set null;
