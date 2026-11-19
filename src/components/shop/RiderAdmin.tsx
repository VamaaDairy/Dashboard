"use client";

import { useState, useTransition } from "react";
import { addRiderAction, setRiderAction } from "@/lib/shop/actions";

const box = "h-9 rounded-lg border border-input bg-transparent px-3 text-sm";

export function AddRiderForm({ initialKind = "delivery" }: { initialKind?: "delivery" | "transporter" }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [kind, setKind] = useState<"delivery" | "transporter">(initialKind);
  const [vehicle, setVehicle] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addRiderAction(name, phone, pin, kind, vehicle);
          if (r.ok) {
            setName("");
            setPhone("");
            setPin("");
            setVehicle("");
            setError("");
          } else setError(r.error ?? "Could not add the partner.");
        });
      }}
    >
      <label className="text-xs text-muted-foreground">
        Signs in as
        <select value={kind} onChange={(e) => setKind(e.target.value as "delivery" | "transporter")} className={`${box} mt-1 block w-40`}>
          <option value="delivery">Delivery boy</option>
          <option value="transporter">Transporter</option>
        </select>
      </label>
      <label className="text-xs text-muted-foreground">Name<input value={name} onChange={(e) => setName(e.target.value)} className={`${box} mt-1 block w-48`} /></label>
      <label className="text-xs text-muted-foreground">Mobile<input value={phone} inputMode="numeric" maxLength={10} onChange={(e) => setPhone(e.target.value)} className={`${box} mt-1 block w-40 font-mono`} /></label>
      <label className="text-xs text-muted-foreground">PIN (4-8 digits)<input value={pin} inputMode="numeric" maxLength={8} onChange={(e) => setPin(e.target.value)} className={`${box} mt-1 block w-32 font-mono`} /></label>
      {kind === "transporter" ? (
        <label className="text-xs text-muted-foreground">Vehicle no.<input value={vehicle} maxLength={20} placeholder="CG 04 AB 1234" onChange={(e) => setVehicle(e.target.value)} className={`${box} mt-1 block w-40 font-mono uppercase`} /></label>
      ) : null}
      <button disabled={pending} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">{kind === "transporter" ? "Add transporter" : "Add rider"}</button>
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </form>
  );
}

export function RiderActions({ id, active, pay }: { id: number; active: boolean; pay: number }) {
  const [pending, start] = useTransition();
  const run = (patch: { active?: boolean; pin?: string; pay?: number }) =>
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
      <button
        disabled={pending}
        onClick={() => {
          const v = window.prompt("Pay per delivery in rupees. Counts for deliveries from now on.", String(pay));
          if (v !== null && v.trim() !== "") run({ pay: Number(v.replace(/[^\d.]/g, "")) });
        }}
        className="h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted disabled:opacity-60"
      >
        Set pay
      </button>
      <button disabled={pending} onClick={() => run({ active: !active })} className="h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted disabled:opacity-60">
        {active ? "Deactivate" : "Activate"}
      </button>
    </div>
  );
}
