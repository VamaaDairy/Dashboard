"use client";

import { useState, useTransition } from "react";
import { addDistLoginAction, createAllDistLoginsAction, setDistLoginAction } from "@/lib/distributor/actions";

const box = "h-9 rounded-lg border border-input bg-transparent px-3 text-sm";
type Opt = { uid: string; label: string; phone: string | null };

export function AddDistLoginForm({ distributors, salesmen }: { distributors: Opt[]; salesmen: Opt[] }) {
  const [kind, setKind] = useState<"distributor" | "salesman">("distributor");
  const [uid, setUid] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const opts = kind === "distributor" ? distributors : salesmen;
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addDistLoginAction(kind, uid, phone, pin);
          if (r.ok) {
            setUid("");
            setPhone("");
            setPin("");
            setError("");
          } else setError(r.error ?? "Could not add the login.");
        });
      }}
    >
      <label className="text-xs text-muted-foreground">Type
        <select value={kind} onChange={(e) => { setKind(e.target.value as "distributor" | "salesman"); setUid(""); setPhone(""); }} className={`${box} mt-1 block w-36`}>
          <option value="distributor">Distributor</option>
          <option value="salesman">Salesman</option>
        </select>
      </label>
      <label className="text-xs text-muted-foreground">{kind === "distributor" ? "Distributor" : "Salesman"}
        <select
          value={uid}
          onChange={(e) => { setUid(e.target.value); setPhone(opts.find((o) => o.uid === e.target.value)?.phone?.replace(/\D/g, "").slice(-10) ?? ""); }}
          className={`${box} mt-1 block w-72`}
        >
          <option value="">Select…</option>
          {opts.map((o) => <option key={o.uid} value={o.uid}>{o.label}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">Mobile<input value={phone} inputMode="numeric" maxLength={10} onChange={(e) => setPhone(e.target.value)} className={`${box} mt-1 block w-40 font-mono`} /></label>
      <label className="text-xs text-muted-foreground">PIN (4-8 digits)<input value={pin} inputMode="numeric" maxLength={8} onChange={(e) => setPin(e.target.value)} className={`${box} mt-1 block w-32 font-mono`} /></label>
      <button disabled={pending} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">Add login</button>
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </form>
  );
}

export function DistLoginActions({ id, active }: { id: number; active: boolean }) {
  const [pending, start] = useTransition();
  const run = (patch: { active?: boolean; pin?: string }) =>
    start(async () => {
      const r = await setDistLoginAction(id, patch);
      if (!r.ok && r.error) window.alert(r.error);
    });
  return (
    <div className="flex gap-2">
      <button
        disabled={pending}
        onClick={() => {
          const pin = window.prompt("New PIN (4-8 digits). They are signed out of their phone.");
          if (pin) run({ pin });
        }}
        className="h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted disabled:opacity-60"
      >
        Reset PIN
      </button>
      <button disabled={pending} onClick={() => run({ active: !active })} className="h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted disabled:opacity-60">
        {active ? "Deactivate" : "Activate"}
      </button>
    </div>
  );
}

/** Creates logins for every distributor and employee that has none, then downloads the PIN list. */
export function CreateAllLoginsButton() {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (!window.confirm("Create a login for every distributor and employee that does not have one? A PIN list will download - keep it safe, the PINs cannot be shown again.")) return;
            const r = await createAllDistLoginsAction();
            if (!r.ok) { setMsg(r.error ?? "Could not create the logins."); return; }
            if (r.csv && r.created) {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([r.csv], { type: "text/csv" }));
              a.download = `gaia-app-logins-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(a.href);
            }
            setMsg(`${r.created} logins created.${r.skipped?.length ? ` Skipped ${r.skipped.length}: ${r.skipped.join("; ")}` : ""}`);
          })
        }
        className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        Create logins for everyone
      </button>
      <span className="text-sm text-muted-foreground">{msg || "Every active distributor and employee, on their registered mobile number."}</span>
    </div>
  );
}
