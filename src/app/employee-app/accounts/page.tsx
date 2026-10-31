import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { listLogins, listSignups, listSites, staffOptions } from "@/lib/employee/admin";
import { addSiteAction, approveSignupAction, rejectSignupAction, removeSiteAction, toggleLoginAction } from "../actions";
import { btn, btnDanger, btnGhost, Card, field, Flash, Page, Pill, Table, when } from "../ui";

export const dynamic = "force-dynamic";

/** Account requests from the app, who has a login, and the sites punches are checked against. */
export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  const sp = await searchParams;
  const [signups, logins, sites, staff] = await Promise.all([listSignups(), listLogins(), listSites(), staffOptions(true)]);
  const pending = signups.filter((s) => s.status === "pending");
  return (
    <Page>
      <PageHeader icon={UserPlus} title="Accounts & sites" subtitle="People sign in to the app with their mobile number and a code. A number already on a staff record needs nothing here; a new number is a request you approve." />
      <Flash err={sp.err} ok={sp.ok} />

      <Card title={`Account requests (${pending.length} waiting)`}>
        {signups.length === 0 ? <p className="text-sm text-muted-foreground">No one has asked for an account.</p> : (
          <div className="space-y-3">
            {signups.slice(0, 40).map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{s.name}</b> <span className="font-mono text-xs">{s.phone}</span>
                  {s.email ? <span className="text-muted-foreground">{s.email}</span> : null}
                  {s.department ? <span className="text-muted-foreground">· {s.department}</span> : null}
                  <Pill status={s.status} /> <span className="text-xs text-muted-foreground">{when(s.createdAt)}</span>
                  {s.staffName ? <span className="text-xs text-muted-foreground">→ {s.staffName}</span> : null}
                </div>
                {s.status === "pending" ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_1fr_auto]">
                    <form action={approveSignupAction} className="contents">
                      <input type="hidden" name="id" value={s.id} />
                      <select name="staffUid" defaultValue="" className={field} required>
                        <option value="" disabled>This is employee… (staff master)</option>
                        {staff.map((o) => <option key={o.uid} value={o.uid}>{o.name}{o.code ? ` · ${o.code}` : ""}{o.designation ? ` · ${o.designation}` : ""}</option>)}
                      </select>
                      <button className={btn}>Approve</button>
                    </form>
                    <form action={rejectSignupAction} className="contents">
                      <input type="hidden" name="id" value={s.id} />
                      <input name="remark" placeholder="Reason (optional)" className={field} />
                      <button className={btnDanger}>Reject</button>
                    </form>
                  </div>
                ) : s.remark ? <p className="mt-1 text-xs text-muted-foreground">{s.remark}</p> : null}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">A new employee must exist in the staff master first (it carries their designation, manager and routes). Approving links this number to that person.</p>
      </Card>

      <Card title={`Signed-in employees (${logins.length})`}>
        <Table head={["Employee", "Code", "Mobile", "Last sign-in", "Phone", ""]} cols={6} empty={logins.length ? undefined : "No one has signed in yet."}>
          {logins.map((l) => (
            <tr key={l.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{l.name}</td>
              <td className="px-3 py-2 text-muted-foreground">{l.code ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-xs">{l.phone}</td>
              <td className="px-3 py-2 text-muted-foreground">{when(l.lastLogin)}</td>
              <td className="px-3 py-2 text-muted-foreground">{l.device ?? "—"}</td>
              <td className="px-3 py-2 text-right">
                <form action={toggleLoginAction}>
                  <input type="hidden" name="id" value={l.id} /><input type="hidden" name="active" value={l.active ? "0" : "1"} />
                  <button className={l.active ? btnGhost : btn}>{l.active ? "Switch off" : "Switch on"}</button>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Punch sites (plants, offices, depots)">
        <p className="mb-3 text-xs text-muted-foreground">Once a site is added, office staff can punch in only within its radius. Sales and field staff can punch from wherever they work. With no sites, everyone punches from anywhere.</p>
        <Table head={["Site", "Latitude", "Longitude", "Radius (m)", ""]} cols={5} empty={sites.length ? undefined : "No sites yet - punches are not location-checked."}>
          {sites.map((s) => (
            <tr key={s.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{s.name}</td><td className="px-3 py-2">{s.lat}</td><td className="px-3 py-2">{s.lng}</td><td className="px-3 py-2">{s.radiusM}</td>
              <td className="px-3 py-2 text-right"><form action={removeSiteAction}><input type="hidden" name="id" value={s.id} /><button className={btnDanger}>Remove</button></form></td>
            </tr>
          ))}
        </Table>
        <form action={addSiteAction} className="mt-3 grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <input name="name" placeholder="Site name" className={field} required />
          <input name="lat" placeholder="Latitude" inputMode="decimal" className={field} required />
          <input name="lng" placeholder="Longitude" inputMode="decimal" className={field} required />
          <input name="radius" placeholder="Radius m (300)" inputMode="numeric" className={field} />
          <button className={btn}>Add site</button>
        </form>
      </Card>
    </Page>
  );
}
