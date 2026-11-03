-- The staff app signs in with mobile number and PIN; an SMS code is only for setting a new PIN (Forgot PIN).
alter table emp_login add column pin_hash text;
