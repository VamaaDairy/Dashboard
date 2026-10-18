import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGES, stageLabel, tatOf, tatText, type TatState } from "@/lib/cn/sop";

/*
 * Building blocks for the CN section, modelled on Supabase Studio: hairline
 * borders, quiet 13px type, status pills with a leading dot, panels with a
 * header row - and colour kept for meaning (stage, lateness), not decoration.
 */

export type Tone = "neutral" | "brand" | "info" | "success" | "warning" | "danger";

const PILL: Record<Tone, { box: string; dot: string }> = {
  neutral: { box: "border-border bg-muted text-muted-foreground", dot: "bg-tertiary-foreground/60" },
  brand: { box: "border-border-brand bg-primary/10 text-foreground", dot: "bg-primary" },
  info: { box: "border-border-info bg-info/10 text-info", dot: "bg-info" },
  success: { box: "border-emerald-600/25 bg-emerald-500/10 text-emerald-700", dot: "bg-emerald-500" },
  warning: { box: "border-border-warning bg-warning/12 text-amber-700", dot: "bg-warning" },
  danger: { box: "border-border-destructive bg-destructive/10 text-destructive", dot: "bg-destructive" },
};

export function Pill({ tone = "neutral", dot = true, className, children }: {
  tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode;
}) {
  const t = PILL[tone];
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium leading-none", t.box, className)}>
      {dot ? <span className={cn("size-1.5 rounded-full", t.dot)} /> : null}
      {children}
    </span>
  );
}

const STAGE_TONE: Record<string, Tone> = {
  registered: "neutral", logged: "neutral", assigned: "info", rca_done: "info",
  recommended: "warning", approved: "brand", posted: "brand", closed: "success", rejected: "danger",
};

export const StagePill = ({ stage }: { stage: string }) => <Pill tone={STAGE_TONE[stage] ?? "neutral"}>{stageLabel(stage)}</Pill>;

const TAT_TONE: Record<TatState, Tone> = { ok: "neutral", due: "warning", overdue: "warning", escalated: "danger", done: "neutral" };

/** Where a complaint stands against the TAT of the stage it is in. Quiet when all is well. */
export function TatPill({ c, today }: { c: { stage: string; stage_on: string; tat_due: string | null }; today: string }) {
  const t = tatOf(c, today);
  if (t.state === "done") return <span className="text-tertiary-foreground">—</span>;
  if (t.state === "ok") return <span className="text-[12px] text-tertiary-foreground">On track</span>;
  return <Pill tone={TAT_TONE[t.state]}>{tatText(t)}</Pill>;
}

