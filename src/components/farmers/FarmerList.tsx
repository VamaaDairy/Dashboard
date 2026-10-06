"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Empty, Section, THead, Th } from "@/components/tanks/ui";
import { formatNumber } from "@/lib/format";
import { perLitreToPerKg } from "@/lib/units";
import { shortDate } from "./charts";
import { TransporterPicker } from "./TransporterPicker";
import type { FarmerSummary } from "@/lib/farmers/data";

export interface FarmerListRow {
  center: string;
  code: string;
  name: string;
  mobile: string;
  milk_type: string;
  recent: FarmerSummary | undefined;   // last 30 days
  last_day: string | null;             // last day ever supplied
  transporter_id: string | undefined;
  transport: { cost: number; litres: number } | undefined;   // their share, last 30 days
}

type SortKey = "code" | "name" | "litres" | "fat" | "snf" | "last";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "litres", label: "Most milk" },
  { key: "code", label: "Code" },
  { key: "name", label: "Name" },
  { key: "fat", label: "Highest fat" },
  { key: "snf", label: "Highest SNF" },
  { key: "last", label: "Last supplied" },
];

export function FarmerList({
  farmers, from, to, transporters, kgPerLitre, centers,
}: {
  farmers: FarmerListRow[];
  from: string;
  to: string;
  transporters: { id: string; name: string }[];
  kgPerLitre: number;
  centers: { center: string; name: string; kind: "village" | "tanker" }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("litres");
  const [by, setBy] = useState("");   // "" all, "none" unassigned, or a transporter id
  const [centre, setCentre] = useState("");   // "" every centre
  const centreName = (c: string) => centers.find((x) => x.center === c)?.name ?? c;
  const href = (f: FarmerListRow) => `/farmers/${encodeURIComponent(f.code)}?center=${encodeURIComponent(f.center)}`;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = farmers
      .filter((f) => !needle || [f.code, f.name, f.mobile].some((s) => s.toLowerCase().includes(needle)))
      .filter((f) => !by || (by === "none" ? !f.transporter_id : f.transporter_id === by))
      .filter((f) => !centre || f.center === centre);
    const val = (f: FarmerListRow): number | string => {
      switch (sort) {
        case "litres": return -(f.recent?.litres ?? -1);
        case "fat": return -(f.recent?.fat_pct ?? -1);
        case "snf": return -(f.recent?.snf_pct ?? -1);
        case "last": return f.last_day ? -Date.parse(f.last_day) : 0;
        case "name": return f.name.toLowerCase();
        default: return f.code;
      }
    };
    return [...hit].sort((a, b) => {
      const x = val(a), y = val(b);
      return x < y ? -1 : x > y ? 1 : (a.center + a.code).localeCompare(b.center + b.code);
    });
  }, [farmers, q, sort, by, centre]);

  const supplying = farmers.filter((f) => f.recent).length;
  const unassigned = farmers.filter((f) => f.recent && !f.transporter_id).length;

  return (
    <Section
      title="Farmers"
      description={`${farmers.length} registered · ${supplying} supplied milk in the last 30 days (${shortDate(from)} – ${shortDate(to)})${unassigned ? ` · ${unassigned} of them have no transporter yet` : ""}. Pick each farmer's transporter to share its fuel cost by litres. Click a farmer for their profile.`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {centers.length > 1 ? (
            <select
              value={centre}
              onChange={(e) => setCentre(e.target.value)}
              className="h-8 rounded-lg border border-border bg-white px-2 text-[12px] font-semibold text-foreground"
              aria-label="Filter by centre"
            >
              <option value="">All centres</option>
              {centers.map((c) => <option key={c.center} value={c.center}>{c.name} ({c.center})</option>)}
            </select>
          ) : null}
          <select
            value={by}
            onChange={(e) => setBy(e.target.value)}
            className="h-8 rounded-lg border border-border bg-white px-2 text-[12px] font-semibold text-foreground"
            aria-label="Filter by transporter"
          >
            <option value="">All transporters</option>
            {transporters.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            <option value="none">No transporter</option>
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code or mobile" className="h-8 w-64 pl-8" />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-8 rounded-lg border border-border bg-white px-2 text-[12px] font-semibold text-foreground"
            aria-label="Sort farmers"
          >
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-[13px]">
          <THead>
            <Th align="left">Centre</Th>
            <Th align="left">Code</Th>
            <Th align="left">Farmer</Th>
            <Th align="left">Mobile</Th>
            <Th align="left">Milk</Th>
            <Th align="left">Transporter</Th>
            <Th>Litres · 30 days</Th>
            <Th>Fat %</Th>
            <Th>SNF %</Th>
            <Th>Price ₹ / L</Th>
            <Th>₹ / kg</Th>
            <Th>Kg fat</Th>
            <Th>Days</Th>
            <Th>Transport ₹</Th>
            <Th>₹ / L</Th>
            <Th align="left">Last supplied</Th>
          </THead>
          <tbody>
            {rows.map((f) => {
              const r = f.recent;
              return (
                <tr
                  key={`${f.center}|${f.code}`}
                  onClick={() => router.push(href(f))}
                  className={`cursor-pointer border-b border-border/70 hover:bg-muted/60 ${r ? "" : "text-muted-foreground"}`}
                >
                  <td className="px-3 py-2.5 text-muted-foreground">{centreName(f.center)}</td>
                  <td className="num px-3 py-2.5 text-muted-foreground">{f.code}</td>
                  <td className="px-3 py-2.5">
                    <Link href={href(f)} className={`font-semibold hover:underline ${r ? "text-foreground" : "text-muted-foreground"}`} onClick={(e) => e.stopPropagation()}>
                      {f.name || "—"}
                    </Link>
                  </td>
                  <td className="num px-3 py-2.5">{f.mobile || "—"}</td>
                  <td className="px-3 py-2.5">{f.milk_type || "—"}</td>
                  <td className="px-2 py-1.5">
                    {centers.find((c) => c.center === f.center)?.kind === "tanker" ? (
                      <span className="px-1 text-[12px] text-muted-foreground">Tanker supplier</span>
                    ) : (
                      <TransporterPicker center={f.center} code={f.code} current={f.transporter_id} transporters={transporters} className="min-w-40" />
                    )}
                  </td>
                  <td className="num px-3 py-2.5 text-right font-semibold text-foreground">{r ? formatNumber(r.litres, 0) : "—"}</td>
                  <td className="num px-3 py-2.5 text-right">{r ? formatNumber(r.fat_pct, 2) : "—"}</td>
                  <td className="num px-3 py-2.5 text-right">{r ? formatNumber(r.snf_pct, 2) : "—"}</td>
                  <td className="num px-3 py-2.5 text-right font-semibold text-foreground">{r && r.priced_litres ? formatNumber(r.amount / r.priced_litres, 2) : "—"}</td>
                  <td className="num px-3 py-2.5 text-right">{r && r.priced_litres ? formatNumber(perLitreToPerKg(r.amount / r.priced_litres, kgPerLitre), 2) : "—"}</td>
                  <td className="num px-3 py-2.5 text-right">{r ? formatNumber(r.kg_fat, 1) : "—"}</td>
                  <td className="num px-3 py-2.5 text-right">{r ? r.days : "—"}</td>
                  <td className="num px-3 py-2.5 text-right text-foreground">{f.transport?.cost ? formatNumber(f.transport.cost, 0) : "—"}</td>
                  <td className="num px-3 py-2.5 text-right">
                    {f.transport?.cost && f.transport.litres ? formatNumber(f.transport.cost / f.transport.litres, 2) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{f.last_day ? shortDate(f.last_day) : "never"}</td>
                </tr>
              );
            })}
            {rows.length === 0 ? <Empty colSpan={16}>No farmer matches.</Empty> : null}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
