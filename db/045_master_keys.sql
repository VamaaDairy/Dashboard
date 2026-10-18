-- Natural keys for the master data loaded from the Footprints exports
-- (db/import-masters.ts). Rows are matched on their uid, so these only guard
-- against a second row for the same state / city / customer code / SKU.
-- Route codes and employee codes are deliberately NOT unique: the export
-- reuses a route code for several routes, and one employee code appears twice.

create unique index fp_state_state_uq        on fp_state (state);
create unique index fp_city_state_name_uq    on fp_city (city_state, city_name);
create unique index fp_channel_code_uq       on fp_channel (channel_code);
create unique index fp_designation_code_uq   on fp_designation (designation_code);
create unique index fp_division_name_uq      on fp_division (name);
create unique index fp_category_name_uq      on fp_category (category);
create unique index fp_sub_category_name_uq  on fp_sub_category (sub_category);
create unique index fp_tax_configuration_code_uq on fp_tax_configuration (tax_code);
create unique index fp_product_sku_uq        on fp_product (sku_code);
create unique index fp_firm_code_uq          on fp_firm (firm_code);
create unique index fp_slab_name_uq          on fp_slab (name);

create index fp_firm_state_ix   on fp_firm (state_state);
create index fp_firm_city_ix    on fp_firm (city);
create index fp_firm_active_ix  on fp_firm (active);
create index fp_staff_code_ix   on fp_staff (employee_code);
