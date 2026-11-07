import { redirect } from "next/navigation";

/** D2C orders live on one page, /shop-orders (app and online shop together); old links land there. */
export default async function D2cOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  const p = new URLSearchParams();
  if (status) p.set("status", status);
  if (q) p.set("q", q);
  redirect(p.size ? `/shop-orders?${p}` : "/shop-orders");
}
