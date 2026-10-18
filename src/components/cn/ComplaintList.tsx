import Link from "next/link";
import { ChevronRight, SearchX } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Panel, StagePill, TatPill } from "@/components/cn/ui";
import { dmy, rupees } from "@/lib/cn/sop";
import type { Complaint } from "@/lib/cn/data";

export { dmy };

const th = "h-9 px-3 text-[11px] font-medium uppercase tracking-wider text-tertiary-foreground";

/** The complaints table, shared by the full list and the approval / finance queues. */
export function ComplaintList({ title, rows, today, empty }: { title: string; rows: Complaint[]; today: string; empty: string }) {
  const count = <span className="num rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{rows.length}</span>;
  return (
    <Panel title={<span className="flex items-center gap-2">{title}{count}</span>} flush>
      {rows.length === 0 ? (
        <EmptyState icon={SearchX} title={empty} />
      ) : (
        <>
          {/* phones: one card per complaint, nothing to scroll sideways */}
          <ul className="divide-y divide-border md:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/cn/${c.id}`} className="block space-y-2 px-4 py-3 active:bg-muted/60">
                  <div className="flex items-center justify-between gap-3">
                    <span className="num text-[13px] font-semibold">{c.complaint_no}</span>
                    <span className="num text-[13px] font-semibold">{rupees(c.claim_value)}</span>
                  </div>
                  <div>
                    <div className="text-[13px] font-medium">{c.customer_name}</div>
                    <div className="text-[12px] text-tertiary-foreground">{c.product_name} · {c.category}</div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><StagePill stage={c.stage} /><span className="text-[12px] text-tertiary-foreground">{dmy(c.complaint_date)}</span></span>
                    <TatPill c={c} today={today} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Table className="hidden md:table">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className={th}>Complaint</TableHead>
                <TableHead className={th}>Customer</TableHead>
                <TableHead className={th}>Product</TableHead>
                <TableHead className={`${th} text-right`}>Claim</TableHead>
                <TableHead className={th}>Stage</TableHead>
                <TableHead className={th}>Department</TableHead>
                <TableHead className={th}>TAT</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} className="group/row relative border-border hover:bg-accent/40">
                  <TableCell className="px-3 py-2.5 align-top">
                    <Link href={`/cn/${c.id}`} className="num text-[13px] font-semibold text-foreground after:absolute after:inset-0 after:content-['']">{c.complaint_no}</Link>
                    <div className="mt-0.5 text-[12px] text-tertiary-foreground">{dmy(c.complaint_date)}</div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5 align-top">
                    <div className="text-[13px] font-medium">{c.customer_name}</div>
                    <div className="mt-0.5 text-[12px] text-tertiary-foreground">Inv. {c.invoice_no}</div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5 align-top">
                    <div className="max-w-64 truncate text-[13px]">{c.product_name}</div>
                    <div className="mt-0.5 text-[12px] text-tertiary-foreground">{c.category}</div>
                  </TableCell>
                  <TableCell className="num px-3 py-2.5 text-right align-top text-[13px] font-medium">{rupees(c.claim_value)}</TableCell>
                  <TableCell className="px-3 py-2.5 align-top"><StagePill stage={c.stage} /></TableCell>
                  <TableCell className="px-3 py-2.5 align-top text-[13px]">{c.department ?? <span className="text-tertiary-foreground">—</span>}</TableCell>
                  <TableCell className="px-3 py-2.5 align-top"><TatPill c={c} today={today} /></TableCell>
                  <TableCell className="px-2 py-2.5 align-top text-tertiary-foreground">
                    <ChevronRight className="size-4 transition-transform group-hover/row:translate-x-0.5" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Panel>
  );
}
