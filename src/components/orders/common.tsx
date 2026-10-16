import Link from "next/link";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

const TONE: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700", approved: "bg-emerald-500/10 text-emerald-700",
  delivered: "bg-emerald-500/10 text-emerald-700", received: "bg-emerald-500/10 text-emerald-700",
  present: "bg-emerald-500/10 text-emerald-700", done: "bg-emerald-500/10 text-emerald-700",
  resolved: "bg-emerald-500/10 text-emerald-700", closed: "bg-muted text-muted-foreground",
  order: "bg-emerald-500/10 text-emerald-700",
  pending: "bg-amber-500/10 text-amber-700", created: "bg-amber-500/10 text-amber-700",
  draft: "bg-muted text-muted-foreground", open: "bg-amber-500/10 text-amber-700", medium: "bg-amber-500/10 text-amber-700",
  half: "bg-amber-500/10 text-amber-700", follow_up: "bg-amber-500/10 text-amber-700",
  ordered: "bg-sky-500/10 text-sky-700", invoiced: "bg-sky-500/10 text-sky-700", in_progress: "bg-sky-500/10 text-sky-700",
  leave: "bg-sky-500/10 text-sky-700", low: "bg-muted text-muted-foreground", no_order: "bg-muted text-muted-foreground",
  inactive: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive", rejected: "bg-destructive/10 text-destructive",
  absent: "bg-destructive/10 text-destructive", high: "bg-destructive/10 text-destructive",
};

export const label = (v: string) => v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function StatusChip({ value }: { value: string }) {
  return (
    <span className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium ${TONE[value] ?? "bg-muted text-muted-foreground"}`}>
      {label(value)}
    </span>
  );
}

export const inr = (n: number) =>
  "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** Builds /path?a=1&b=2 from the non-empty params. */
export function href(path: string, params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}

export function Pager({ path, params, page, pageSize, total }: {
  path: string; params: Record<string, string | undefined>; page: number; pageSize: number; total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = (p: number, text: string, off: boolean) =>
    off ? <span className="rounded-lg border border-border px-2.5 py-1 text-muted-foreground/50">{text}</span>
      : <Link href={href(path, { ...params, page: p === 1 ? undefined : p })} className="rounded-lg border border-border px-2.5 py-1 hover:bg-muted">{text}</Link>;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">
      <span>{total === 0 ? "No rows" : `${from}–${to} of ${total}`}</span>
      <div className="flex items-center gap-1.5">
        {link(page - 1, "Previous", page <= 1)}
        <span className="px-1">Page {page} of {pages}</span>
        {link(page + 1, "Next", page >= pages)}
      </div>
    </div>
  );
}

/** A GET form, so search is just a URL and the page stays a server component. */
export function SearchBox({ path, params, q, placeholder, children }: {
  path: string; params: Record<string, string | undefined>; q: string; placeholder: string; children?: ReactNode;
}) {
  return (
    <form action={path} method="get" className="flex flex-wrap items-center gap-2">
      {Object.entries(params).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input name="q" defaultValue={q} placeholder={placeholder}
          className="h-8 w-56 rounded-lg border border-border bg-background pl-8 pr-2 text-[13px] outline-none focus:border-primary" />
      </div>
      {children}
      <button type="submit" className="h-8 rounded-lg border border-border bg-white px-3 text-[12px] font-medium hover:bg-muted">Search</button>
    </form>
  );
}

export function Panel({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</div>
      {hint && <div className="mt-0.5 text-[12px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export const TH ="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
export const TD = "px-4 py-2";
