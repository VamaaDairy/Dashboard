import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { today } from "@/lib/dates";
import { listPayslipRows, staffOptions } from "@/lib/employee/admin";
import { deletePayslipAction, importPayslipsAction, savePayslipAction } from "../actions";
import { area, btn, btnDanger, btnGhost, Card, field, Flash, Page, Table, rs } from "../ui";

export const dynamic = "force-dynamic";

const thisMonth = () => today().slice(0, 7);

/** Salary slips: one at a time, or a whole month from a spreadsheet saved as CSV. */
export default async function PayslipsPage({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string; month?: string }> }) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : thisMonth();
  const [rows, staff] = await Promise.all([listPayslipRows(month), staffOptions(false)]);
  return (
    <Page>
      <PageHeader icon={Wallet} title="Salary slips" subtitle="Published slips show in each employee's app under Pay. Saving one for the same month again replaces it." />
      <Flash err={sp.err} ok={sp.ok} />
      <form className="flex items-center gap-2 text-sm">
        <span>Month</span><input type="month" name="month" defaultValue={month} className={`${field} w-44`} /><button className={btnGhost}>Show</button>
      </form>
      <Table head={["Employee", "Code", "Gross", "Deductions", "Net pay", ""]} cols={6} empty={rows.length ? undefined : "No slips for this month yet."}>
        {rows.map((p) => (
          <tr key={p.id} className="border-t border-border">
            <td className="px-3 py-2 font-medium">{p.name}</td><td className="px-3 py-2 text-muted-foreground">{p.code ?? "—"}</td>
            <td className="px-3 py-2">{rs(p.gross)}</td><td className="px-3 py-2">{rs(p.totalDeductions)}</td><td className="px-3 py-2 font-semibold">{rs(p.net)}</td>
            <td className="px-3 py-2 text-right"><form action={deletePayslipAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="month" value={month} /><button className={btnDanger}>Delete</button></form></td>
          </tr>
        ))}
      </Table>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Add one salary slip">
          <form action={savePayslipAction} className="grid gap-2">
            <select name="staffUid" className={field} defaultValue="" required>
              <option value="" disabled>Employee</option>
              {staff.map((s) => <option key={s.uid} value={s.uid}>{s.name}{s.code ? ` · ${s.code}` : ""}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <input type="month" name="month" defaultValue={month} className={field} required />
              <input name="daysInMonth" placeholder="Days in month" inputMode="decimal" className={field} />
              <input name="daysPaid" placeholder="Days paid" inputMode="decimal" className={field} />
            </div>
            <textarea name="earnings" rows={4} placeholder={"Earnings, one per line\nBasic: 20000\nHRA: 8000"} className={area} required />
            <textarea name="deductions" rows={3} placeholder={"Deductions, one per line\nPF: 1800\nProfessional tax: 200"} className={area} />
            <input name="note" placeholder="Note on the slip (optional)" className={field} />
            <button className={btn}>Save slip</button>
          </form>
        </Card>
        <Card title="Import a month from CSV">
          <form action={importPayslipsAction} className="grid gap-2">
            <input type="file" name="file" accept=".csv,text/csv" className="text-sm" required />
            <button className={btn}>Import</button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            First row = headings: <code>employee_code, month, days_in_month, days_paid</code>, then each earning as <code>E:Basic</code>, <code>E:HRA</code> … and each deduction as <code>D:PF</code>, <code>D:TDS</code> …
            Month is like <code>2026-10</code>; employee_code is the code in the staff master. Rows with a problem are skipped and listed.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-2 text-xs">{`employee_code,month,days_in_month,days_paid,E:Basic,E:HRA,D:PF\nG-0042,${month},31,31,20000,8000,1800`}</pre>
        </Card>
      </div>
    </Page>
  );
}
