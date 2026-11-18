import Link from "next/link";
import { cn } from "@/lib/utils";

/*
 * Building blocks for the employee and customer profiles, laid out like a standard detail page (Stripe's customer
 * page, Tailwind UI description lists): a plain header with the name and actions, a row of key numbers, a wide main
 * column for activity and a right column with the record's details. Monochrome on purpose - foreground and muted
 * tones only, no accent colours, no decorative icons, no boxes.
 */

export const rs = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const rsShort = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L` : n >= 1e3 ? `₹${(n / 1e3).toFixed(1)}k` : rs(n);
export const day = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : null;
export const when = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
export const ago = (d: Date | string | null | undefined) => {
  if (!d) return null;
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : days < 365 ? `${Math.floor(days / 30)} months ago` : `${Math.floor(days / 365)} years ago`;
};

/** A plain text link: foreground, underlined on hover. */
export const linkCls = "text-foreground underline-offset-4 hover:underline";
export function A({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return <Link href={href} className={cn(linkCls, className)}>{children}</Link>;
}

const initialsOf = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

export function Avatar({ name, photo, size = 56, className }: { name: string; photo?: string | null; size?: number; className?: string }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- photo from our own route
    <img src={photo} alt="" style={{ width: size, height: size }} className={cn("shrink-0 rounded-full object-cover grayscale-[15%]", className)} />
  ) : (
    <span style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-foreground/70", className)}>
      {initialsOf(name)}
    </span>
  );
}

/** A small neutral label: status, type, channel. */
export function Tag({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-1.5 py-px text-[12px]",
      strong ? "border-foreground/80 text-foreground" : "border-border text-foreground/70")}>
      {children}
    </span>
  );
}

export interface Stat { label: string; value: string; note?: React.ReactNode }

/** The page header: back link, name, a line of tags and facts, actions on the right. */
export function Header({ back, name, photo, tags, line, actions }: {
  back: { href: string; label: string }; name: string; photo?: string | null; tags: React.ReactNode; line: React.ReactNode[]; actions?: React.ReactNode;
}) {
  const parts = line.filter(Boolean);
  return (
    <header className="space-y-5">
      <Link href={back.href} className="text-[13px] text-tertiary-foreground hover:text-foreground">← {back.label}</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={name} photo={photo} />
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[22px] font-semibold tracking-tight text-foreground">{name}</h1>
              {tags}
            </div>
            {parts.length ? (
              <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-tertiary-foreground">
                {parts.map((p, i) => <span key={i} className="inline-flex items-center gap-2">{i ? <span aria-hidden>·</span> : null}{p}</span>)}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Key numbers in a row, separated by hairlines. */
export function Stats({ items }: { items: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 border-y border-border sm:grid-cols-3 lg:grid-cols-5">
      {items.map((s, i) => (
        <div key={s.label} className={cn("min-w-0 py-4 pr-4", i > 0 && "lg:border-l lg:border-border lg:pl-5")}>
          <dt className="text-[12px] text-tertiary-foreground">{s.label}</dt>
          <dd className="mt-1 text-[20px] font-semibold leading-tight tracking-tight text-foreground tabular-nums">{s.value}</dd>
          {s.note ? <dd className="mt-0.5 truncate text-[12px] text-tertiary-foreground">{s.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** Main column (tabs and activity) beside the details column. */
export function Layout({ main, side }: { main: React.ReactNode; side: React.ReactNode }) {
  return (
    <div className="grid items-start gap-x-14 gap-y-10 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-10">{main}</div>
      <aside className="min-w-0 space-y-8 xl:border-l xl:border-border xl:pl-8">{side}</aside>
    </div>
  );
}

/** Tabs as links (?tab=), so each one is its own server render and can be linked to. */
export function Tabs({ base, on, tabs }: { base: string; on: string; tabs: Array<{ key: string; label: string; count?: number }> }) {
  return (
    <nav className="-mb-4 flex gap-6 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <Link key={t.key} href={t.key === tabs[0].key ? base : `${base}?tab=${t.key}`} scroll={false}
          className={cn("-mb-px shrink-0 border-b-2 pb-2.5 text-[13px]",
            on === t.key ? "border-foreground font-medium text-foreground" : "border-transparent text-tertiary-foreground hover:text-foreground")}>
          {t.label}{t.count ? <span className="ml-1.5 tabular-nums text-tertiary-foreground">{t.count.toLocaleString("en-IN")}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** A section: heading over a hairline, then its content. */
export function Card({ title, note, action, children, className }: {
  title: React.ReactNode; note?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <header className="flex items-end justify-between gap-3 border-b border-border pb-2">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
          {note ? <p className="mt-0.5 text-[12px] text-tertiary-foreground">{note}</p> : null}
        </div>
        {action}
      </header>
      <div className="pt-1">{children}</div>
    </section>
  );
}

const shown = <T extends [string, React.ReactNode, boolean?]>(rows: T[]) => rows.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false);

/** Label / value rows with hairlines (main column). Empty values are left out. */
export function Facts({ rows }: { rows: Array<[string, React.ReactNode, boolean?]> }) {
  const r = shown(rows);
  if (!r.length) return <Empty>Nothing recorded yet.</Empty>;
  return (
    <dl className="divide-y divide-border">
      {r.map(([label, value, mono]) => (
        <div key={label} className="grid grid-cols-[10rem_minmax(0,1fr)] gap-4 py-2.5 text-[13px]">
          <dt className="text-tertiary-foreground">{label}</dt>
          <dd className={cn("min-w-0 break-words text-foreground", mono && "font-mono text-[12px]")}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The details column: label above value, grouped under small headings. Empty values are left out. */
export function Details({ groups }: { groups: Array<{ title: string; rows: Array<[string, React.ReactNode, boolean?]> }> }) {
  return (
    <>
      {groups.map((g) => {
        const r = shown(g.rows);
        if (!r.length) return null;
        return (
          <section key={g.title}>
            <h2 className="mb-3 text-[12px] font-medium tracking-wide text-tertiary-foreground uppercase">{g.title}</h2>
            <dl className="space-y-3">
              {r.map(([label, value, mono]) => (
                <div key={label} className="text-[13px]">
                  <dt className="text-tertiary-foreground">{label}</dt>
                  <dd className={cn("mt-0.5 break-words text-foreground", mono && "font-mono text-[12px]")}>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </>
  );
}

/** One login or linked record as a row: what it is, its id, its state on the right. */
export function Account({ title, id, status, meta, href }: { title: string; id: React.ReactNode; status?: string; meta?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-foreground">{title}</div>
        <div className="truncate text-[13px] text-foreground/80">{id}</div>
        {meta ? <div className="mt-0.5 text-[12px] text-tertiary-foreground">{meta}</div> : null}
      </div>
      {status ? <span className="shrink-0 self-start pt-0.5 text-[12px] text-tertiary-foreground">{status}</span> : null}
    </>
  );
  const cls = "flex gap-4 border-b border-border py-3 last:border-b-0";
  return href ? <Link href={href} className={cn(cls, "group hover:[&_.font-medium]:underline")}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** Orders by month for the last 12 months: value as bars, the order count under each. */
export function MonthBars({ months }: { months: Array<{ month: string; orders: number; value: number }> }) {
  const max = Math.max(...months.map((m) => m.value), 1);
  const label = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short" });
  if (!months.some((m) => m.orders)) return <Empty>No orders in the last 12 months.</Empty>;
  return (
    <div className="flex h-40 gap-2 pt-4">
      {months.map((m) => (
        <div key={m.month} className="group flex min-w-0 flex-1 flex-col items-center gap-1" title={`${label(m.month)}: ${m.orders} order${m.orders === 1 ? "" : "s"} · ${rs(m.value)}`}>
          <span className="truncate text-[10px] tabular-nums text-tertiary-foreground opacity-0 group-hover:opacity-100">{m.value ? rsShort(m.value) : ""}</span>
          <div className="relative w-full flex-1">
            <div className={cn("absolute inset-x-0 bottom-0 rounded-sm", m.value ? "bg-foreground/75 group-hover:bg-foreground" : "bg-border")} style={{ height: m.value ? `${Math.max(3, (m.value / max) * 100)}%` : "1px" }} />
          </div>
          <span className="text-[11px] text-tertiary-foreground">{label(m.month)}</span>
        </div>
      ))}
    </div>
  );
}

/** Who is above: top first, down to this record. */
export function Chain({ above, self, empty }: { above: Array<{ href: string; name: string; sub: string | null }>; self: { name: string; sub: string | null }; empty: string }) {
  if (!above.length) return <Empty>{empty}</Empty>;
  return (
    <ol className="pt-2">
      {[...above.map((p) => ({ ...p, me: false })), { href: "", name: self.name, sub: self.sub, me: true }].map((p, i, all) => (
        <li key={p.href || "self"} className="relative flex gap-3 pb-4 last:pb-0">
          {i < all.length - 1 ? <span className="absolute top-3 bottom-0 left-[3.5px] w-px bg-border" /> : null}
          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", p.me ? "bg-foreground" : "border border-foreground/40 bg-background")} />
          <div className="min-w-0 text-[13px]">
            {p.me ? <span className="font-medium text-foreground">{p.name}</span> : <A href={p.href}>{p.name}</A>}
            {p.sub ? <span className="text-tertiary-foreground"> · {p.sub}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Counts per group with a thin bar (customers by channel, team by designation). */
export function Breakdown({ rows, total }: { rows: Array<{ label: string; n: number }>; total?: number }) {
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <ul className="space-y-3 pt-2">
      {rows.map((r) => (
        <li key={r.label} className="text-[13px]">
          <div className="flex justify-between gap-2">
            <span className="truncate text-foreground">{r.label}</span>
            <span className="tabular-nums text-foreground/80">{r.n.toLocaleString("en-IN")}{total ? <span className="ml-1.5 text-tertiary-foreground">{Math.round((r.n / total) * 100)}%</span> : null}</span>
          </div>
          <div className="mt-1.5 h-px bg-border"><div className="h-px bg-foreground/70" style={{ width: `${(r.n / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Edits made to the record (master_audit). */
export function History({ rows }: { rows: Array<{ at: Date; actor: string | null; action: string; summary: string | null }> }) {
  if (!rows.length) return <Empty>No changes recorded for this record yet.</Empty>;
  return (
    <ol className="divide-y divide-border">
      {rows.map((h, i) => (
        <li key={i} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:justify-between sm:gap-6">
          <div className="text-[13px] text-foreground">{h.summary || <span className="capitalize">{h.action}</span>}</div>
          <div className="shrink-0 text-[12px] text-tertiary-foreground">{h.actor ?? "system"} · {when(h.at)}</div>
        </li>
      ))}
    </ol>
  );
}

/** A plain table: hairline rows, grey header, numbers right-aligned. */
export function Table({ head, children, right = [] }: { head: string[]; children: React.ReactNode; right?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border text-left text-[12px] text-tertiary-foreground">
            {head.map((h, i) => <th key={h} className={cn("py-2 pr-4 font-normal whitespace-nowrap last:pr-0", right.includes(i) && "text-right")}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}
export const td = "py-2.5 pr-4 align-top last:pr-0";
export const tdNum = "py-2.5 pr-4 text-right tabular-nums whitespace-nowrap last:pr-0";

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-[13px] text-tertiary-foreground">{children}</p>;
}
