"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Minus, Plus, Search } from "lucide-react";
import { Pill } from "@/components/cn/ui";
import type { ChartNode } from "@/lib/hierarchy";
import { cn } from "@/lib/utils";

/**
 * A top-down hierarchy chart built from flat nodes that point at their parent. One made-up root (the company) sits on
 * top; nodes without a (shown) parent hang under it, sorted into the given buckets so a long tail of unlinked people
 * or shops doesn't make the chart thousands of boxes wide. Children that have no children themselves are stacked in a
 * column under their parent for the same reason. Search keeps the matches and the chain above them, opened.
 */
interface Tree { node: ChartNode; kids: Tree[]; size: number }
interface Bucket { id: string; label: string; test: (n: ChartNode, hasKids: boolean) => boolean }
export type ChartKind = "employees" | "customers";

const BUCKETS: Record<ChartKind, Bucket[]> = {
  employees: [
    { id: "heads", label: "Heads - report to no one", test: (_, hasKids) => hasKids },
    { id: "no-manager", label: "No reporting manager set", test: () => true },
  ],
  customers: [
    { id: "company", label: "Company account", test: (n) => n.tag === "Company" },
    { id: "ss", label: "Super stockists", test: (n) => n.tag === "Super stockist" },
    { id: "db", label: "Distributors", test: (n) => n.tag === "Distributor" },
    { id: "mfs", label: "MFS", test: (n) => n.tag === "MFS" },
    { id: "it", label: "Institutions", test: (n) => n.tag === "Institution" },
    { id: "pt", label: "Parlours", test: (n) => n.tag === "Parlour" },
    { id: "rt", label: "Retailers served by Gaia", test: (n) => n.tag === "Retailer" },
  ],
};

const LEAF_LIMIT = 25;

function build(nodes: ChartNode[], rootLabel: string, buckets: Bucket[]): Tree {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const kidsOf = new Map<string, ChartNode[]>();
  const roots: ChartNode[] = [];
  // a parent that is missing, the node itself, or part of a loop makes the node a root
  const loops = (n: ChartNode) => {
    const seen = new Set([n.id]);
    for (let p = n.parent; p; p = byId.get(p)?.parent ?? null) {
      if (seen.has(p)) return true;
      seen.add(p);
    }
    return false;
  };
  for (const n of nodes) {
    if (n.parent && n.parent !== n.id && byId.has(n.parent) && !loops(n)) kidsOf.set(n.parent, [...(kidsOf.get(n.parent) ?? []), n]);
    else roots.push(n);
  }
  const grow = (n: ChartNode): Tree => {
    const kids = (kidsOf.get(n.id) ?? []).map(grow).sort((a, b) => b.size - a.size || a.node.name.localeCompare(b.node.name));
    return { node: n, kids, size: 1 + kids.reduce((s, k) => s + k.size, 0) };
  };
  const top = roots.map(grow);
  const group = (id: string, label: string, kids: Tree[]): Tree => ({
    node: { id, parent: null, name: label, sub: null, meta: null, tag: null, href: "", active: true },
    kids, size: 1 + kids.reduce((s, k) => s + k.size, 0),
  });
  const left = new Set(top);
  const grouped = buckets.map((b) => {
    const kids = top.filter((t) => left.has(t) && b.test(t.node, t.kids.length > 0));
    kids.forEach((k) => left.delete(k));
    return group(`bucket:${b.id}`, b.label, kids.sort((a, z) => z.size - a.size || a.node.name.localeCompare(z.node.name)));
  }).filter((g) => g.kids.length);
  const rest = [...left];
  return group("root", rootLabel, [...grouped, ...(rest.length ? [group("bucket:other", "Others", rest)] : [])]);
}

/** The tree cut down to the nodes matching q and everything above them. */
function prune(t: Tree, q: string): Tree | null {
  const hit = [t.node.name, t.node.sub, t.node.meta].some((s) => s?.toLowerCase().includes(q));
  const kids = t.kids.map((k) => prune(k, q)).filter((k): k is Tree => !!k);
  if (!hit && !kids.length && t.node.id !== "root") return null;
  return { ...t, kids: hit && !t.node.id.startsWith("bucket:") && t.node.id !== "root" ? t.kids : kids };
}

