-- Access by department: each department carries the dashboard access its people get (same shape as app_user.access:
-- {"resource key": "view" | "edit"}). A user's access is their department's plus anything given to them personally
-- (the higher level wins). The department is the one set on the login, else the one of the employee it is linked to.

alter table department add column access jsonb not null default '{}'::jsonb;

alter table app_user add column department_id int references department (id) on delete set null;

-- logins with a typed-in department: the department of that name
update app_user u set department_id = d.id
  from department d
 where u.department_id is null and trim(coalesce(u.department, '')) <> ''
   and d.name_key = lower(regexp_replace(trim(u.department), '\s+', ' ', 'g'));
