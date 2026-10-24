-- Party price lists: the portal's price slabs (fp_slab / fp_slab_rate / fp_slab_firm_mapping) are what the
-- dashboard's Price list page edits and the Gaia app reads. `grp` keeps the rate list's grouping
-- (MFS, Institution, Admin, OD ...) so the page can show the lists in groups.
alter table fp_slab add column if not exists grp text;

create index if not exists fp_slab_firm_mapping_firm_ix on fp_slab_firm_mapping (firm_uid);
create index if not exists fp_slab_rate_slab_product_ix on fp_slab_rate (slab_uid, product_uid);
