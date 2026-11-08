"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Package, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MasterItem {
  id: string;
  href: string;
  group: string;
  title: string;
  /** code, size ... under the title */
  sub: string;
  /** right column, top (bold) and bottom */
  right?: string;
  rightSub?: string;
  image?: string | null;
  /** initials shown when there is no image; null = a product icon */
  initials?: string | null;
  /** small marker after the title, e.g. "No retailer price" */
  flag?: string | null;
  /** extra words the search matches on */
  keywords?: string;
}

/**
 * The left side of a Pricing tab: rows grouped under quiet headings, a search box that filters as you type,
 * an optional filter select, and the picked row highlighted. Rows are links, so a picked row is in the URL.
 */
export function MasterList({ items, selected, placeholder, filters, footer }: {
  items: MasterItem[];
  selected: string | null;
  placeholder: string;
  filters?: { label: string; value: string; options: Array<{ value: string; label: string }> };
  footer?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [f, setF] = useState(filters?.value ?? "");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => (!f || i.group === f) && (!s || `${i.title} ${i.sub} ${i.keywords ?? ""}`.toLowerCase().includes(s)));
  }, [items, q, f]);
  const groups = useMemo(() => {
    const m = new Map<string, MasterItem[]>();
    for (const i of shown) m.set(i.group, [...(m.get(i.group) ?? []), i]);
    return [...m];
  }, [shown]);

  return (
    <>
      <div className="flex gap-2 border-b border-foreground/10 p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-foreground/60" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="h-9 w-full rounded-lg border border-foreground/15 bg-background pr-3 pl-8 text-[13px] text-foreground outline-none placeholder:text-foreground/55 focus:border-foreground/40"
          />
        </div>
        {filters ? (
          <select
            value={f}
            onChange={(e) => setF(e.target.value)}
            aria-label={filters.label}
            className="h-9 max-w-36 rounded-lg border border-foreground/15 bg-card px-2 text-[13px] text-foreground"
          >
            {filters.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {groups.map(([g, rows]) => (
          <div key={g}>
            <div className="flex justify-between px-4 pt-4 pb-1.5 text-[12px] font-medium text-foreground/75">
              <span>{g}</span><span className="tabular-nums">{rows.length}</span>
            </div>
            {rows.map((i) => {
              const on = i.id === selected;
              return (
                <Link
                  key={i.id}
                  href={i.href}
                  scroll={false}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 border-t border-foreground/[0.07] px-4 py-2.5 first-of-type:border-t-transparent",
                    on ? "bg-primary/[0.08]" : "hover:bg-foreground/[0.03]",
                  )}
                >
                  <Thumb image={i.image} initials={i.initials} />
                  <span className="min-w-0">
                    <span className={cn("block truncate text-[13px] text-foreground", on ? "font-semibold" : "font-medium")}>
                      {i.title}
                      {i.flag ? <span className="ml-1.5 inline-block size-1.5 rounded-full bg-warning align-middle" title={i.flag} aria-label={i.flag} /> : null}
                    </span>
                    <span className="tabular-nums block truncate text-[12px] text-foreground/75">{i.sub}</span>
                  </span>
                  {i.right !== undefined ? (
                    <span className="tabular-nums text-right">
                      <span className="block text-[13px] font-medium text-foreground">{i.right}</span>
                      {i.rightSub ? <span className="block text-[12px] text-foreground/75">{i.rightSub}</span> : null}
                    </span>
                  ) : <span />}
                </Link>
              );
            })}
          </div>
        ))}
        {shown.length === 0 ? <p className="px-4 py-10 text-center text-[13px] text-foreground/75">Nothing matches.</p> : null}
      </div>
      {footer ? <div className="border-t border-foreground/10 px-4 py-2.5 text-[12px] text-foreground/75">{footer}</div> : null}
    </>
  );
}

export function Thumb({ image, initials, size = 36 }: { image?: string | null; initials?: string | null; size?: number }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- product photos are served by our own route
    return <img src={image} alt="" loading="lazy" style={{ width: size, height: size }} className="rounded-lg border border-foreground/10 bg-background object-cover" />;
  }
  return (
    <span style={{ width: size, height: size }} className="flex items-center justify-center rounded-lg bg-foreground/[0.06] text-[11px] font-semibold text-foreground/70">
      {initials ? initials : <Package className="size-4" />}
    </span>
  );
}