export function OrgChart({ kind, nodes, rootLabel, openDepth = 1, unit }: { kind: ChartKind; nodes: ChartNode[]; rootLabel: string; openDepth?: number; unit: string }) {
  const full = useMemo(() => build(nodes, rootLabel, BUCKETS[kind]), [nodes, rootLabel, kind]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string> | "all">(() => new Set());
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const needle = q.trim().toLowerCase();
  const tree = useMemo(() => (needle.length >= 2 ? prune(full, needle) : full), [full, needle]);
  const searching = needle.length >= 2;

  const isOpen = (id: string, depth: number) => {
    if (closed.has(id)) return false;
    if (searching || open === "all") return true;
    return depth < openDepth || open.has(id);
  };
  const toggle = (id: string, depth: number) => {
    if (isOpen(id, depth)) {
      setClosed((c) => new Set(c).add(id));
    } else {
      setClosed((c) => { const n = new Set(c); n.delete(id); return n; });
      setOpen((o) => (o === "all" ? o : new Set(o).add(id)));
    }
  };

  const found = searching && tree ? tree.size - 1 : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a name, code, designation, city"
            className="h-8 w-full rounded-lg border border-input bg-transparent pr-3 pl-8 text-sm focus:border-primary focus:outline-none" />
        </div>
        <button type="button" onClick={() => { setOpen("all"); setClosed(new Set()); }} className="inline-flex h-8 items-center gap-1 rounded-lg border border-input px-3 text-sm hover:bg-muted"><Plus className="size-3.5" /> Open all</button>
        <button type="button" onClick={() => { setOpen(new Set()); setClosed(new Set()); }} className="inline-flex h-8 items-center gap-1 rounded-lg border border-input px-3 text-sm hover:bg-muted"><Minus className="size-3.5" /> Close all</button>
        <span className="text-[12px] text-muted-foreground">
          {found !== null ? `${found.toLocaleString("en-IN")} shown for "${q.trim()}"` : `${nodes.length.toLocaleString("en-IN")} ${unit}`}
        </span>
      </div>
      <div className="overflow-auto rounded-lg border border-border bg-muted/20 p-6">
        {tree && tree.kids.length ? (
          <div className="flex min-w-max justify-center">
            <Branch t={tree} depth={0} isOpen={isOpen} toggle={toggle} />
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">{searching ? "Nothing matches." : `No ${unit} yet.`}</p>
        )}
      </div>
    </div>
  );
}

type BranchProps = { t: Tree; depth: number; isOpen: (id: string, depth: number) => boolean; toggle: (id: string, depth: number) => void };

function Branch({ t, depth, isOpen, toggle }: BranchProps) {
  const opened = t.kids.length > 0 && isOpen(t.node.id, depth);
  const allLeaves = t.kids.every((k) => k.kids.length === 0);
  return (
    <div className="flex flex-col items-center">
      <Box t={t} opened={opened} onToggle={() => toggle(t.node.id, depth)} />
      {opened ? (
        <>
          <span className="h-4 w-px bg-border" />
          {allLeaves ? <LeafColumn kids={t.kids} /> : (
            <div className="flex">
              {t.kids.map((k, i) => (
                <div key={k.node.id} className="relative flex flex-col items-center px-2 pt-4">
                  {/* the line across to the siblings, and down to this box */}
                  {t.kids.length > 1 ? (
                    <span className={cn("absolute top-0 h-px bg-border", i === 0 ? "left-1/2 right-0" : i === t.kids.length - 1 ? "left-0 right-1/2" : "inset-x-0")} />
                  ) : null}
                  <span className="absolute top-0 left-1/2 h-4 w-px bg-border" />
                  <Branch t={k} depth={depth + 1} isOpen={isOpen} toggle={toggle} />
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function LeafColumn({ kids }: { kids: Tree[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? kids : kids.slice(0, LEAF_LIMIT);
  return (
    <div className="flex flex-col items-stretch gap-1.5 border-l-2 border-border pl-3">
      {shown.map((k) => <Box key={k.node.id} t={k} opened={false} onToggle={() => {}} compact />)}
      {kids.length > LEAF_LIMIT ? (
        <button type="button" onClick={() => setAll(!all)} className="rounded-md px-2 py-1 text-left text-[12px] font-medium text-primary hover:bg-muted">
          {all ? "Show fewer" : `Show all ${kids.length.toLocaleString("en-IN")}`}
        </button>
      ) : null}
    </div>
  );
}

function Box({ t, opened, onToggle, compact }: { t: Tree; opened: boolean; onToggle: () => void; compact?: boolean }) {
  const n = t.node;
  const group = !n.href;
  return (
    <div className={cn(
      "w-52 rounded-lg border bg-background text-left shadow-xs",
      group ? "border-primary/40 bg-primary/5" : "border-border",
      !n.active && "opacity-60",
      compact ? "px-2.5 py-1.5" : "px-3 py-2",
    )}>
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          {group ? <div className="truncate text-sm font-semibold">{n.name}</div> : (
            <Link href={n.href} className="block truncate text-sm font-medium text-primary hover:underline" title={n.name}>{n.name}</Link>
          )}
          {n.sub ? <div className="truncate text-[12px] text-foreground/80" title={n.sub}>{n.sub}</div> : null}
          {n.meta && !compact ? <div className="truncate text-[11px] text-muted-foreground" title={n.meta}>{n.meta}</div> : null}
        </div>
        {n.tag ? <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px]">{n.tag}</span> : null}
      </div>
      {!n.active || t.kids.length ? (
        <div className="mt-1 flex items-center gap-1.5">
          {!n.active ? <Pill>Inactive</Pill> : null}
          {t.kids.length ? (
            <button type="button" onClick={onToggle} className="ml-auto inline-flex items-center gap-0.5 rounded px-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              {opened ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              {t.kids.length.toLocaleString("en-IN")} under{t.size - 1 > t.kids.length ? ` · ${(t.size - 1).toLocaleString("en-IN")} in all` : ""}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
