import { listRows, refsFor } from "@/lib/orders/crud";
import { entityOf } from "@/lib/orders/entities";
import { canEdit } from "@/lib/orders/session";
import { EntityTable } from "./EntityTable";
import { Pager, Panel, SearchBox } from "./common";

/**
 * One entity's list: search + paging via the URL, the table and its add/edit
 * dialog. `access` is the section's access key; `tab` keeps the section's
 * active tab in the links.
 */
export async function EntityPanel({ entity, path, tab, access, sp, filterBy }: {
  entity: string; path: string; tab?: string; access: string; sp: Record<string, string>;
  /** Column keys to offer as dropdown filters (select columns only). */
  filterBy?: string[];
}) {
  const def = entityOf(entity);
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q ?? "";
  const filters: Record<string, string> = {};
  for (const k of filterBy ?? []) if (sp[k]) filters[k] = sp[k];
  const [data, refs, editable] = await Promise.all([
    listRows(entity, { q, page, filters }),
    refsFor([entity]),
    canEdit(access),
  ]);
  const base = { t: tab, ...filters };
  const selects = (filterBy ?? []).map((k) => def.cols.find((c) => c.key === k)!).filter(Boolean);

  return (
    <Panel
      title={`${def.title} (${data.total})`}
      actions={
        <SearchBox path={path} params={{ t: tab }} q={q} placeholder={def.search.length ? "Search" : "Filter below"}>
          {selects.map((c) => (
            <select key={c.key} name={c.key} defaultValue={sp[c.key] ?? ""} aria-label={c.label}
              className="h-8 rounded-lg border border-border bg-background px-2 text-[12px]">
              <option value="">All {c.label.toLowerCase()}</option>
              {c.options!.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
            </select>
          ))}
        </SearchBox>
      }
    >
      <EntityTable entity={entity} rows={data.rows} refs={refs} canEdit={editable} />
      <Pager path={path} params={{ ...base, q }} page={data.page} pageSize={data.pageSize} total={data.total} />
    </Panel>
  );
}
