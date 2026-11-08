"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { linkUserAction, placeAction } from "@/app/employees/actions";

const select = "h-8 w-full rounded-lg border border-input bg-background px-2 text-[13px] outline-none focus:border-foreground";

/** HR's part of a profile: the group, the department and the dashboard login that is this employee. */
export function EmployeeAdmin({ uid, wing, departmentId, departments, dashboardUserId, users }: {
  uid: string; wing: string | null; departmentId: number | null;
  departments: Array<{ id: number; name: string; active: boolean }>;
  dashboardUserId: string | null; users: Array<{ id: string; email: string; name: string }>;
}) {
  const router = useRouter();
  const [w, setW] = useState(wing ?? "none");
  const [d, setD] = useState(departmentId ? String(departmentId) : "none");
  const [u, setU] = useState(dashboardUserId ?? "");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const done = (r: { ok: true } | { ok: false; error: string }) => {
    setNote(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  };
  return (
    <div className="space-y-3 px-4 py-3 text-[13px]">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1">Group
          <select value={w} onChange={(e) => setW(e.target.value)} className={select}>
            <option value="salesforce">Salesforce</option><option value="plant">Plant</option><option value="office">Office</option><option value="none">Not set</option>
          </select>
        </label>
        <label className="grid gap-1">Department
          <select value={d} onChange={(e) => setD(e.target.value)} className={select}>
            <option value="none">No department</option>
            {departments.filter((x) => x.active || String(x.id) === d).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      </div>
      <Button size="sm" variant="primary" disabled={pending} onClick={() => start(async () => done(await placeAction([uid], w, d)))}>Save group & department</Button>
      <label className="grid gap-1 pt-2">Dashboard login (this person)
        <select value={u} onChange={(e) => setU(e.target.value)} className={select}>
          <option value="">No dashboard login</option>
          {users.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.email}</option>)}
        </select>
      </label>
      <Button size="sm" variant="outline" disabled={pending || u === (dashboardUserId ?? "")} onClick={() => start(async () => done(await linkUserAction(uid, u)))}>Save login link</Button>
      {note ? <p className={note.ok ? "text-emerald-600" : "text-red-600"}>{note.text}</p> : null}
    </div>
  );
}
