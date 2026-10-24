-- Retailer app logins (Gaia app, "Retailer sign in"): a retailer (an fp_firm in the RT channel) signs in with
-- phone + PIN like a distributor and orders for its own firm at its channel's price.
alter table dist_login drop constraint dist_login_kind_check;
alter table dist_login add constraint dist_login_kind_check check (kind in ('distributor', 'salesman', 'retailer'));
alter table dist_login drop constraint dist_login_check;
alter table dist_login add constraint dist_login_check check (
     (kind in ('distributor', 'retailer') and firm_uid is not null and staff_uid is null)
  or (kind = 'salesman' and staff_uid is not null and firm_uid is null));
