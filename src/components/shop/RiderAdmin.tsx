"use client";

import { useState, useTransition } from "react";
import { addRiderAction, setRiderAction } from "@/lib/shop/actions";

const box = "h-9 rounded-lg border border-input bg-transparent px-3 text-sm";

export function AddRiderForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addRiderAction(name, phone, pin);
          if (r.ok) {
            setName("");
            setPhone("");
            setPin("");
            setError("");
          } else setError(r.error ?? "Could not add the rider.");
        });
      }}
    >
      <label className="text-xs text-muted-foreground">Name<input value={name} onChange={(e) => setName(e.target.value)} className={`${box} mt-1 block w-48`} /></label>
      <label className="text-xs text-muted-foreground">Mobile<input value={phone} inputMode="numeric" maxLength={10} onChange={(e) => setPhone(e.target.value)} className={`${box} mt-1 block w-40 font-mono`} /></label>
      <label className="text-xs text-muted-foreground">PIN (4-8 digits)<input value={pin} inputMode="numeric" maxLength={8} onChange={(e) => setPin(e.target.value)} className={`${box} mt-1 block w-32 font-mono`} /></label>
      <button disabled={pending} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">Add rider</button>
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </form>
  );
}

export function RiderActions({ id, active }: { id: number; active: boolean }) {
  const [pending, start] = useTransition();
  const run = (patch: { active?: boolean; pin?: string }) =>
    start(async () => {
      const r = await setRiderAction(id, patch);
      if (!r.ok && r.error) window.alert(r.error);
    });
  return (
    <div className="flex gap-2">
      <button
        disabled={pending}
        onClick={() => {
          const pin = window.prompt("New PIN (4-8 digits). The rider is signed out of their phone.");
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
