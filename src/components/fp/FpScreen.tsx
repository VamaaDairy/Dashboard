import Link from "next/link";
import { Download } from "lucide-react";
import { Pager, Panel } from "@/components/orders/common";
import { SectionShell } from "@/components/orders/SectionShell";
import { distinctValues, runGrid } from "@/lib/fp/grid";
import { formFields, optionsForFields } from "@/lib/fp/crud";
import { fpHref } from "@/lib/fp/model";
import type { Screen } from "@/lib/fp/screens";
import { canEdit } from "@/lib/orders/session";
import { FpGrid, type GridCol } from "./FpGrid";
import { Table2 } from "lucide-react";

const FIELD = "h-8 rounded-lg border border-border bg-background px-2 text-[13px] outline-none focus:border-primary";

/** A route's list screen: its filters, grid, paging, and add / edit when the spec has them. */
export async function FpScreen({ screen, sp }: { screen: Screen; sp: Record<string, string> }) {
  const r = screen.route;
  const path = fpHref(r);
  const page = Math.max(1, Number(sp.page) || 1);
  const values: Record<string, string> = {};
  for (const f of screen.filters) if (sp[f.key]) values[f.key] = sp[f.key];
  const dir = sp.dir === "desc" ? "desc" : "asc";

  const form = screen.table && screen.editable ? formFields(screen.table) : [];
  const [data, refs, editable, statusOpts] = await Promise.all([
    runGrid(screen, { q: sp.q, page, sort: sp.sort, dir, values }),
    optionsForFields(form),
    canEdit(`fp.${r.key}`),
    Promise.all(screen.filters.filter((f) => f.kind === "status").map(async (f) => {
      const col = screen.cols.find((c) => c.key === f.colKey);
      return [f.key, col ? await distinctValues(screen, col) : []] as const;
    })),
  ]);
  const opts = Object.fromEntries(statusOpts);

  const keep = { ...values, q: sp.q, sort: sp.sort, dir: sp.dir };
  const sortHref = (key: string) => {
    const next = sp.sort === key && sp.dir !== "desc" ? "desc" : "asc";
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, sort: key, dir: next })) if (v) params.set(k, String(v));
    return `${path}?${params.toString()}`;
  };
  const cols: GridCol[] = screen.cols.map((c) => ({ key: c.key, label: c.label, sql: c.sql, sortHref: sortHref(c.key), sorted: sp.sort === c.key ? dir : null }));
  const exportHref = `/api/fp/export?route=${encodeURIComponent(r.key)}&${new URLSearchParams(Object.fromEntries(Object.entries({ ...values, q: sp.q ?? "" }).filter(([, v]) => v))).toString()}`;

  return (
    <SectionShell icon={Table2} title={r.title || r.key} subtitle={r.menu && !r.menu.startsWith("not in sidebar") ? r.menu.replace(/›/g, "/") : `${screen.table?.entity ?? ""} records`}
      actions={<a href={exportHref} download className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-[12px] font-medium hover:bg-muted"><Download className="h-3.5 w-3.5" /> Export CSV</a>}>
      <Panel
        title={`${data.total.toLocaleString("en-IN")} record${data.total === 1 ? "" : "s"}`}
        actions={
          <form action={path} method="get" className="flex flex-wrap items-center gap-2">
            {screen.filters.map((f) => (
              <label key={f.key} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                {f.kind === "from" || f.kind === "to" || f.kind === "day"
                  ? <>{f.label}<input type="date" name={f.key} defaultValue={values[f.key] ?? ""} className={FIELD} /></>
                  : f.kind === "status"
                    ? <select name={f.key} defaultValue={values[f.key] ?? ""} className={FIELD} aria-label={f.label}><option value="">{f.label}: all</option>{(opts[f.key] ?? []).map((o) => <option key={o} value={o}>{o}</option>)}</select>
                    : <input name={f.key} defaultValue={values[f.key] ?? ""} placeholder={f.label} className={`${FIELD} w-36`} />}
              </label>
            ))}
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Search" className={`${FIELD} w-40`} />
            <button className="h-8 rounded-lg border border-border bg-white px-3 text-[12px] font-medium hover:bg-muted">Apply</button>
            {(Object.keys(values).length > 0 || sp.q) && <Link href={path} className="text-[12px] text-muted-foreground hover:text-foreground">Reset</Link>}
          </form>
        }
      >
        {screen.cols.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] text-muted-foreground">This screen has no list columns.</p>
        ) : (
          <>
            <FpGrid routeKey={r.key} cols={cols} rows={data.rows} form={form} refs={refs} editable={screen.editable} canEdit={editable} title={r.title || r.key} />
            <Pager path={path} params={{ ...Object.fromEntries(Object.entries(keep).map(([k, v]) => [k, v ?? undefined])) }} page={data.page} pageSize={data.pageSize} total={data.total} />
          </>
        )}
      </Panel>
    </SectionShell>
  );
}
