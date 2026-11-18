import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Pencil, Phone, Store } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Panel, Pill } from "@/components/cn/ui";
import { Field } from "@/app/app-orders/parts";
import { CUSTOMER_KINDS, firmOrders, firmProfile, servedFirms } from "@/lib/customers";

export const dynamic = "force-dynamic";

const rs = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const LOGIN: Record<string, string> = { distributor: "Distributor app", retailer: "Retailer app", salesman: "Sales officer" };

/** One distributor or retailer: who they are, where, who serves them, their app login, prices and orders. */
export default async function FirmProfilePage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const f = await firmProfile(uid);
  if (!f) notFound();
  // anyone but a retailer can serve others: a super stockist its distributors, a distributor its retailers ...
  const [orders, served] = await Promise.all([firmOrders(uid), f.kind !== "retailers" ? servedFirms(uid) : Promise.resolve([])]);
  const kind = CUSTOMER_KINDS.find((k) => k.key === f.kind);
  const map = f.lat && f.lng ? `https://www.google.com/maps/search/?api=1&query=${f.lat},${f.lng}` : null;
  const ordered = orders.reduce((s, o) => s + o.total, 0);
  const orderHref = (o: { uid: string }) => `/app-orders/${f.kind === "retailers" ? "retailers" : "distributors"}/${o.uid}`;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Store}
          title={f.name}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              {kind ? <Pill tone="brand">{kind.one}</Pill> : f.channel ? <Pill>{f.channel}</Pill> : null}
              {f.active ? <Pill tone="success">Active</Pill> : <Pill>Inactive</Pill>}
              {f.code ? <span className="font-mono text-xs">{f.code}</span> : null}
              {f.city ? <span>{f.city}</span> : null}
            </span>
          }
          actions={
            <div className="flex gap-2">
              <Link href={`/customers/${f.kind ?? "distributors"}`} className={buttonVariants({ variant: "outline" })}><ArrowLeft className="size-4" /> {kind?.label ?? "Customers"}</Link>
              <Link href={`/orders/distribution/${f.uid}`} className={buttonVariants({ variant: "outline" })}><Pencil className="size-4" /> Edit</Link>
            </div>
          }
        />

        <div className="grid items-start gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          <Panel title="Contact" flush>
            <dl className="divide-y divide-border">
              <Field label="Contact person">{f.contactPerson}</Field>
              <Field label="Mobile">{f.phone ? <a href={`tel:${f.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="size-3.5" /> {f.phone}</a> : null}</Field>
              <Field label="Landline">{f.landline}</Field>
              <Field label="Email">{f.email}</Field>
              <Field label="Address">{[f.address, f.area].filter(Boolean).join(", ") || null}</Field>
              <Field label="City / district">{[f.city, f.district].filter(Boolean).join(" / ") || null}</Field>
              <Field label="State / PIN">{[f.state, f.pincode].filter(Boolean).join(" - ") || null}</Field>
              <Field label="Location">{map ? <a href={map} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><MapPin className="size-3.5" /> Open in Google Maps</a> : <span className="text-muted-foreground">No pin</span>}</Field>
            </dl>
          </Panel>

          <Panel title="Business" flush>
            <dl className="divide-y divide-border">
              <Field label="Channel">{f.channel}</Field>
              <Field label="Type / class">{[f.type, f.class].filter(Boolean).join(" / ") || null}</Field>
              <Field label="GSTIN" mono>{f.gstin}</Field>
              <Field label="PAN" mono>{f.pan}</Field>
              <Field label="Licence no." mono>{f.licenceNo}</Field>
              <Field label="Credit limit">{f.creditLimit ? rs(f.creditLimit) : null}</Field>
              <Field label="ERP code" mono>{f.erpCode}</Field>
              <Field label="In the master since">{f.createdAt ? when(f.createdAt) : null}</Field>
            </dl>
          </Panel>

          <Panel title="Sales & access" flush>
            <dl className="divide-y divide-border">
              <Field label="Served by">{f.servedBy ? <Link href={`/customers/firm/${f.servedBy.uid}`} className="text-primary hover:underline">{f.servedBy.name}</Link> : null}</Field>
              <Field label="Route (beat)">{f.route}</Field>
              <Field label="Sales officer">{f.salesOfficer ? `${f.salesOfficer}${f.salesOfficerPhone ? ` · ${f.salesOfficerPhone}` : ""}` : null}</Field>
              <Field label="Price list">{f.priceList ? <Link href="/price-list" className="text-primary hover:underline">{f.priceList}</Link> : "Standard prices"}</Field>
              <Field label="App login">
                {f.logins.length ? f.logins.map((l) => (
                  <div key={l.phone}>{LOGIN[l.kind] ?? l.kind} · <span className="font-mono text-xs">{l.phone}</span> {l.active ? null : <Pill className="ml-1">Off</Pill>}</div>
                )) : <span className="text-muted-foreground">No login yet</span>}
              </Field>
              <Field label="Route orders">
                {f.routeParty ? <Link href="/route-orders/masters" className="text-primary hover:underline">{f.routeParty.name}{f.routeParty.route ? ` · ${f.routeParty.route}` : ""}</Link> : <span className="text-muted-foreground">Not linked</span>}
              </Field>
              <Field label="Tally ledger">{f.routeParty?.tallyLedger}</Field>
            </dl>
          </Panel>
        </div>

        {f.kind !== "retailers" && (served.length || f.kind === "distributors" || f.kind === "super-stockists") ? (
          <Panel title={`Customers served · ${served.length}`} flush>
            {served.length ? (
              <ul className="divide-y divide-border text-sm">
                {served.map((s) => (
                  <li key={s.uid} className="flex items-center justify-between gap-3 px-4 py-2">
                    <Link href={`/customers/firm/${s.uid}`} className="font-medium text-primary hover:underline">{s.name}</Link>
                    <span className="text-xs text-muted-foreground">{[s.code, s.city].filter(Boolean).join(" · ")} {s.active ? null : <Pill className="ml-1">Inactive</Pill>}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 py-5 text-center text-sm text-muted-foreground">No customer is mapped to this one yet.</p>}
          </Panel>
        ) : null}

        <Panel title={`Orders · ${orders.length}`} description={orders.length ? `${rs(ordered)} in the last ${orders.length} order${orders.length === 1 ? "" : "s"}` : undefined} flush>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>{["Order", "Placed", "Via", "Items", "Qty", "Value", "Status"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.uid} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-2"><Link href={orderHref(o)} className="font-mono text-xs font-semibold text-primary hover:underline">{o.orderId ?? o.uid.slice(0, 8)}</Link></td>
                    <td className="whitespace-nowrap px-4 py-2">{when(o.at)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{o.appKind ? LOGIN[o.appKind] ?? o.appKind : "Portal"}</td>
                    <td className="num px-4 py-2 text-right">{o.items}</td>
                    <td className="num px-4 py-2 text-right">{o.qty}</td>
                    <td className="num px-4 py-2 text-right">{rs(o.total)}</td>
                    <td className="px-4 py-2"><Pill>{o.status}</Pill></td>
                  </tr>
                ))}
                {orders.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No orders yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
