/**
 * SQL behind the dropdowns of the add / edit forms. `ref` queries return
 * `value, label`; `suggest` queries return `value`. Inactive rows stay in the
 * lists (marked) so a record that points at one still shows it.
 */
const staffLabel = `trim(first_name || ' ' || coalesce(last_name, '')) || coalesce(' (' || employee_code || ')', '') || case when active = 1 then '' else ' - inactive' end`;

export const REF_CHANNELS = `select uid::text as value, channel as label from fp_channel order by level, channel`;
export const REF_STATES = `select state as value, state as label from fp_state order by state`;
export const REF_DESIGNATIONS = `select uid::text as value, designation as label from fp_designation order by designation`;
export const REF_STAFF = `select uid::text as value, ${staffLabel} as label from fp_staff order by active desc, first_name`;
/** anyone who can serve customers: company, super stockists and distributors */
export const REF_PARENT_FIRMS = `
  select f.uid::text as value, f.name || ' (' || f.firm_code || ')' || case when f.active = 1 then '' else ' - inactive' end as label
  from fp_firm f join fp_channel c on c.uid = f.channel_uid
  where c.level <= 3 order by f.active desc, f.name`;
export const REF_BEATS = `select uid::text as value, beat_name || coalesce(' [' || beat_code || ']', '') as label from fp_beat order by status desc, beat_name`;
export const REF_TAX = `select uid::text as value, tax_code || ' - ' || category_name as label from fp_tax_configuration order by tax_code`;
export const REF_PRODUCTS = `select uid::text as value, sku_name || ' (' || sku_code || ')' as label from fp_product order by active desc, sku_name`;
export const REF_SLABS = `select uid::text as value, name as label from fp_slab order by name`;

export const SUGGEST_CATEGORY = `select category as value from fp_category order by 1`;
export const SUGGEST_SUB_CATEGORY = `select sub_category as value from fp_sub_category order by 1`;
export const SUGGEST_BRAND = `select distinct trim(brand) as value from fp_product where trim(brand) <> '' order by 1`;
export const SUGGEST_UNIT = `select distinct primary_unit #>> '{}' as value from fp_product where primary_unit is not null order by 1`;
export const SUGGEST_CUSTOMER_TYPE = `select distinct firm_type as value from fp_firm where firm_type is not null order by 1`;
export const SUGGEST_CUSTOMER_CLASS = `select distinct firm_class as value from fp_firm where firm_class is not null order by 1`;
