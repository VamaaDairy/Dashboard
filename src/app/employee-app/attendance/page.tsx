import { Fingerprint } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tiles } from "@/components/dash/Dash";
import { today } from "@/lib/dates";
import { attendanceOn } from "@/lib/employee/admin";
import { btnGhost, clock, field, Page, Pill, Table } from "../ui";

export const dynamic = "force-dynamic";

const METHOD: Record<string, string> = { biometric: "Biometric", app: "App", sales_day: "Sales day", office: "Office" };

/** Who punched in and out on a day, from the app. */
export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today();
  const rows = await attendanceOn(date);
  const present = rows.filter((r) => r.inAt), leave = rows.filter((r) => !r.inAt && r.onLeave), absent = rows.filter((r) => !r.inAt && !r.onLeave);
  return (
    <Page>
      <PageHeader icon={Fingerprint} title="Attendance" subtitle="Punches from the app: biometric (fingerprint / face unlock on the phone) or plain, with the phone's location. Starting the sales day also punches in." />
      <form className="flex items-center gap-2 text-sm">
        <input type="date" name="date" defaultValue={date} className={`${field} w-44`} /><button className={btnGhost}>Show</button>
      </form>
      <Tiles items={[
        { label: "On the app", value: String(rows.length) }, { label: "Present", value: String(present.length) },
        { label: "On leave", value: String(leave.length) }, { label: "Not punched", value: String(absent.length) },
        { label: "Late (after 10:15)", value: String(present.filter((r) => r.late).length) },
      ]} />
      <Table head={["Employee", "Designation", "In", "Out", "Hours", "How", "Site", "Status"]} cols={8} empty={rows.length ? undefined : "No one has signed in to the app yet."}>
        {rows.map((r) => (
          <tr key={r.uid} className="border-t border-border">
            <td className="px-3 py-2"><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.code ?? ""}</div></td>
            <td className="px-3 py-2 text-muted-foreground">{r.designation ?? "—"}</td>
            <td className="px-3 py-2">{clock(r.inAt)}{r.late ? <span className="ml-1 text-xs text-amber-700">late</span> : null}</td>
            <td className="px-3 py-2">{clock(r.outAt)}</td>
            <td className="px-3 py-2">{r.hours ?? "—"}</td>
            <td className="px-3 py-2">{r.method ? METHOD[r.method] ?? r.method : "—"}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.site ?? "—"}</td>
            <td className="px-3 py-2">{r.inAt ? <Pill status="approved" label={r.outAt ? "Present" : "In"} /> : r.onLeave ? <Pill status="in_progress" label="On leave" /> : <Pill status="pending" label="Not punched" />}</td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}
