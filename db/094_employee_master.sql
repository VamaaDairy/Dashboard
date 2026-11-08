-- Employee Master: every employee (the staff list, fp_staff) in one of three groups - Salesforce, Plant, Office -
-- with a department, and each dashboard login linked to the employee it belongs to, so one person has one profile.
-- Departments also carry the dashboard access their people get (used from migration 095 on).

create table department (
  id         serial primary key,
  name       text not null,
  name_key   text generated always as (lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) stored unique,
  -- the group the department belongs to; null = used by more than one
  wing       text check (wing in ('salesforce', 'plant', 'office')),
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

create table emp_master (
  staff_uid     uuid primary key references fp_staff (uid) on delete cascade,
  -- null = not placed yet (the list then guesses Salesforce from a sales designation)
  wing          text check (wing in ('salesforce', 'plant', 'office')),
  department_id int references department (id) on delete set null,
  -- the dashboard login that is this employee
  app_user_id   uuid unique references app_user (id) on delete set null,
  updated_at    timestamptz not null default now(),
  updated_by    text
);
create index emp_master_wing_ix on emp_master (wing);
create index emp_master_department_ix on emp_master (department_id);

-- departments: the ones already named on designations, dashboard users and sign-up requests, plus the usual ones
insert into department (name)
select distinct trim(x) from (
  select department as x from fp_designation
  union select department from app_user
  union select department from emp_signup
) d where trim(coalesce(x, '')) <> ''
on conflict (name_key) do nothing;

insert into department (name, wing, sort) values
  ('Sales', 'salesforce', 10), ('Production', 'plant', 20), ('Quality', 'plant', 21), ('Store', 'plant', 22),
  ('Procurement', 'plant', 23), ('Dispatch', 'plant', 24), ('Maintenance', 'plant', 25),
  ('Accounts', 'office', 30), ('HR', 'office', 31), ('Admin', 'office', 32), ('Management', 'office', 33)
on conflict (name_key) do nothing;

update department set wing = 'salesforce' where wing is null and name ~* '(sales|marketing|field)';

-- every employee gets a row: Salesforce when the designation is a sales one, otherwise not placed yet
insert into emp_master (staff_uid, wing, department_id)
select s.uid,
       case when coalesce(d.sales, 0) = 1
              or d.designation ~* '(sales|\mso\M|\maso\M|\masm\M|\mrsm\M|\mzsm\M|\mtsi\M|\mtse\M|promoter|merchandis|territory|field)'
            then 'salesforce' end,
       (select dp.id from department dp where dp.name_key = lower(regexp_replace(trim(d.department), '\s+', ' ', 'g')))
  from fp_staff s left join fp_designation d on d.uid = s.designation_uid
on conflict (staff_uid) do nothing;

-- dashboard logins that are an employee: same mobile, or else same email (each login to one employee only)
update emp_master m set app_user_id = x.user_id
  from (
    select distinct on (u.id) u.id as user_id, s.uid as staff_uid
      from app_user u
      join fp_staff s on (u.mobile is not null and right(regexp_replace(coalesce(s.phone, ''), '\D', '', 'g'), 10) = u.mobile)
                      or (s.email is not null and lower(trim(s.email)) = lower(u.email))
     order by u.id, (u.mobile is not null and right(regexp_replace(coalesce(s.phone, ''), '\D', '', 'g'), 10) = u.mobile) desc, s.active desc nulls last
  ) x
 where m.staff_uid = x.staff_uid
   and not exists (select 1 from emp_master o where o.app_user_id = x.user_id);
