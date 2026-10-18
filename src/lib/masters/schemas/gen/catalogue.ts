import { BookOpen } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Digital Catalogue (Recibo route `catalogue`).
 *
 * Spec columns: 11; built: 11.
 */
export const catalogue: MasterDef = {
  slug: "catalogue",
  title: "Digital Catalogue",
  subtitle: "Catalogue documents shared with the field force.",
  icon: BookOpen,
  from: `fp_catalogue m`,
  cols: [
    { key: "no", label: "No", expr: "row_number() over (order by m.position nulls last, m.name)", kind: "num" },
    { key: "name", label: "Name", expr: "m.name" },
    { key: "description", label: "Description", expr: "m.description" },
    { key: "position", label: "Position", expr: "m.position", kind: "num" },
    { key: "status", label: "Status", expr: "case when m.status = 1 then 'Active' else 'Inactive' end", kind: "status" },
    { key: "type", label: "Type", expr: "m.type", kind: "num" },
    { key: "filename", label: "fileName", expr: "m.file_name" },
    { key: "regions", label: "Regions", expr: "nullif(m.regions::text, 'null')" },
    { key: "states", label: "States", expr: "nullif(m.states::text, 'null')" },
    { key: "divisions", label: "Divisions", expr: "nullif(m.divisions::text, 'null')" },
    { key: "designations", label: "Designations", expr: "nullif(m.designations::text, 'null')" },
  ],
  search: ["m.name"],
  filters: [
    { key: "status", label: "Status", expr: "m.status" },
    { key: "type", label: "Type", expr: "m.type" },
  ],
  order: "m.position nulls last, m.name",
};
