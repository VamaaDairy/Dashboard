import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The small pieces every Employee app screen shares. */

export const rs = (n: number | null | undefined) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const when = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
export const clock = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
export const day = (d: string | null | undefined) =>
  d ? new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "—";

export const field = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm";
export const area = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
export const btn = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90";
export const btnGhost = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted";
export const btnDanger = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50";

const TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  open: "bg-amber-50 text-amber-800 border-amber-200",
  in_progress: "bg-blue-50 text-blue-800 border-blue-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  paid: "bg-blue-50 text-blue-800 border-blue-200",
  closed: "bg-muted text-muted-foreground border-border",
  rejected: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-muted text-muted-foreground border-border",
};
export function Pill({ status, label }: { status: string; label?: string }) {
  return <span className={cn("inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium capitalize", TONE[status] ?? TONE.closed)}>{label ?? status.replace("_", " ")}</span>;
}

/** The message a server action leaves in the address (?err= / ?ok=). */
export function Flash({ err, ok }: { err?: string; ok?: string }) {
  if (!err && !ok) return null;
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm", err ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>{err ?? ok}</div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">{children}</div>
    </div>
  );
}

export function Table({ head, children, empty, cols }: { head: string[]; children: ReactNode; empty?: string; cols: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {children}
          {empty ? <tr><td colSpan={cols} className="px-3 py-10 text-center text-muted-foreground">{empty}</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export const LEAVE_CLASH = (n: number) => (n > 0 ? `${n} from the same team already off` : null);
