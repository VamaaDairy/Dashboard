"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, X } from "lucide-react";
import type { OrderStatus, PaymentStatus } from "@/lib/whatsapp/statuses";

export function money(n: number | null | undefined, currency = "INR") {
  if (n === null || n === undefined) return "—";
  const sym = currency === "INR" ? "₹" : `${currency} `;
  return `${sym}${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function when(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
        " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export const phone = (waId: string) => `+${waId}`;

/** Re-runs `load` every `ms` while the tab is visible, and once immediately. */
export function usePoll<T>(load: () => Promise<T>, deps: unknown[], ms = 4000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const run = () =>
      loadRef.current()
        .then((d) => { if (alive) { setData(d); setError(null); } })
        .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    run();
    const t = setInterval(() => { if (document.visibilityState === "visible") run(); }, ms);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass the values `load` closes over
  }, [...deps, tick, ms]);

  return { data, error, refresh: () => setTick((t) => t + 1), setData };
}

export async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (r.status === 401) throw new Error("Signed out - reload the page");
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  placed: "bg-info/15 text-info",
  confirmed: "bg-primary/10 text-primary",
  packed: "bg-warning/20 text-warning-foreground",
  shipped: "bg-warning/20 text-warning-foreground",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-muted text-muted-foreground line-through",
};

const PAY_STYLE: Record<PaymentStatus, string> = {
  unpaid: "bg-destructive/10 text-destructive",
  verifying: "bg-warning/20 text-warning-foreground",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  refunded: "bg-muted text-muted-foreground",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold capitalize ${STATUS_STYLE[status]}`}>{status}</span>;
}

export function PaymentBadge({ status, method }: { status: PaymentStatus; method?: string }) {
  return (
    <span className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold capitalize ${PAY_STYLE[status]}`}>
      {method === "cod" && status === "unpaid" ? "COD" : status === "verifying" ? "check proof" : status}
    </span>
  );
}

/** A stored photo (click to enlarge) or a file link. */
export function MediaThumb({ id, mime, className = "", alt = "" }: { id: number; mime: string | null; className?: string; alt?: string }) {
  const [open, setOpen] = useState(false);
  const src = `/api/whatsapp/media/${id}`;
  if (mime?.startsWith("image/")) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated, dynamic media */}
        <img src={src} alt={alt} loading="lazy" onClick={() => setOpen(true)} className={`cursor-zoom-in rounded-md object-cover ${className}`} />
        {open ? <Lightbox src={src} onClose={() => setOpen(false)} /> : null}
      </>
    );
  }
  if (mime?.startsWith("video/")) return <video src={src} controls className={`rounded-md ${className}`} />;
  if (mime?.startsWith("audio/")) return <audio src={src} controls className="max-w-full" />;
  return (
    <a href={`${src}?download`} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium hover:bg-muted">
      <FileText className="h-4 w-4" /> Download file
    </a>
  );
}

export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close">
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated, dynamic media */}
      <img src={src} alt="" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      <a href={`${src}?download`} onClick={(e) => e.stopPropagation()} className="absolute bottom-4 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20">
        Download
      </a>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-40 items-center justify-center p-6 text-center text-sm text-muted-foreground">{children}</div>;
}
