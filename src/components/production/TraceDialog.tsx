"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Link2 } from "lucide-react";
import { recordBatchOnChain } from "@/app/daily/trace-actions";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TraceProduct, TraceState } from "@/lib/trace/data";

const STEP_NAME: Record<string, string> = {
  collected: "milk collected", processed: "processed", packed: "packed", dispatched: "dispatched",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Under a saved batch's status: put it on the Stellar blockchain, or open what is already there. */
export function TraceButton({
  bulkBatchId, productName, dirty, state, products, suggested,
}: {
  bulkBatchId: string;
  productName: string;
  dirty: boolean;
  state: TraceState | null;
  products: TraceProduct[];
  suggested: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        title={state ? `On Stellar as ${state.trace_id}` : "Record this batch on the Stellar blockchain"}
      >
        <Link2 className="h-3 w-3" />
        {state ? `On chain · ${state.records}` : "Record on chain"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          {open ? (
            <TraceBody
              bulkBatchId={bulkBatchId}
              productName={productName}
              dirty={dirty}
              state={state}
              products={products}
              suggested={state?.product_uid ?? suggested}
              onClose={() => setOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TraceBody({
  bulkBatchId, productName, dirty, state, products, suggested, onClose,
}: {
  bulkBatchId: string;
  productName: string;
  dirty: boolean;
  state: TraceState | null;
  products: TraceProduct[];
  suggested: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [uid, setUid] = useState(suggested ?? "");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ link: string; traceId: string; sent: string[] } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const picked = products.find((p) => p.uid === uid) ?? null;
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? products.filter((p) => `${p.name} ${p.size ?? ""} ${p.sku}`.toLowerCase().includes(q)) : products;
    return list.slice(0, 60);
  }, [products, search]);

  const link = done?.link ?? state?.link ?? null;
  useEffect(() => {
    if (!link) return;
    QRCode.toDataURL(link, { margin: 1, width: 480, color: { dark: "#2F3992", light: "#F7F5E8" } }).then(setQr).catch(() => setQr(null));
  }, [link]);

  function record() {
    setError(null);
    start(async () => {
      const res = await recordBatchOnChain(bulkBatchId, uid);
      if (!res.ok) { setError(res.error); return; }
      setDone({ link: res.link, traceId: res.traceId, sent: res.sent });
      router.refresh();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{productName} on the blockchain</DialogTitle>
        <DialogDescription>
          {state
            ? `Recorded as ${state.trace_id} · ${state.records} record${state.records === 1 ? "" : "s"}, last ${when(state.last_at)}. If the batch was edited since, record it again to add the update.`
            : "Stores this batch in full on Stellar - where the milk was collected, processing at the plant with the lab test, packing (use-by, storage, nutrition) and dispatch - so a customer scanning the pack reads it straight from the blockchain. Costs, farmer and customer names, tank names and recipe quantities stay private."}
        </DialogDescription>
      </DialogHeader>

      {dirty ? (
        <p className="rounded-md bg-muted px-3 py-2 text-[13px]">Save the day first - only saved figures can be recorded.</p>
      ) : (
        <div className="space-y-2">
          <div className="text-[12px] font-semibold text-muted-foreground">Sold as (name and photo on the public page)</div>
          <Input placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-64 overflow-y-auto rounded-md border border-border">
            {shown.map((p) => (
              <button
                key={p.uid}
                onClick={() => setUid(p.uid)}
                className={`flex w-full items-center gap-3 border-b border-border/60 px-2 py-1.5 text-left text-[13px] last:border-0 hover:bg-muted ${p.uid === uid ? "bg-muted font-semibold" : ""}`}
              >
                {p.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                  : <span className="h-9 w-9 shrink-0 rounded bg-muted" />}
                <span className="flex-1 truncate">{p.name}{p.size ? ` · ${p.size}` : ""}</span>
                <span className="text-[11px] text-muted-foreground">{p.sku}</span>
              </button>
            ))}
            {shown.length === 0 ? <div className="px-3 py-4 text-[13px] text-muted-foreground">No product matches.</div> : null}
          </div>
          {picked && !picked.image ? (
            <p className="text-[12px] text-muted-foreground">This product has no photo yet - add one in the Product Master to show it on the page.</p>
          ) : null}
        </div>
      )}

      {error ? <p className="text-[13px] font-semibold text-destructive">{error}</p> : null}

      {done || state ? (
        <div className="flex items-center gap-4 rounded-md border border-border p-3">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code for the public batch page" className="h-28 w-28" />
          ) : null}
          <div className="min-w-0 space-y-1 text-[13px]">
            {done ? (
              <div className="font-semibold">
                {done.sent.length ? `Stored on Stellar: ${done.sent.map((k) => STEP_NAME[k] ?? k).join(", ")}.` : "Nothing changed since the last record."}
              </div>
            ) : null}
            <a href={link!} target="_blank" rel="noreferrer" className="block truncate font-semibold underline">
              {link}
            </a>
            {qr ? (
              <a href={qr} download={`${done?.traceId ?? state?.trace_id}.png`} className="block text-muted-foreground underline">
                Download QR for the pack label
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
        {!dirty ? (
          <Button onClick={record} disabled={pending || !uid} className="bg-foreground text-background hover:bg-foreground/85">
            {pending ? "Recording… (up to a minute)" : state ? "Record update" : "Record on Stellar"}
          </Button>
        ) : null}
      </DialogFooter>
    </>
  );
}
