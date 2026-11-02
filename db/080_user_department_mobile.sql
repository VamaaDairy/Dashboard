-- Users get a department (typed in by the owner) and a mobile number. Forgot-password sends its one-time
-- code by SMS to that number (replacing the recovery email), so the number is unique per account.
alter table app_user add column if not exists department text;
alter table app_user add column if not exists mobile text;
create unique index if not exists app_user_mobile_uq on app_user (mobile) where mobile is not null;
