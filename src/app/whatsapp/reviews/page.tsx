import Link from "next/link";
import { Star } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { listReviews } from "@/lib/whatsapp/store";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const reviews = await listReviews();
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const counts = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length }));

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader icon={Star} title="Reviews" subtitle="Ratings and feedback customers left on WhatsApp after delivery." />

        <div className="flex flex-wrap gap-4">
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <div className="text-xs text-muted-foreground">Average rating</div>
            <div className="text-3xl font-semibold">{avg ? avg.toFixed(1) : "—"} <span className="text-lg text-amber-500">★</span></div>
            <div className="text-xs text-muted-foreground">{reviews.length} review{reviews.length === 1 ? "" : "s"}</div>
          </div>
          <div className="min-w-64 flex-1 space-y-1 rounded-xl border border-border bg-card px-5 py-4">
            {counts.map(({ n, c }) => (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-6">{n}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${reviews.length ? (c / reviews.length) * 100 : 0}%` }} />
                </div>
                <span className="num w-8 text-right text-muted-foreground">{c}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {reviews.length ? (
            <div className="divide-y divide-border">
              {reviews.map((r) => (
                <div key={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3">
                  <div className="w-24 text-amber-500">{"★".repeat(r.rating)}<span className="text-muted-foreground/30">{"★".repeat(5 - r.rating)}</span></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{r.comment || <span className="text-muted-foreground">No comment</span>}</p>
                    <p className="text-xs text-muted-foreground">
                      <Link href={`/whatsapp/chats?c=${r.wa_id}`} className="hover:underline">{r.name || `+${r.wa_id}`}</Link>
                      {r.order_no ? <> · <Link href={`/whatsapp/orders?o=${r.order_id}`} className="hover:underline">{r.order_no}</Link></> : null}
                      {" · "}{new Date(r.created_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="p-6 text-center text-sm text-muted-foreground">No reviews yet. Customers are asked for one when you mark their order delivered.</p>}
        </div>
      </div>
    </div>
  );
}
