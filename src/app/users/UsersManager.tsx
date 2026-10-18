"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GROUPS, RESOURCES, type AccessMap, type Level } from "@/lib/access";
import { saveUser } from "./actions";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  access: AccessMap;
}

const BLANK: UserRecord = { id: "", email: "", name: "", role: "viewer", isActive: true, access: {} };

const field =
  "w-full rounded-lg border border-border bg-input/30 px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

export function UsersManager({ users }: { users: UserRecord[] }) {
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

  const setLevel = (key: string, level: Level) =>
    setEditing((u) => {
      if (!u) return u;
      const access = { ...u.access };
      if (level === "none") delete access[key];
      else access[key] = level;
      return { ...u, access };
    });

  const setGroup = (group: string, level: Level) =>
    RESOURCES.filter((r) => r.group === group).forEach((r) => setLevel(r.key, level));

  const submit = () => {
    if (!editing) return;
    setError("");
    start(async () => {
      const res = await saveUser({
        id: editing.id || undefined,
        name: editing.name,
        email: editing.email,
        role: editing.role,
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
            <div className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground">
                What they can open. &quot;View&quot; opens the page read-only, &quot;Edit&quot; lets them change it.
              </p>
              {GROUPS.map((g) => (
                <div key={g} className="rounded-lg border border-border">
                  <div className="flex items-center justify-between border-b border-border bg-secondary px-3 py-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-tertiary-foreground">{g}</span>
                    <span className="flex gap-2 text-[11px]">
                      {(["none", "view", "edit"] as Level[]).map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setGroup(g, l)}
                          className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          all {l === "none" ? "no access" : l}
                        </button>
                      ))}
                    </span>
                  </div>
                  <div className="divide-y divide-border/70">
                    {RESOURCES.filter((r) => r.group === g).map((r) => (
                      <div key={r.key} className="flex items-center justify-between px-3 py-1.5 text-sm">
                        <span className="text-foreground">{r.label}</span>
                        <select
                          className="rounded-md border border-border bg-input/30 px-2 py-1 text-xs"
                          value={editing.access[r.key] ?? "none"}
                          onChange={(e) => setLevel(r.key, e.target.value as Level)}
                        >
                          <option value="none">No access</option>
                          <option value="view">View</option>
                          <option value="edit">Edit</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
