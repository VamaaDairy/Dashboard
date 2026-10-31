-- Gaia Salesforce app, for every employee (not just the sales officers): OTP sign-in, attendance with punch in/out,
-- leave, reimbursements, notices from the office, salary slips, requests to HR and a profile.
-- Identity is not new: an employee is an fp_staff row and signs in with the mobile number saved on it.
-- Someone whose number is not on file asks for an account (emp_signup); the office approves it and links the person.

create table emp_login (
  id          serial primary key,
  staff_uid   uuid not null unique references fp_staff(uid) on delete cascade,
  phone       text not null unique check (phone ~ '^[6-9][0-9]{9}$'),
  -- the session token the app holds after sign-in; a new sign-in replaces it
  token       text unique,
  active      boolean not null default true,
  device      text,
  last_login  timestamptz,
  created_at  timestamptz not null default now()
);

-- one live one-time code per number (hashed with the server secret, like the shop's)
create table emp_otp (
  phone          text primary key,
  code_hash      text not null,
  expires_at     timestamptz not null,
  attempts       int not null default 0,
  sent_at        timestamptz not null default now(),
  window_start   timestamptz not null default now(),
  sent_in_window int not null default 1
);

-- "Create account": a verified number that is not on any staff record yet
create table emp_signup (
  id           serial primary key,
  phone        text not null,
  name         text not null,
  email        text,
  department   text,
  note         text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  staff_uid    uuid references fp_staff(uid) on delete set null,
  remark       text,
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);
create unique index emp_signup_open_uq on emp_signup (phone) where status = 'pending';

-- what the employee keeps on their own profile (the rest is the staff record)
create table emp_profile (
  staff_uid        uuid primary key references fp_staff(uid) on delete cascade,
  blood_group      text,
  emergency_name   text,
  emergency_phone  text,
  emergency_rel    text,
  bank_name        text,
  account_no       text,
  ifsc             text,
  photo            text,
  updated_at       timestamptz not null default now()
);

-- attendance: one row per employee per day, punched on the phone
create table emp_attendance (
  id          serial primary key,
  staff_uid   uuid not null references fp_staff(uid) on delete cascade,
  work_date   date not null,
  in_at       timestamptz not null default now(),
  in_lat      double precision,
  in_lng      double precision,
  in_accuracy real,
  -- 'biometric' (fingerprint / face unlock on the phone), 'app' (no biometric on the phone), 'sales_day' (started the sales day)
  in_method   text not null default 'app' check (in_method in ('biometric', 'app', 'sales_day', 'office')),
  -- metres from the office / site the punch was checked against; null when no site applies
  in_site     text,
  in_distance integer,
  out_at      timestamptz,
  out_lat     double precision,
  out_lng     double precision,
  out_method  text check (out_method in ('biometric', 'app', 'sales_day', 'office')),
  remark      text,
  -- the office can correct a day
  corrected_by text,
  unique (staff_uid, work_date)
);
create index emp_attendance_date_ix on emp_attendance (work_date desc);

-- places a punch is checked against (plants, offices, depots); an employee with none punches from anywhere
create table emp_site (
  id        serial primary key,
  name      text not null,
  lat       double precision not null,
  lng       double precision not null,
  radius_m  integer not null default 300,
  active    boolean not null default true
);

create table emp_leave_type (
  id        serial primary key,
  code      text not null unique,
  name      text not null,
  per_year  numeric(5,1) not null default 0,
  paid      boolean not null default true,
  active    boolean not null default true
);
insert into emp_leave_type (code, name, per_year, paid) values
  ('CL', 'Casual leave', 12, true),
  ('SL', 'Sick leave', 8, true),
  ('EL', 'Earned leave', 15, true),
  ('LOP', 'Leave without pay', 0, false);

create table emp_leave (
  id          serial primary key,
  staff_uid   uuid not null references fp_staff(uid) on delete cascade,
  type_id     integer not null references emp_leave_type(id),
  from_date   date not null,
  to_date     date not null,
  half_day    boolean not null default false,
  days        numeric(5,1) not null,
  reason      text not null,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by  text,
  decided_at  timestamptz,
  remark      text,
  created_at  timestamptz not null default now(),
  check (to_date >= from_date)
);
create index emp_leave_staff_ix on emp_leave (staff_uid, from_date desc);
create index emp_leave_status_ix on emp_leave (status, created_at desc);

create table emp_claim (
  id           serial primary key,
  staff_uid    uuid not null references fp_staff(uid) on delete cascade,
  category     text not null check (category in ('travel', 'fuel', 'food', 'stay', 'mobile', 'client', 'other')),
  amount       numeric(12,2) not null check (amount > 0),
  spent_on     date not null,
  description  text not null,
  -- the photo of the bill, as a data: URL kept small by the app
  receipt      text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  approved_amount numeric(12,2),
  decided_by   text,
  decided_at   timestamptz,
  paid_at      timestamptz,
  remark       text,
  created_at   timestamptz not null default now()
);
create index emp_claim_staff_ix on emp_claim (staff_uid, created_at desc);
create index emp_claim_status_ix on emp_claim (status, created_at desc);

-- anything the office sends: to everyone, to one team, or to one person
create table emp_notice (
  id           serial primary key,
  title        text not null,
  body         text not null,
  kind         text not null default 'notice' check (kind in ('notice', 'urgent', 'policy', 'holiday', 'celebration')),
  -- 'all' | 'sales' | 'staff' (then staff_uid is the one person)
  audience     text not null default 'all' check (audience in ('all', 'sales', 'staff')),
  staff_uid    uuid references fp_staff(uid) on delete cascade,
  pinned       boolean not null default false,
  created_by   text,
  created_at   timestamptz not null default now(),
  check ((audience = 'staff') = (staff_uid is not null))
);
create index emp_notice_created_ix on emp_notice (created_at desc);

create table emp_notice_read (
  notice_id  integer not null references emp_notice(id) on delete cascade,
  staff_uid  uuid not null references fp_staff(uid) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (notice_id, staff_uid)
);

create table emp_payslip (
  id          serial primary key,
  staff_uid   uuid not null references fp_staff(uid) on delete cascade,
  -- first day of the month it is for
  month       date not null check (extract(day from month) = 1),
  days_in_month   numeric(4,1),
  days_paid       numeric(4,1),
  earnings    jsonb not null default '[]',
  deductions  jsonb not null default '[]',
  gross       numeric(12,2) not null,
  total_deductions numeric(12,2) not null default 0,
  net         numeric(12,2) not null,
  note        text,
  published   boolean not null default true,
  created_by  text,
  created_at  timestamptz not null default now(),
  unique (staff_uid, month)
);

-- a message from an employee to the office: HR query, document request, advance, ID card, grievance ...
create table emp_request (
  id          serial primary key,
  staff_uid   uuid not null references fp_staff(uid) on delete cascade,
  kind        text not null check (kind in ('hr', 'document', 'advance', 'id_card', 'it', 'grievance', 'other')),
  subject     text not null,
  message     text not null,
  status      text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  reply       text,
  replied_by  text,
  replied_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index emp_request_staff_ix on emp_request (staff_uid, created_at desc);
create index emp_request_status_ix on emp_request (status, created_at desc);
