"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function DeletionForm() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<null | { already: boolean }>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shop/customer/deletion-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, pin, reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error ?? "Something went wrong. Please try again.");
      else setDone({ already: !!body.already });
    } catch {
      setError("Could not reach the server. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <p className="font-medium">{done.already ? "We already have your request." : "Request received."}</p>
        <p className="mt-1 text-muted-foreground">Your Gaia Dairy account will be deleted within 7 days.</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="phone">Mobile number</Label>
        <Input id="phone" inputMode="numeric" autoComplete="tel" maxLength={14} placeholder="10-digit number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pin">5-digit PIN</Label>
        <Input id="pin" type="password" inputMode="numeric" maxLength={5} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reason">Why are you leaving? (optional)</Label>
        <Textarea id="reason" maxLength={500} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" variant="destructive" disabled={busy || pin.length !== 5} className="w-full">
        {busy ? "Sending…" : "Request account deletion"}
      </Button>
    </form>
  );
}
