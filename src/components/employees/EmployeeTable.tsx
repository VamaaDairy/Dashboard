"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/cn/ui";
import { placeAction } from "@/app/employees/actions";
import type { Department, EmployeeRow } from "@/lib/employees";

const WING_OPTIONS = [
  { v: "salesforce", label: "Salesforce" }, { v: "plant", label: "Plant" }, { v: "office", label: "Office" }, { v: "none", label: "Not set" },
];
const select = "h-8 rounded-lg border border-input bg-background px-2 text-[13px] outline-none focus:border-foreground";
const day = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "—";

/** The employees of one group, with a photo, job, contact and which apps they sign in to; HR can move them in bulk. */
export function EmployeeTable({ rows, departments, canEdit }: { rows: EmployeeRow[]; departments: Department[]; canEdit: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [wing, setWing] = useState("");
  const [dept, setDept] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const all = rows.length > 0 && picked.size === rows.length;
  const toggle = (uid: string) => setPicked((p) => { const n = new Set(p); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });

  const apply = () => start(async () => {
    const r = await placeAction([...picked], wing, dept);
    if (!r.ok) return setNote({ ok: false, text: r.error });
    setNote({ ok: true, text: `${picked.size} employee${picked.size === 1 ? "" : "s"} updated.` });
    setPicked(new Set()); setWing(""); setDept("");
    router.refresh();
  });

  return (
    <div className="space-y-3">
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[13px]">
          <span className="font-medium">{picked.size ? `${picked.size} selected` : "Select employees to move them"}</span>
          <select value={wing} onChange={(e) => setWing(e.target.value)} className={select} aria-label="Move to group">
            <option value="">Group: keep</option>
            {WING_OPTIONS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
          </select>
          <select value={dept} onChange={(e) => setDept(e.target.value)} className={select} aria-label="Set department">
            <option value="">Department: keep</option>
            {departments.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            <option value="none">No department</option>
          </select>
          <Button size="sm" variant="primary" disabled={pending || !picked.size || (!wing && !dept)} onClick={apply}>{pending ? "Saving..." : "Apply"}</Button>
          {note ? <span className={note.ok ? "text-emerald-600" : "text-red-600"}>{note.text}</span> : null}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              {canEdit ? (
                <th className="w-8 px-3 py-2">
                  <input type="checkbox" checked={all} onChange={() => setPicked(all ? new Set() : new Set(rows.map((r) => r.uid)))} aria-label="Select all" />
                </th>
              ) : null}
              {["Employee", "Designation", "Department", "Mobile", "Reports to", "Joined", "Signs in to", "Status"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.uid} className="border-t border-border align-top hover:bg-muted/40">
                {canEdit ? <td className="px-3 py-2.5"><input type="checkbox" checked={picked.has(r.uid)} onChange={() => toggle(r.uid)} aria-label={`Select ${r.name}`} /></td> : null}
                <td className="min-w-56 px-3 py-2">
                  <Link href={`/employees/staff/${r.uid}`} className="flex items-center gap-2.5">
                    {r.hasPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element -- employee photos from our own route
                      <img src={`/api/employees/photo/${r.uid}`} alt="" loading="lazy" className="size-9 rounded-full border border-border object-cover" />
                    ) : <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground"><UserRound className="size-4" /></span>}
                    <span className="min-w-0">
                      <span className="block font-medium text-primary hover:underline">{r.name}</span>
                      {r.code ? <span className="block font-mono text-[11px] text-tertiary-foreground">{r.code}</span> : null}
                      {!r.wingSet && r.wing ? <span className="block text-[10px] text-amber-600">Salesforce by designation - confirm</span> : null}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2">{r.designation ?? "—"}</td>
                <td className="px-3 py-2">{r.department ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.phone ?? "—"}</td>
                <td className="px-3 py-2">{r.manager ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">{day(r.joined)}</td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1">
                    {r.employeeApp ? <Pill tone="info" dot={false}>Employee app</Pill> : null}
                    {r.salesforceApp ? <Pill tone="brand" dot={false}>Salesforce app</Pill> : null}
                    {r.dashboard ? <Pill tone="success" dot={false}>Dashboard</Pill> : null}
                    {!r.employeeApp && !r.salesforceApp && !r.dashboard ? <span className="text-muted-foreground">—</span> : null}
                  </span>
                </td>
                <td className="px-3 py-2">{r.active ? <Pill tone="success">Active</Pill> : <Pill>Left</Pill>}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={canEdit ? 9 : 8} className="px-3 py-10 text-center text-muted-foreground">No employee here.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
