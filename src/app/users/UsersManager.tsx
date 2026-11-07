"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AccessMap } from "@/lib/access";
import { AccessEditor } from "@/components/access/AccessEditor";
import { saveUser } from "./actions";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  /** set on the login; null = the linked employee's department (employeeDepartmentId), if any */
  departmentId: number | null;
  employeeDepartmentId: number | null;
  /** the employee this login is (Employee Master) */
  employee: string | null;
  mobile: string;
  isActive: boolean;
  access: AccessMap;
}

export interface DepartmentOption { id: number; name: string; active: boolean; access: AccessMap }

const BLANK: UserRecord = { id: "", email: "", name: "", role: "viewer", departmentId: null, employeeDepartmentId: null, employee: null, mobile: "", isActive: true, access: {} };

const field =
  "w-full rounded-lg border border-border bg-input/30 px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

export function UsersManager({ users, departments }: { users: UserRecord[]; departments: DepartmentOption[] }) {
  const deptOf = (u: UserRecord) => departments.find((d) => d.id === (u.departmentId ?? u.employeeDepartmentId)) ?? null;
  const router = useRouter();
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const open = (u: UserRecord) => {
    setEditing({ ...u, access: { ...u.access } });
    setPassword("");
    setError("");
  };
  const isNew = editing !== null && !editing.id;

  const submit = () => {
    if (!editing) return;
    setError("");
    start(async () => {
      const res = await saveUser({
        id: editing.id || undefined,
        name: editing.name,
        email: editing.email,
        role: editing.role,
        departmentId: editing.departmentId,
        mobile: editing.mobile,
        isActive: editing.isActive,
        access: editing.access,
        password,
      });
      if (res.ok) {
        setEditing(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={() => open(BLANK)}
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
        >
          + Add user
        </button>
      </div>

      {editing && (
        <div className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">{isNew ? "Add user" : `Edit ${editing.name}`}</h2>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-xs font-medium text-muted-foreground">
              Name
              <input
                className={`${field} mt-1.5`}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Email (their user name)
              <input
                className={`${field} mt-1.5`}
                value={editing.email}
                placeholder="name@vamaadairy.com"
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
              />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Department (their access comes from it)
              <select
                className={`${field} mt-1.5`}
                value={editing.departmentId ?? ""}
                onChange={(e) => setEditing({ ...editing, departmentId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">{editing.employeeDepartmentId ? `As their employee record (${departments.find((d) => d.id === editing.employeeDepartmentId)?.name ?? "-"})` : "No department"}</option>
                {departments.filter((d) => d.active || d.id === editing.departmentId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Mobile number (forgot-password code is texted here)
              <input
                className={`${field} mt-1.5`}
                type="tel"
                inputMode="numeric"
                value={editing.mobile}
                placeholder="10-digit mobile number"
                onChange={(e) => setEditing({ ...editing, mobile: e.target.value })}
              />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              {isNew ? "Password" : "New password (leave empty to keep the current one)"}
              <input
                className={`${field} mt-1.5`}
                type="password"
                autoComplete="new-password"
                value={password}
                placeholder="At least 8 characters"
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Role
              <select
                className={`${field} mt-1.5`}
                value={editing.role}
                onChange={(e) => setEditing({ ...editing, role: e.target.value })}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="owner">Owner - everything, including users</option>
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={editing.isActive}
              onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
            />
            Active - can sign in
          </label>

          {editing.role === "owner" ? (
            <p className="text-sm text-muted-foreground">Owners can open and change everything.</p>
          ) : (
            <AccessEditor
              value={editing.access}
              onChange={(access) => setEditing({ ...editing, access })}
              inherited={deptOf(editing)?.access}
              inheritedFrom={deptOf(editing)?.name}
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-60"
            >
              {pending ? "Saving…" : isNew ? "Add user" : "Save changes"}
            </button>
            <button
              onClick={() => setEditing(null)}
              disabled={pending}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <table className="w-full overflow-hidden rounded-lg border border-border bg-card text-[13px] shadow-xs">
        <thead>
          <tr className="border-b border-border bg-secondary text-[10px] font-mono uppercase tracking-wide text-tertiary-foreground">
            <th className="px-4 py-2 text-left font-bold">Name</th>
            <th className="px-3 py-2 text-left font-bold">Email</th>
            <th className="px-3 py-2 text-left font-bold">Department</th>
            <th className="px-3 py-2 text-left font-bold">Employee</th>
            <th className="px-3 py-2 text-left font-bold">Mobile</th>
            <th className="px-3 py-2 text-left font-bold">Role</th>
            <th className="px-3 py-2 text-left font-bold">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-border/70 hover:bg-muted">
              <td className="px-4 py-2 font-medium text-foreground">{u.name}</td>
              <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
              <td className="px-3 py-2">
                {deptOf(u)?.name ?? <span className="text-tertiary-foreground">—</span>}
                {Object.keys(u.access).length ? <span className="ml-1 text-[11px] text-muted-foreground">+ {Object.keys(u.access).length} extra</span> : null}
              </td>
              <td className="px-3 py-2">{u.employee ?? <span className="text-tertiary-foreground">Not linked</span>}</td>
              <td className="px-3 py-2">{u.mobile || <span className="text-tertiary-foreground">—</span>}</td>
              <td className="px-3 py-2 capitalize">{u.role}</td>
              <td className="px-3 py-2">{u.isActive ? "Active" : <span className="text-destructive">Deactivated</span>}</td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => open(u)} className="text-xs font-semibold text-primary hover:underline">
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
