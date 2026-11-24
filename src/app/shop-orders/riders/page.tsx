import Link from "next/link";
import { cookies } from "next/headers";
import { Bike } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { RiderActions } from "@/components/shop/RiderAdmin";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Row {
  id: number; name: string; phone: string; kind: string; vehicle_no: string | null; active: boolean; location_at: Date | null; open_orders: number; delivered: number;
  pay_per_delivery: number; earned_month: number; rating: number | null; ratings: number; km_today: number; km_month: number;
  /** transporters: the trip they are on or have next, and this month's trips and stops */
  trip: { id: number; route: string; status: string; date: string; stops: number; done: number } | null;
  trips_month: number; stops_month: number; delivered_month: number; created_at: Date;
}

type Kind = "all" | "delivery" | "transporter";

const ago = (d: Date | null) => {
  if (!d) return "never";
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export default async function RidersPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const sp = await searchParams;
  const kind: Kind = sp.kind === "transporter" || sp.kind === "delivery" ? sp.kind : "all";
  const [riders, me] = await Promise.all([
    query<Row>(`select r.id, r.name, r.phone, r.kind, r.vehicle_no, r.active, r.location_at, r.pay_per_delivery, r.created_at,
        (select json_build_object('id', t.id, 'route', t.route_name, 'status', t.status, 'date', t.trip_date::text,
                                  'stops', (select count(*)::int from dist_trip_stop s where s.trip_id = t.id),
                                  'done', (select count(*)::int from dist_trip_stop s where s.trip_id = t.id and s.status <> 'pending'))
           from dist_trip t where t.transporter_id = r.id and t.status in ('planned', 'on_the_way')
          order by (t.status = 'on_the_way') desc, t.trip_date, t.id limit 1) as trip,
        (select count(*)::int from dist_trip t where t.transporter_id = r.id and t.status <> 'cancelled'
            and t.trip_date >= date_trunc('month', now() at time zone 'Asia/Kolkata')::date) as trips_month,
        (select count(*)::int from dist_trip_stop s join dist_trip t on t.id = s.trip_id where t.transporter_id = r.id and t.status <> 'cancelled'
            and t.trip_date >= date_trunc('month', now() at time zone 'Asia/Kolkata')::date) as stops_month,
        (select count(*)::int from dist_trip_stop s join dist_trip t on t.id = s.trip_id where t.transporter_id = r.id and s.status = 'delivered'
            and t.trip_date >= date_trunc('month', now() at time zone 'Asia/Kolkata')::date) as delivered_month,
        (select round(avg(o.rider_rating)::numeric, 1)::float from shop_order o where o.rider_id = r.id and o.rider_rating is not null) as rating,
        (select count(o.rider_rating)::int from shop_order o where o.rider_id = r.id) as ratings,
        (select coalesce(sum(k.metres), 0)::float / 1000 from shop_rider_km k where k.rider_id = r.id and k.day = (now() at time zone 'Asia/Kolkata')::date) as km_today,
        (select coalesce(sum(k.metres), 0)::float / 1000 from shop_rider_km k where k.rider_id = r.id and k.day >= date_trunc('month', now() at time zone 'Asia/Kolkata')::date) as km_month,
        (select coalesce(sum(o.rider_pay), 0) from shop_order o where o.rider_id = r.id and o.status = 'delivered'
            and o.delivered_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as earned_month,
        (select count(*)::int from shop_order o where o.rider_id = r.id and o.status in ('confirmed', 'out_for_delivery')) as open_orders,
        (select count(*)::int from shop_order o where o.rider_id = r.id and o.status = 'delivered') as delivered
      from shop_rider r where ($1::text = 'all' or r.kind = $1) order by r.active desc, r.name`, [kind]),
    userFromToken((await cookies()).get("session")?.value),
  ]);
  const canEdit = !!me && atLeast(levelFor(me, "shop"), "edit");
  const chip = (k: Kind, label: string) => (
    <Link href={k === "all" ? "/shop-orders/riders" : `/shop-orders/riders?kind=${k}`}
      className={`inline-flex h-8 items-center rounded-full border px-3 text-sm ${kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>{label}</Link>
  );
  const tripWord = (t: NonNullable<Row["trip"]>) => (t.status === "on_the_way" ? `On the road · ${t.done}/${t.stops} stops done` : `Planned for ${t.date} · ${t.stops} ${t.stops === 1 ? "stop" : "stops"}`);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Bike}
          title={kind === "transporter" ? "Transporters" : kind === "delivery" ? "Delivery boys" : "Delivery riders & transporters"}
          subtitle={kind === "transporter"
            ? "Every transporter account: transporters sign up themselves in the Gaia Delivery Partner app, then sign in as Transporter with their mobile number and PIN, and run the trips given to them on the Dispatch page - distributors' and retailers' orders, route by route from the plant."
            : "Both sign up themselves in the Gaia Delivery Partner app, choosing Delivery Boy or Transporter, then sign in with their mobile number and PIN. Delivery boys get D2C orders; set pay is what one delivery earns them. Transporters carry distributors' orders route by route."}
          actions={<Link href="/shop-orders/live" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Live map</Link>}
        />
        <div className="flex flex-wrap gap-1.5">{chip("all", "All")}{chip("delivery", "Delivery boys")}{chip("transporter", "Transporters")}</div>
        {kind === "transporter" ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>{["Transporter", "Vehicle no.", "Mobile", "Trip now", "Trips this month", "Stops this month", "Delivered", "Km today", "Km this month", "Last seen", "Added", "Status", ""].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {riders.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium"><Link href={`/shop-orders/riders/${r.id}`} className="text-primary hover:underline">{r.name}</Link></td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.vehicle_no ?? ""}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.phone}</td>
                    <td className="px-3 py-2">{r.trip ? <Link href={`/app-orders/dispatch/${r.trip.id}`} className="hover:underline"><span className="font-medium">{r.trip.route}</span><div className="text-xs text-muted-foreground">{tripWord(r.trip)}</div></Link> : <span className="text-muted-foreground">Free</span>}</td>
                    <td className="num px-3 py-2">{r.trips_month}</td>
                    <td className="num px-3 py-2">{r.stops_month}</td>
                    <td className="num px-3 py-2">{r.delivered_month}</td>
                    <td className="num px-3 py-2">{Number(r.km_today).toFixed(1)}</td>
                    <td className="num px-3 py-2">{Number(r.km_month).toFixed(1)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{ago(r.location_at)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="px-3 py-2">{r.active ? "Active" : "Inactive"}</td>
                    <td className="px-3 py-2">{canEdit ? <RiderActions id={r.id} active={r.active} pay={Number(r.pay_per_delivery)} /> : null}</td>
                  </tr>
                ))}
                {riders.length === 0 ? <tr><td colSpan={13} className="px-3 py-10 text-center text-muted-foreground">No transporters yet. They join by downloading the Gaia Delivery Partner app and signing up as Transporter.</td></tr> : null}
              </tbody>
            </table>
          </div>
        ) : (
        <>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>{["Partner", "Type", "Mobile", "To deliver", "Delivered", "Rating", "Km today", "Km this month", "Pay / delivery", "Earned this month", "Last seen", "Status", ""].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {riders.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/shop-orders/riders/${r.id}`} className="text-primary hover:underline">{r.name}</Link>
                    <div className="text-xs font-normal text-muted-foreground">Route today →</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{r.kind === "transporter" ? <>Transporter{r.vehicle_no ? <span className="ml-1 font-mono text-xs text-muted-foreground">{r.vehicle_no}</span> : null}</> : "Delivery boy"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.phone}</td>
                  <td className="num px-3 py-2">{r.open_orders}</td>
                  <td className="num px-3 py-2">{r.delivered}</td>
                  <td className="num whitespace-nowrap px-3 py-2">{r.rating == null ? <span className="text-muted-foreground">—</span> : <>★ {r.rating.toFixed(1)} <span className="text-xs text-muted-foreground">({r.ratings})</span></>}</td>
                  <td className="num px-3 py-2">{Number(r.km_today).toFixed(1)}</td>
                  <td className="num px-3 py-2">{Number(r.km_month).toFixed(1)}</td>
                  <td className="num px-3 py-2">₹{Number(r.pay_per_delivery).toLocaleString("en-IN")}</td>
                  <td className="num px-3 py-2">₹{Number(r.earned_month).toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2 text-muted-foreground">{ago(r.location_at)}</td>
                  <td className="px-3 py-2">{r.active ? "Active" : "Inactive"}</td>
                  <td className="px-3 py-2">{canEdit ? <RiderActions id={r.id} active={r.active} pay={Number(r.pay_per_delivery)} /> : null}</td>
                </tr>
              ))}
              {riders.length === 0 ? <tr><td colSpan={13} className="px-3 py-10 text-center text-muted-foreground">No partners yet. Delivery boys and transporters join by downloading the Gaia Delivery Partner app and signing up.</td></tr> : null}
            </tbody>
          </table>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
