"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteOfferAction, duplicateOfferAction, setOfferActiveAction } from "@/lib/shop/offer-actions";

export function OfferRowActions({ id, active, canEdit }: { id: number; active: boolean; canEdit: boolean }) {
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
      <Link href={`/shop-orders/offers/${id}`} className={`${btn} inline-flex items-center`}>Edit</Link>
      <button type="button" disabled={pending} onClick={() => run(() => duplicateOfferAction(id), (n) => n && router.push(`/shop-orders/offers/${n}`))} className={btn}>Duplicate</button>
      <button type="button" disabled={pending} onClick={() => { if (window.confirm("Delete this offer?")) run(() => deleteOfferAction(id)); }} className={`${btn} text-red-600`}>Delete</button>
    </div>
  );
}
