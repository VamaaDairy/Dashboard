"use client";

import { useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import { adjustStockAction } from "@/app/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const FIELD = "h-8 w-full rounded-lg border border-border bg-background px-2 text-[13px] outline-none focus:border-primary";

/** Opening stock, returns and corrections (+ or −) against one product. */
export function StockAdjust({ products }: { products: Array<{ id: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<"opening" | "adjust" | "return">("opening");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await adjustStockAction(product, Number(qty.replace(/,/g, "")), reason, note);
      if (res.ok) { setOpen(false); setQty(""); setNote(""); } else setError(res.error);
    });
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => { setError(null); setOpen(true); }}><SlidersHorizontal /> Adjust stock</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>Adjust stock</DialogTitle></DialogHeader>
            <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">Product
              <select className={FIELD} value={product} onChange={(e) => setProduct(e.target.value)}>
                <option value="">Pick product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">Reason
                <select className={FIELD} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
                  <option value="opening">Opening stock</option>
                  <option value="return">Return</option>
                  <option value="adjust">Correction (+ / −)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">Quantity
                <input className={FIELD} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={reason === "adjust" ? "e.g. -5" : "e.g. 100"} />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">Note
              <input className={FIELD} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {error && <p className="text-[12px] text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
