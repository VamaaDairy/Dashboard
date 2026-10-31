import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tiles } from "@/components/dash/Dash";
import { overview } from "@/lib/employee/admin";
import { Page, rs } from "./ui";

export const dynamic = "force-dynamic";

/** Gaia Salesforce staff app: what needs the office's attention today. */
export default async function EmployeeAppPage() {
  const o = await overview();
  const todo = [
    { n: o.signups, label: "account requests to approve", href: "/employee-app/accounts" },
    { n: o.leaves, label: "leave requests to decide", href: "/employee-app/leaves" },
    { n: o.claims, label: `reimbursement claims to review (${rs(o.claimAmount)})`, href: "/employee-app/claims" },
    { n: o.toPay, label: "approved claims waiting to be paid", href: "/employee-app/claims?show=approved" },
    { n: o.requests, label: "employee requests open", href: "/employee-app/requests" },
  ];
  return (
    <Page>
      <PageHeader icon={Users} title="Employee app" subtitle="The Gaia Salesforce app for every employee: attendance, leave, reimbursements, notices, salary slips, requests and live field movement." />
      <Tiles
        items={[
          { label: "Employees with the app", value: String(o.accounts) },
          { label: "Punched in today", value: String(o.punchedToday), note: `${o.stillIn} still in` },
          { label: "On the field now", value: String(o.fieldOn), note: "sales day running" },
          { label: "Leave to decide", value: String(o.leaves) },
          { label: "Claims to review", value: String(o.claims), note: rs(o.claimAmount) },
          { label: "Requests open", value: String(o.requests) },
        ]}
      />
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Needs attention</div>
        <ul className="divide-y divide-border text-sm">
          {todo.filter((t) => t.n > 0).map((t) => (
            <li key={t.label}><Link href={t.href} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"><span><b>{t.n}</b> {t.label}</span><span className="text-primary">Open →</span></Link></li>
          ))}
          {todo.every((t) => t.n === 0) ? <li className="px-4 py-8 text-center text-muted-foreground">Nothing waiting.</li> : null}
        </ul>
      </div>
    </Page>
  );
}
