-- POD entries are kept date-wise and carry the customer's name beside the invoice number.
-- Older rows take the date they were saved on.

alter table grn
  add column customer_name text,
  add column pod_date date;

update grn set pod_date = (created_at at time zone 'Asia/Kolkata')::date;

alter table grn
  alter column pod_date set not null,
  alter column pod_date set default ((now() at time zone 'Asia/Kolkata')::date);
create index grn_pod_date_ix on grn (pod_date desc);
