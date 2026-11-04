-- Each app list's categories can have their own icon (the round tiles on the app's home and Products pages),
-- uploaded in Product Master. No icon = the app shows the category's first product photo, as before.
alter table app_category add column if not exists icon_data bytea;
alter table app_category add column if not exists icon_mime text;
