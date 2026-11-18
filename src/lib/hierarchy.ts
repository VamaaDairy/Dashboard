import "server-only";
import { query } from "@/lib/db";

/**
 * The two hierarchy charts on the Admin > Hierarchy page, as flat lists of nodes that point at their parent:
 * - employees: who reports to whom (fp_staff.reporting_manager_uid), from the Employee Master;
 * - customers: who serves whom (fp_firm.parent_firm_uid), from the Customer Master: Gaia > super stockist >
 *   distributor > retailer.
 * The chart (components/hierarchy/OrgChart) builds the tree; a parent that is missing (or not shown) makes a node a root.
 */
export interface ChartNode {
  id: string;
  parent: string | null;
  name: string;
  /** Designation / customer type, shown under the name. */
  sub: string | null;
  /** Department and group / city, the small grey line. */
  meta: string | null;
  /** A short tag: the employee's group or the customer's channel. */
  tag: string | null;
  href: string;
  active: boolean;
}

const FULL_NAME = (a: string) => `nullif(trim(${a}.first_name || ' ' || coalesce(${a}.last_name, '')), '')`;

export function employeeNodes(withInactive: boolean): Promise<ChartNode[]> {
  return query<ChartNode>(
    `select s.uid::text as id, s.reporting_manager_uid::text as parent,
            coalesce(${FULL_NAME("s")}, s.employee_code, 'Unnamed') as name,
            d.designation as sub,
            nullif(concat_ws(' · ', coalesce(dep.name, nullif(trim(d.department), '')), s.employee_code), '') as meta,
            initcap(m.wing) as tag,
            '/employees/staff/' || s.uid as href,
            coalesce(s.active, 1) = 1 as active
       from fp_staff s
       left join emp_master m on m.staff_uid = s.uid
       left join fp_designation d on d.uid = s.designation_uid
       left join department dep on dep.id = m.department_id
      where $1::boolean or coalesce(s.active, 1) = 1
      order by ${FULL_NAME("s")}`,
    [withInactive],
  );
}

const CHANNEL_LABEL = `case upper(ch.channel_code) when 'SS' then 'Super stockist' when 'DB' then 'Distributor' when 'MFS' then 'MFS'
  when 'IT' then 'Institution' when 'PT' then 'Parlour' when 'RT' then 'Retailer' when 'CMP' then 'Company' else ch.channel end`;

export function customerNodes(withInactive: boolean): Promise<ChartNode[]> {
  return query<ChartNode>(
    `select f.uid::text as id, f.parent_firm_uid::text as parent, f.name,
            nullif(trim(f.firm_type), '') as sub,
            nullif(concat_ws(' · ', f.firm_code, f.city), '') as meta,
            ${CHANNEL_LABEL} as tag,
            '/customers/firm/' || f.uid as href,
            f.active = 1 as active
       from fp_firm f
       left join fp_channel ch on ch.uid = f.channel_uid
      where $1::boolean or f.active = 1
      order by f.name`,
    [withInactive],
  );
}
