"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";

export interface ApiKeyView {
  id: number;
  name: string;
  user: string;
  prefix: string;
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

const field =
  "w-full rounded-lg border border-border bg-input/30 px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "Never";

/**
 * API keys: another system (an app backend, Tally, a script) calls the Dashboard API (/api/masters, /api/orders) as one
 * user, with exactly that user's access. A key is shown once when it is made.
 */
export function ApiKeys({ keys, users }: { keys: ApiKeyView[]; users: Array<{ id: string; name: string; role: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [made, setMade] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const create = () => {
    setError("");
    start(async () => {
      const r = await createApiKeyAction(userId, name);
      if (!r.ok) return setError(r.error);
      setMade(r.key);
      setName("");
      setOpen(false);
      router.refresh();
    });
  };
  const revoke = (k: ApiKeyView) => {
    if (!confirm(`Revoke "${k.name}"? Anything using it stops working at once.`)) return;
    start(async () => {
      const r = await revokeApiKeyAction(k.id);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  };

  return (
    <section className="space-y-3 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">API keys</h2>
          <p className="text-sm text-muted-foreground">
            For another system to read and change masters and orders through the API. A key acts as the user you pick, with exactly their access.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => { setOpen(true); setMade(null); setError(""); }}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
          >
            New API key
          </button>
        )}
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive">{error}</div>}

      {made && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-sm font-semibold text-foreground">Copy this key now. It will not be shown again.</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-secondary px-2.5 py-1.5 font-mono text-[13px] text-foreground break-all">{made}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(made).then(() => setCopied(true))}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-accent"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" onClick={() => { setMade(null); setCopied(false); }} className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
              Done
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Send it as the header <code className="font-mono">Authorization: Bearer {made.slice(0, 11)}…</code></p>
        </div>
      )}

      {open && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-xs font-medium text-muted-foreground">
              What will use it
              <input className={`${field} mt-1.5`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tally sync, Distributors app backend" maxLength={80} />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Acts as user
              <select className={`${field} mt-1.5`} value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Choose a user</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || !userId || !name.trim()}
              onClick={create}
              className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-60"
            >
              {pending ? "Making…" : "Make key"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}

      {keys.length > 0 && (
        <table className="w-full overflow-hidden rounded-lg border border-border bg-card text-[13px] shadow-xs">
          <thead>
            <tr className="border-b border-border bg-secondary text-[10px] font-mono uppercase tracking-wide text-tertiary-foreground">
              <th className="px-4 py-2 text-left font-bold">Name</th>
              <th className="px-4 py-2 text-left font-bold">Acts as</th>
              <th className="px-4 py-2 text-left font-bold">Key</th>
              <th className="px-4 py-2 text-left font-bold">Made</th>
              <th className="px-4 py-2 text-left font-bold">Last used</th>
              <th className="px-4 py-2 text-right font-bold" />
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className={`border-b border-border last:border-0 ${k.revokedAt ? "opacity-55" : ""}`}>
                <td className="px-4 py-2.5 font-medium text-foreground">{k.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{k.user}</td>
                <td className="px-4 py-2.5 font-mono text-muted-foreground">{k.prefix}…</td>
                <td className="px-4 py-2.5 text-muted-foreground">{when(k.createdAt)} · {k.createdBy}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{when(k.lastUsedAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  {k.revokedAt ? (
                    <span className="text-muted-foreground">Revoked {when(k.revokedAt)}</span>
                  ) : (
                    <button type="button" disabled={pending} onClick={() => revoke(k)} className="text-sm font-semibold text-destructive hover:underline disabled:opacity-60">
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
