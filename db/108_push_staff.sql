-- Push notifications for the Gaia Salesforce app (employees and sales officers): a phone registers under its employee
-- sign-in (emp_login.id) as role 'staff'.
alter table push_device drop constraint if exists push_device_role_check;
alter table push_device add constraint push_device_role_check check (role in ('customer', 'rider', 'distributor', 'staff'));
