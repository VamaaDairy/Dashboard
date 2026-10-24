import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AppLoginActions, CreateMissingLogins } from "@/components/masters/AppLogin";
import { OrderDecision } from "@/components/masters/OrderDecision";
import { LiveRefresh } from "@/components/masters/LiveRefresh";
import { RowActions } from "@/components/masters/RowActions";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { PAGE_SIZE } from "@/lib/masters/constants";
import { MASTERS } from "@/lib/masters/schemas";
import type { Col, SearchParams } from "@/lib/masters/types";
import { cellText } from "@/lib/masters/format";
import { readRequest } from "@/lib/masters/request";
import { listMaster } from "@/lib/masters/repository";

const field =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Cell({ col, value }: { col: Col; value: unknown }) {
  const text = cellText(col.kind, value);
  if (!text) return <span className="text-muted-foreground/50">-</span>;
  if (col.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- small thumbnails of stored photos
    return <img src={text} alt="" loading="lazy" className="h-10 w-10 rounded-md border border-border object-cover" />;
  }
  if (col.kind === "status") {
    const on = text === "Active";
    return (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          on ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"
        }`}
      >
        {text}
      </span>
    );
  }
  return <>{text}</>;
}

/** Read-only, searchable, filterable, paged list of one master (see src/lib/masters/defs.ts). */
export async function MasterPage({ slug, searchParams }: { slug: string; searchParams: Promise<SearchParams> }) {
  const def = MASTERS[slug];
  if (!def) notFound();
  const params = await searchParams;
  const req = readRequest(def, params);
  const data = await listMaster(def, req);
  // add / edit / deactivate / delete are shown only to people who may do them
  const me = def.entity || def.orderDecisions ? await userFromToken((await cookies()).get("session")?.value) : null;
  const canEdit = !!def.entity && !!me && atLeast(levelFor(me, `fp.${slug}`), "edit");
  // confirm / cancel on the order list
  const canDecide = !!def.orderDecisions && !!me && atLeast(levelFor(me, `fp.${slug}`), "edit");
  const page = Math.min(req.page, data.pages);

  const keep = (over: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    if (req.q) sp.set("q", req.q);
    for (const [k, v] of Object.entries(req.filters)) sp.set(`f_${k}`, v);
    if (req.from) sp.set("from", req.from);
    if (req.to) sp.set("to", req.to);
    for (const [k, v] of Object.entries(over)) {
      if (v === undefined || v === "") sp.delete(k);
      else sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : "";
  };
  // a report's own date window is not a filter the user "clears"
  const filtered = !!req.q || Object.keys(req.filters).length > 0;
  const from = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, data.total);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        {def.orderDecisions ? <LiveRefresh /> : null}
        <PageHeader
          icon={def.icon}
          title={def.title}
          subtitle={def.subtitle}
          actions={
            <>
            {canEdit && def.appLogin ? <CreateMissingLogins kind={def.appLogin} /> : null}
            {canEdit && def.appLogin === "distributor" ? <CreateMissingLogins kind="retailer" /> : null}
            {canEdit ? (
              <Link
                href={`/orders/${slug}/new`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-4 w-4" /> Add {def.entity!.noun}
              </Link>
            ) : null}
            <Link
              href={`/orders/${slug}/export${keep({})}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted"
            >
              <Download className="h-4 w-4" /> CSV
            </Link>
            </>
          }
        />

        {data.stats.length ? (
          <div className="flex flex-wrap gap-2">
            {data.stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border px-3 py-1.5">
                <div className="num text-base font-semibold leading-tight">{s.value.toLocaleString("en-IN")}</div>
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        ) : null}

        <form method="get" className="flex flex-wrap items-center gap-2">
          {def.dateRange ? (
            <>
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                From <input type="date" name="from" defaultValue={req.from} required className={field} />
              </label>
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                To <input type="date" name="to" defaultValue={req.to} required className={field} />
              </label>
            </>
          ) : null}
          <input name="q" defaultValue={req.q} placeholder="Search…" className={`${field} w-56`} autoComplete="off" />
          {(def.filters ?? []).map((f) => (
            <select key={f.key} name={`f_${f.key}`} defaultValue={req.filters[f.key] ?? ""} className={`${field} max-w-[11rem]`} aria-label={f.label}>
              <option value="">{f.label}: all</option>
              {(data.options[f.key] ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ))}
          <button type="submit" className="h-8 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90">
            Apply
          </button>
          {filtered ? (
            <Link href={`/orders/${slug}`} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
              Clear
            </Link>
          ) : null}
          <span className="num ml-auto text-sm text-muted-foreground">
            {data.total === 0 ? "No rows" : `${from.toLocaleString("en-IN")}-${to.toLocaleString("en-IN")} of ${data.total.toLocaleString("en-IN")}`}
          </span>
        </form>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                {def.cols.map((c) => (
                  <th key={c.key} className={`whitespace-nowrap px-3 py-2 font-semibold ${c.kind === "num" || c.kind === "money" ? "text-right" : ""}`}>
                    {c.label}
                  </th>
                ))}
                {canEdit || canDecide ? <th className="px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i} className="border-t border-border hover:bg-muted/40">
                  {def.cols.map((c) => (
                    <td
                      key={c.key}
                      className={`px-3 py-1.5 ${c.wide ? "min-w-64" : "whitespace-nowrap"} ${
                        c.kind === "num" || c.kind === "money" ? "num text-right tabular-nums" : c.kind === "mono" ? "font-mono text-xs" : ""
                      }`}
                    >
                      <Cell col={c} value={r[c.key]} />
                    </td>
                  ))}
                  {canDecide ? (
                    <td className="px-3 py-1.5">
                      {String(r.status ?? "").toLowerCase() === "pending" ? <OrderDecision id={String(r._id)} orderId={String(r.orderId ?? "")} /> : null}
                    </td>
                  ) : null}
                  {canEdit ? (
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-end">
                      {def.appLogin ? <AppLoginActions kind={def.appLogin} uid={String(r._id)} status={String(r.applogin ?? "No login")} /> : null}
                      <RowActions
                        slug={slug}
                        id={String(r._id)}
                        noun={def.entity!.noun}
                        label={String(r[def.cols.find((c) => c.kind !== "mono" && c.kind !== "status" && c.kind !== "num" && c.kind !== "money")?.key ?? def.cols[0].key] ?? "")}
                        on={def.entity!.active ? Boolean(r._on) : null}
                      />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={def.cols.length + (canEdit || canDecide ? 1 : 0)} className="px-3 py-10 text-center text-muted-foreground">
                    {filtered ? "Nothing matches these filters." : def.emptyNote ?? (def.dateRange ? "Nothing in this period." : "No data yet - load the exports with npm run db:import:masters.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {data.pages > 1 ? (
          <div className="flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link className="rounded-lg border border-input px-3 py-1.5 hover:bg-muted" href={keep({ page: page - 1 })}>
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="num text-muted-foreground">
              Page {page} of {data.pages}
            </span>
            {page < data.pages ? (
              <Link className="rounded-lg border border-input px-3 py-1.5 hover:bg-muted" href={keep({ page: page + 1 })}>
                Next
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