/** A bordered surface with an optional header row (title, description, actions) and footer. */
export function Panel({ title, description, actions, footer, children, className, flush }: {
  title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; footer?: React.ReactNode;
  children?: React.ReactNode; className?: string; flush?: boolean;
}) {
  return (
    <section className={cn("min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-xs", className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
            {description ? <p className="mt-0.5 max-w-2xl text-[12px] leading-relaxed text-tertiary-foreground">{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      {flush ? children : <div className="p-4">{children}</div>}
      {footer ? <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-4 py-3">{footer}</footer> : null}
    </section>
  );
}

/** Label on the left, control on the right (stacked on phones) - Supabase's form row. */
export function FormRow({ label, hint, required, children, className }: {
  label: string; hint?: React.ReactNode; required?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5 px-4 py-3.5 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-6", className)}>
      <div className="md:pt-2">
        <div className="text-[13px] font-medium text-foreground">
          {label}{required ? <span className="ml-0.5 text-destructive">*</span> : null}
        </div>
        {hint ? <p className="mt-0.5 text-[12px] leading-snug text-tertiary-foreground">{hint}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Compact stacked label + control, for the inline stage forms. */
export function Field({ label, hint, required, children, className }: {
  label: string; hint?: React.ReactNode; required?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="text-[12px] font-medium text-foreground">
        {label}{required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </div>
      {children}
      {hint ? <p className="text-[12px] leading-snug text-tertiary-foreground">{hint}</p> : null}
    </div>
  );
}

const TILE_ICON: Record<Tone, string> = {
  neutral: "bg-muted text-tertiary-foreground",
  brand: "bg-primary/12 text-foreground",
  info: "bg-info/10 text-info",
  success: "bg-emerald-500/10 text-emerald-700",
  warning: "bg-warning/15 text-amber-700",
  danger: "bg-destructive/10 text-destructive",
};

export function StatCard({ icon: Icon, label, value, note, tone = "neutral", href }: {
  icon: LucideIcon; label: string; value: string; note?: React.ReactNode; tone?: Tone; href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-tertiary-foreground">{label}</span>
        <span className={cn("flex size-6 items-center justify-center rounded-md", TILE_ICON[tone])}>
          <Icon className="size-3.5" strokeWidth={1.75} />
        </span>
      </div>
      <div className="num mt-2 text-[22px] font-semibold leading-none tracking-tight text-foreground">{value}</div>
      {note ? <div className="mt-1.5 truncate text-[12px] text-tertiary-foreground">{note}</div> : null}
    </>
  );
  const cls = "block min-w-0 rounded-lg border border-border bg-card px-4 py-3.5 shadow-xs";
  return href
    ? <a href={href} className={cn(cls, "transition-colors hover:border-border-control-hover hover:bg-accent/50")}>{body}</a>
    : <div className={cls}>{body}</div>;
}

export function EmptyState({ icon: Icon = Inbox, title, children }: { icon?: LucideIcon; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
      <span className="mb-2 flex size-9 items-center justify-center rounded-full border border-border bg-muted/60 text-tertiary-foreground">
        <Icon className="size-4" strokeWidth={1.5} />
      </span>
      <p className="text-[13px] font-medium text-foreground">{title}</p>
      {children ? <p className="max-w-sm text-[12px] text-tertiary-foreground">{children}</p> : null}
    </div>
  );
}

/** Label/value pairs, hairline-separated. Empty values show an em dash. */
export function Rows({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y divide-border">{children}</dl>;
}

export function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 px-4 py-2.5 text-[13px] sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-tertiary-foreground">{label}</dt>
      <dd className={cn("whitespace-pre-line break-words text-foreground", mono && "num")}>
        {value || <span className="text-tertiary-foreground">—</span>}
      </dd>
    </div>
  );
}

/** The SOP's stages as a vertical track: done ticked, current highlighted, the rest muted. */
export function StageTrack({ stage }: { stage: string }) {
  const at = STAGES.findIndex((s) => s.key === stage);
  const rejected = stage === "rejected";
  return (
    <ol className="relative">
      {STAGES.map((s, n) => {
        const done = !rejected && (n < at || stage === "closed");
        const here = !rejected && s.key === stage && stage !== "closed";
        const last = n === STAGES.length - 1;
        return (
          <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
            {!last ? <span className={cn("absolute left-[9px] top-5 h-[calc(100%-12px)] w-px", done ? "bg-primary" : "bg-border")} /> : null}
            <span className={cn(
              "relative z-10 mt-0.5 flex size-[19px] shrink-0 items-center justify-center rounded-full border text-[10px]",
              done && "border-primary bg-primary text-primary-foreground",
              here && "border-primary bg-card ring-4 ring-primary/20",
              !done && !here && "border-border bg-card",
            )}>
              {done ? <Check className="size-3" strokeWidth={3} /> : here ? <span className="size-1.5 rounded-full bg-primary" /> : null}
            </span>
            <div className="min-w-0 leading-tight">
              <div className={cn("text-[13px]", here ? "font-semibold text-foreground" : done ? "text-foreground" : "text-tertiary-foreground")}>{s.label}</div>
              {s.who ? <div className="mt-0.5 text-[11px] text-tertiary-foreground">{s.who}</div> : null}
            </div>
          </li>
        );
      })}
      {rejected ? (
        <li className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-[13px] font-medium text-destructive">
          <span className="size-1.5 rounded-full bg-destructive" /> Rejected
        </li>
      ) : null}
    </ol>
  );
}
