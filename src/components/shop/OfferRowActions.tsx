"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteOfferAction, duplicateOfferAction, setOfferActiveAction } from "@/lib/shop/offer-actions";

/** [base]: the offers page these rows are on (D2C: /shop-orders/offers; Distributors app: /app-orders/marketing/offers). */
export function OfferRowActions({ id, active, canEdit, base = "/shop-orders/offers" }: { id: number; active: boolean; canEdit: boolean; base?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; id?: number }>, then?: (id?: number) => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok && r.error) window.alert(r.error);
      if (r.ok) then?.(r.id);
      router.refresh();
    });
  const btn = "h-8 rounded-lg border border-input px-2.5 text-[13px] hover:bg-muted disabled:opacity-60";
  if (!canEdit) return null;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <button type="button" disabled={pending} onClick={() => run(() => setOfferActiveAction(id, !active))}
        className={`${btn} ${active ? "" : "border-primary/40 text-primary"}`}>{active ? "Pause" : "Turn on"}</button>
      <Link href={`${base}/${id}`} className={`${btn} inline-flex items-center`}>Edit</Link>
      <button type="button" disabled={pending} onClick={() => run(() => duplicateOfferAction(id), (n) => n && router.push(`${base}/${n}`))} className={btn}>Duplicate</button>
      <button type="button" disabled={pending} onClick={() => { if (window.confirm("Delete this offer?")) run(() => deleteOfferAction(id)); }} className={`${btn} text-destructive`}>Delete</button>
    </div>
  );
}
