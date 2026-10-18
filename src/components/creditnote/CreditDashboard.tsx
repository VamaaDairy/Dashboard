"use client";

import Link from "next/link";
import { BarList, Donut, GAIA, TrendChart, shortDate } from "@/components/farmers/charts";
import { Panel, Tiles, dayList } from "@/components/dash/Dash";
import { StatusBadge } from "@/components/creditnote/StatusBadge";
import type { CreditNote } from "@/lib/creditnote/data";
import { formatNumber } from "@/lib/format";

const WEIGHT_UNITS = new Set(["KG", "LTR"]);
const isPiece = (unit: string) => !WEIGHT_UNITS.has(unit.toUpperCase());
const n0 = (v: number) => formatNumber(v, 0);

/** Claimed / approved pieces on a note. Items counted in KG or litres are left out, as they are not pieces. */
const pieces = (note: CreditNote, field: "claim_qty" | "approved_qty") =>
  note.items.reduce((t, i) => t + (isPiece(i.return_unit) ? Number(i[field] ?? 0) : 0), 0);

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** Credit notes over a period (by challan date): how many, where they stand, who and what they are about. */
export function CreditDashboard({ from, to, today, notes }: { from: string; to: string; today: string; notes: CreditNote[] }) {
  const dates = dayList(from, to);
  const count = (s: string) => notes.filter((n) => n.status === s).length;
  const pending = count("pending"), rejected = count("rejected"), approvedCount = count("approved");
  const claimed = notes.reduce((t, n) => t + pieces(n, "claim_qty"), 0);
  const approved = notes.reduce((t, n) => t + pieces(n, "approved_qty"), 0);
  const decidedClaimed = notes.filter((n) => n.status !== "pending").reduce((t, n) => t + pieces(n, "claim_qty"), 0);
  const rate = decidedClaimed > 0 ? (approved / decidedClaimed) * 100 : null;

  // claims per day
  const perDay = new Map<string, number>();
  for (const n of notes) perDay.set(n.challan_date, (perDay.get(n.challan_date) ?? 0) + pieces(n, "claim_qty"));
  const trend = dates.map((d) => ({ day: d, value: perDay.get(d) ?? null }));

  // who and what
  const sumBy = (key: (n: CreditNote) => { k: string; v: number }[]) => {
    const m = new Map<string, number>();
    for (const n of notes) for (const { k, v } of key(n)) m.set(k, (m.get(k) ?? 0) + v);
    return [...m].map(([label, value]) => ({ label, value }));
  };
  const byCustomer = sumBy((n) => [{ k: n.customer_name, v: pieces(n, "claim_qty") }]);
  const byMaterial = sumBy((n) => n.items.map((i) => ({ k: i.material_name, v: isPiece(i.return_unit) ? Number(i.claim_qty ?? 0) : 0 })));
  const byReason = sumBy((n) => n.items.map((i) => ({ k: (i.reason ?? "").trim() || "No reason given", v: 1 })));

  const waiting = notes
    .filter((n) => n.status === "pending")
    .sort((a, b) => a.challan_date.localeCompare(b.challan_date));

  return (
    <div className="space-y-5">
      <Tiles
        items={[
          { label: "Credit notes", value: n0(notes.length) },
          { label: "Waiting for a decision", value: n0(pending), note: pending ? "see the list below" : "all decided" },
          { label: "Approved", value: n0(approvedCount) },
          { label: "Rejected", value: n0(rejected) },
          { label: "Claimed", value: n0(claimed), unit: "pcs" },
          { label: "Approved qty", value: n0(approved), unit: "pcs", note: rate === null ? undefined : `${formatNumber(rate, 0)}% of decided claims` },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Claims per day" description="Pieces claimed on credit notes dated that day." className="lg:col-span-2">
          <TrendChart points={trend} color={GAIA.blue} unit="pcs" decimals={0} emptyLabel="no claims" />
        </Panel>
        <Panel title="Where they stand" description="Number of credit notes by status.">
          <Donut
            centre={n0(notes.length)}
            centreLabel="notes"
            slices={[
              { label: "Approved", value: approvedCount, color: GAIA.green },
              { label: "Pending", value: pending, color: GAIA.orange },
              { label: "Rejected", value: rejected, color: GAIA.muted },
            ].filter((s) => s.value > 0)}
          />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Customers" description="Pieces claimed, largest first.">
          {byCustomer.some((c) => c.value > 0) ? <BarList items={byCustomer} format={(v) => `${n0(v)} pcs`} /> : <Empty />}
        </Panel>
        <Panel title="Materials" description="Pieces claimed by SKU.">
          {byMaterial.some((c) => c.value > 0) ? <BarList items={byMaterial} format={(v) => `${n0(v)} pcs`} /> : <Empty />}
        </Panel>
        <Panel title="Reasons" description="Items by the reason given.">
          {byReason.length ? <BarList items={byReason} color={GAIA.orange} format={(v) => `${n0(v)} item${v === 1 ? "" : "s"}`} /> : <Empty />}
        </Panel>
      </div>

      <Panel title="Waiting for a decision" description="Pending credit notes in this period, oldest first.">
        {waiting.length === 0 ? (
          <Empty text="Nothing is waiting." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wide text-tertiary-foreground">
                  <th className="h-9 px-3 font-medium">Challan No.</th>
                  <th className="px-3 font-medium">Date</th>
                  <th className="px-3 font-medium">Customer</th>
                  <th className="px-3 font-medium">Items</th>
                  <th className="px-3 text-right font-medium">Claimed</th>
                  <th className="px-3 text-right font-medium">Waiting</th>
                  <th className="px-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {waiting.map((n) => (
                  <tr key={n.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/credit-note/${n.id}`} className="hover:underline">{n.challan_no}</Link>
                    </td>
                    <td className="px-3 py-2">{shortDate(n.challan_date)}</td>
                    <td className="px-3 py-2">{n.customer_name}</td>
                    <td className="px-3 py-2">{n.items.length}</td>
                    <td className="num px-3 py-2 text-right">{n0(pieces(n, "claim_qty"))} pcs</td>
                    <td className="num px-3 py-2 text-right">{daysBetween(n.challan_date, today)} d</td>
                    <td className="px-3 py-2"><StatusBadge note={n} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="text-[12px] text-muted-foreground">Pieces exclude items counted in KG or litres. Dates are the challan date.</p>
    </div>
  );
}

function Empty({ text = "Nothing in this period." }: { text?: string }) {
  return <p className="py-6 text-center text-[13px] text-muted-foreground">{text}</p>;
}
