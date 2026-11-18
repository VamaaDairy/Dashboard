import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { buttonVariants } from "@/components/ui/button";
import {
  A, Account, Breakdown, Card, Chain, Details, Empty, Facts, Header, History, Layout, MonthBars, Stats, Table, Tabs, Tag,
  ago, day, rs, rsShort, td, tdNum, when,
} from "@/components/profile/parts";
import { userFromToken } from "@/lib/access-server";
import { CUSTOMER_KINDS, firmOrders, firmProfile, servedFirms } from "@/lib/customers";
import { firmExtras, type FirmExtras } from "@/lib/profiles";

export const dynamic = "force-dynamic";

const LOGIN: Record<string, string> = { distributor: "Distributor app", retailer: "Retailer app", salesman: "Sales officer" };
const TABS = ["overview", "sales", "network", "accounts", "history"] as const;
type Tab = (typeof TABS)[number];

/**
 * One customer (super stockist, distributor, MFS, institution, parlour or retailer), laid out like a detail page:
 * header and key numbers, then activity in tabs (overview, orders and money, network, accounts and records,
 * history) beside a column with their contact, business and sales details.
 */
export default async function FirmProfilePage({ params, searchParams }: { params: Promise<{ uid: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { uid } = await params;
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";
  const f = await firmProfile(uid);
  if (!f) notFound();
  const me = await userFromToken((await cookies()).get("session")?.value);
  const [orders, served, x] = await Promise.all([
    firmOrders(uid),
    f.kind !== "retailers" ? servedFirms(uid) : Promise.resolve([]),
    firmExtras(uid, { name: f.name, phone: f.phone, tallyLedger: f.routeParty?.tallyLedger ?? null }),
  ]);
  const kind = CUSTOMER_KINDS.find((k) => k.key === f.kind);
  const map = f.lat && f.lng ? `https://www.google.com/maps/search/?api=1&query=${f.lat},${f.lng}` : null;
  const orderHref = (o: { uid: string }) => `/app-orders/${f.kind === "retailers" ? "retailers" : "distributors"}/${o.uid}`;
  const base = `/customers/firm/${f.uid}`;
  const serves = f.kind !== "retailers";
  const records = f.logins.length + (f.routeParty ? 1 : 0) + x.sameMobile.d2c.length + x.sameMobile.whatsapp.length + x.sameMobile.firms.length + x.creditNotes.length + x.complaints.length;
  const owes = x.tally?.balance ?? (x.ledger.entries.length ? x.ledger.balance : null);
  const chain = x.chain.map((c) => ({ href: `/customers/firm/${c.uid}`, name: c.name, sub: c.kind }));

  const ordersTable = (list: typeof orders) => list.length ? (
    <Table head={["Order", "Placed", "Via", "Items", "Qty", "Value", "Status"]} right={[3, 4, 5]}>
      {list.map((o) => (
        <tr key={o.uid}>
          <td className={td}><A href={orderHref(o)} className="font-mono text-[12px]">{o.orderId ?? o.uid.slice(0, 8)}</A></td>
          <td className={`${td} whitespace-nowrap text-foreground/70`}>{when(o.at)}</td>
          <td className={`${td} text-foreground/70`}>{o.appKind ? LOGIN[o.appKind] ?? o.appKind : "Portal"}</td>
          <td className={tdNum}>{o.items}</td>
          <td className={tdNum}>{o.qty}</td>
          <td className={tdNum}>{rs(o.total)}</td>
          <td className={`${td} text-foreground/70`}>{o.status}</td>
        </tr>
      ))}
    </Table>
  ) : <Empty>No orders yet.</Empty>;

  const main = (
    <>
      <Tabs base={base} on={tab} tabs={[
        { key: "overview", label: "Overview" },
        { key: "sales", label: "Orders & money", count: x.stats.orders },
        { key: "network", label: serves ? "Network" : "Served by", count: serves ? x.network.total : undefined },
        { key: "accounts", label: "Accounts & records", count: records },
        { key: "history", label: "History", count: x.history.length },
      ]} />

      {tab === "overview" ? (
        <>
          <Card title="Orders" note={`Last 12 months · ${rs(x.stats.value)} across ${x.stats.orders} orders in all`}><MonthBars months={x.monthly} /></Card>
          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
            <Card title="Top products" note="By order value, all time"><Products rows={x.products} /></Card>
            <Card title="Served by"><Chain above={chain} self={{ name: f.name, sub: kind?.one ?? f.channel }} empty="Buys directly from Gaia." /></Card>
          </div>
          <Card title="Latest orders">{ordersTable(orders.slice(0, 5))}</Card>
        </>
      ) : null}

      {tab === "sales" ? (
        <>
          <Card title="Orders by month" note="Last 12 months"><MonthBars months={x.monthly} /></Card>
          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
            <Card title="Summary">
              <Facts rows={[
                ["Orders placed", `${x.stats.orders.toLocaleString("en-IN")} · ${rs(x.stats.value)}`],
                ["Last 90 days", `${x.stats.orders90} · ${rs(x.stats.value90)}`],
                ["Average order", x.stats.orders ? rs(x.stats.value / x.stats.orders) : null],
                ["First order", day(x.stats.first)],
                ["Last order", x.stats.last ? `${day(x.stats.last)} (${ago(x.stats.last)})` : null],
                ["Orders received", serves && x.received.orders ? `${x.received.orders.toLocaleString("en-IN")} · ${rs(x.received.value)}` : null],
                ["Invoices", x.invoices || null],
              ]} />
            </Card>
            <Card title="Money" note={x.tally ? `Tally ledger: ${x.tally.ledger}` : undefined}>
              <Facts rows={[
                ["Outstanding (Tally)", x.tally ? (x.tally.balance !== null ? rs(x.tally.balance) : x.tally.error) : "No Tally ledger linked"],
                ["App ledger balance", x.ledger.entries.length ? rs(x.ledger.balance) : null],
                ["Credit limit", f.creditLimit ? rs(f.creditLimit) : null],
                ["Price list", f.priceList ?? "Standard prices"],
              ]} />
            </Card>
          </div>
          {x.ledger.entries.length ? (
            <Card title="Ledger" note="Latest entries in the app ledger">
              <Table head={["Date", "Entry", "Reference", "Debit", "Credit"]} right={[3, 4]}>
                {x.ledger.entries.map((l, i) => (
                  <tr key={i}>
                    <td className={`${td} whitespace-nowrap`}>{day(l.date)}</td>
                    <td className={`${td} capitalize`}>{l.kind}</td>
                    <td className={`${td} text-foreground/70`}>{l.ref ?? l.notes ?? "—"}</td>
                    <td className={tdNum}>{l.debit ? rs(l.debit) : ""}</td>
                    <td className={tdNum}>{l.credit ? rs(l.credit) : ""}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          ) : null}
          <Card title="Top products" note="By order value, all time"><Products rows={x.products} /></Card>
          <Card title="Orders" note={orders.length >= 100 ? "Latest 100" : undefined}>{ordersTable(orders)}</Card>
        </>
      ) : null}

      {tab === "network" ? (
        <>
          <Card title="Served by" note="From Gaia down to this customer"><Chain above={chain} self={{ name: f.name, sub: kind?.one ?? f.channel }} empty="Buys directly from Gaia." /></Card>
          {serves ? (
            <>
              <Card title="Customers they serve" note={x.network.total > served.length ? `${served.length} directly · ${x.network.total.toLocaleString("en-IN")} at every level below` : `${served.length} directly`}>
                {served.length ? (
                  <ul className="grid gap-x-10 md:grid-cols-2">
                    {served.map((s) => (
                      <li key={s.uid} className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 text-[13px]">
                        <A href={`/customers/firm/${s.uid}`} className="truncate">{s.name}</A>
                        <span className="shrink-0 text-[12px] text-tertiary-foreground">{[s.city, s.active ? null : "inactive"].filter(Boolean).join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                ) : <Empty>No customer is mapped to this one yet.</Empty>}
              </Card>
              {x.network.byKind.length ? <Card title="By channel"><Breakdown rows={x.network.byKind.map((k) => ({ label: k.kind, n: k.n }))} total={x.network.total} /></Card> : null}
            </>
          ) : null}
        </>
      ) : null}

      {tab === "accounts" ? (
        <>
          <Card title="Logins and accounts" note={f.phone ? `App logins, and anything else on ${f.phone}` : "App logins. No mobile on record, so other accounts can't be matched."}>
            {f.logins.length ? f.logins.map((l) => (
              <Account key={`${l.kind}${l.phone}`} title={LOGIN[l.kind] ?? l.kind} id={l.phone} status={l.active ? "On" : "Off"} meta="Gaia Distributors app" />
            )) : <Account title="Gaia Distributors app" id="No login yet" />}
            <Account title="Route orders party" id={f.routeParty ? f.routeParty.name : "Not linked"} meta={f.routeParty?.route ?? undefined} href={f.routeParty ? "/route-orders/masters" : undefined} />
            <Account title="Tally ledger" id={x.tally?.ledger ?? "Not linked"}
              status={x.tally?.balance != null ? (x.tally.balance > 0 ? `Owes ${rs(x.tally.balance)}` : "Settled") : undefined}
              meta={x.tally?.error ?? undefined} href={x.tally ? "/outstandings" : undefined} />
            {x.sameMobile.d2c.map((c) => (
              <Account key={c.id} title="Gaia app (D2C)" id={c.name} meta={`${c.orders} orders${c.since ? ` · since ${day(c.since)}` : ""}`} href={`/d2c/customers/${c.id}`} />
            ))}
            {x.sameMobile.whatsapp.map((w) => (
              <Account key={w.waId} title="WhatsApp shop" id={w.name ?? w.waId} meta={w.last ? `Last message ${when(w.last)}` : undefined} href="/whatsapp/chats" />
            ))}
            {x.sameMobile.firms.map((o) => (
              <Account key={o.uid} title={`Also a ${o.kind.toLowerCase()} (same mobile)`} id={o.name} meta={o.code ?? undefined} href={`/customers/firm/${o.uid}`} />
            ))}
          </Card>
          <Card title="Credit notes" note="Matched by name or mobile">
            {x.creditNotes.length ? (
              <Table head={["Challan", "Date", "Status"]}>
                {x.creditNotes.map((c) => (
                  <tr key={c.id}>
                    <td className={td}><A href={`/credit-note/${c.id}`} className="font-mono text-[12px]">{c.no ?? "—"}</A></td>
                    <td className={`${td} text-foreground/70`}>{day(c.date)}</td>
                    <td className={`${td} capitalize text-foreground/70`}>{c.status ?? "—"}</td>
                  </tr>
                ))}
              </Table>
            ) : <Empty>No credit notes.</Empty>}
          </Card>
          <Card title="Complaints" note="Matched by name or mobile">
            {x.complaints.length ? (
              <Table head={["Complaint", "Date", "Product", "Claim", "Stage"]} right={[3]}>
                {x.complaints.map((c) => (
                  <tr key={c.id}>
                    <td className={td}><A href={`/cn/${c.id}`} className="font-mono text-[12px]">{c.no ?? "—"}</A></td>
                    <td className={`${td} text-foreground/70`}>{day(c.date)}</td>
                    <td className={td}>{c.product ?? "—"}</td>
                    <td className={tdNum}>{c.value ? rs(c.value) : "—"}</td>
                    <td className={`${td} capitalize text-foreground/70`}>{c.stage ?? "—"}</td>
                  </tr>
                ))}
              </Table>
            ) : <Empty>No complaints.</Empty>}
          </Card>
        </>
      ) : null}

      {tab === "history" ? <Card title="Changes to this record" note="Edits made in the dashboard, newest first"><History rows={x.history} /></Card> : null}
    </>
  );

  const side = (
    <Details groups={[
      { title: "Contact", rows: [
        ["Contact person", f.contactPerson],
        ["Mobile", f.phone ? <a href={`tel:${f.phone}`} className="hover:underline">{f.phone}</a> : null],
        ["Landline", f.landline],
        ["Email", f.email ? <a href={`mailto:${f.email}`} className="hover:underline">{f.email}</a> : null],
        ["Address", [f.address, f.area, f.city, f.district, f.state, f.pincode].filter(Boolean).join(", ")],
        ["Location", map ? <a href={map} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">Open in Google Maps ↗</a> : null],
      ] },
      { title: "Sales", rows: [
        ["Served by", f.servedBy ? <A href={`/customers/firm/${f.servedBy.uid}`}>{f.servedBy.name}</A> : null],
        ["Sales officer", f.salesOfficer ? <>{x.salesOfficerUid ? <A href={`/employees/staff/${x.salesOfficerUid}`}>{f.salesOfficer}</A> : f.salesOfficer}{f.salesOfficerPhone ? <span className="text-tertiary-foreground">, {f.salesOfficerPhone}</span> : null}</> : null],
        ["Route (beat)", f.route],
        ["Price list", f.priceList ?? "Standard prices"],
        ["Route orders", f.routeParty ? `${f.routeParty.name}${f.routeParty.route ? ` · ${f.routeParty.route}` : ""}` : null],
        ["Tally ledger", f.routeParty?.tallyLedger],
      ] },
      { title: "Business", rows: [
        ["Channel", f.channel],
        ["Type / class", [f.type, f.class].filter(Boolean).join(" / ")],
        ["GSTIN", f.gstin, true],
        ["PAN", f.pan, true],
        ["Licence no.", f.licenceNo, true],
        ["Credit limit", f.creditLimit ? rs(f.creditLimit) : null],
        ["ERP code", f.erpCode, true],
        ["Customer since", day(f.createdAt)],
      ] },
    ]} />
  );

  return (
    <div className="flex flex-1 flex-col bg-background px-4 py-6 md:px-10 md:py-8">
      <div className="mx-auto w-full max-w-[1280px] space-y-8">
        <Header
          back={{ href: `/customers/${f.kind ?? "distributors"}`, label: `Customer Master · ${kind?.label ?? "Customers"}` }}
          name={f.name}
          tags={<><Tag strong>{f.active ? "Active" : "Inactive"}</Tag>{kind ? <Tag>{kind.one}</Tag> : f.channel ? <Tag>{f.channel}</Tag> : null}{f.type ? <Tag>{f.type}</Tag> : null}</>}
          line={[f.code, [f.city, f.state].filter(Boolean).join(", "), f.contactPerson, f.phone]}
          actions={<>
            {me?.role === "owner" ? <Link href="/hierarchy?of=customers" className={buttonVariants({ variant: "outline" })}>Hierarchy</Link> : null}
            <Link href={`/orders/distribution/${f.uid}`} className={buttonVariants({ variant: "outline" })}>Edit</Link>
          </>}
        />
        <Stats items={[
          { label: "Ordered, all time", value: rsShort(x.stats.value), note: `${x.stats.orders.toLocaleString("en-IN")} orders` },
          { label: "Last 90 days", value: rsShort(x.stats.value90), note: `${x.stats.orders90} orders` },
          { label: "Last order", value: x.stats.last ? (ago(x.stats.last) ?? "—") : "None", note: day(x.stats.last) ?? undefined },
          serves
            ? { label: "Customers served", value: x.network.total.toLocaleString("en-IN"), note: `${x.network.direct} directly` }
            : { label: "Average order", value: x.stats.orders ? rs(x.stats.value / x.stats.orders) : "—" },
          { label: "Outstanding", value: owes === null ? "—" : rs(owes), note: x.tally ? (x.tally.error ? "Tally not reachable" : "from Tally") : x.ledger.entries.length ? "app ledger" : "no ledger linked" },
        ]} />
        <Layout main={main} side={side} />
      </div>
    </div>
  );
}

function Products({ rows }: { rows: FirmExtras["products"] }) {
  if (!rows.length) return <Empty>No products ordered yet.</Empty>;
  return (
    <Table head={["Product", "Qty", "Orders", "Value"]} right={[1, 2, 3]}>
      {rows.map((r) => (
        <tr key={`${r.sku}${r.name}`}>
          <td className={td}>{r.name}</td>
          <td className={tdNum}>{r.qty.toLocaleString("en-IN")}</td>
          <td className={tdNum}>{r.orders}</td>
          <td className={tdNum}>{rs(r.value)}</td>
        </tr>
      ))}
    </Table>
  );
}
