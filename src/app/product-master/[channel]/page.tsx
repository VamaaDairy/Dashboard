import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ExternalLink, PackageSearch } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { APP_CHANNELS, appList, categoryIcons, isAppChannel, notOnList } from "@/lib/products/app-products";
import { standardPrices } from "@/lib/price-list";
import { ProductList, type Line } from "./list";

export const dynamic = "force-dynamic";

/**
 * Product Master for one app list (D2C, Retail or Distributors): which products that app shows, in what
 * order, under which category, with what name and size. Every change shows in the app on its next refresh.
 */
export default async function ProductMasterPage({ params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params;
  if (!isAppChannel(channel)) notFound();
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, `productmaster.${channel}`), "edit");

  const [{ categories, products }, prices, addable, icons] = await Promise.all([
    appList(channel), standardPrices(), canEdit ? notOnList(channel) : Promise.resolve([]), categoryIcons(channel),
  ]);
  const rate = new Map(prices.map((p) => [p.uid, channel === "retail" ? p.rt : channel === "distributor" ? p.db : null]));
  const lines: Line[] = products.map((p) => ({ ...p, rate: rate.get(p.uid) ?? null }));
  const info = APP_CHANNELS.find((c) => c.key === channel)!;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <PageHeader
          icon={PackageSearch}
          title={`Product Master · ${info.label}`}
          subtitle={`${info.app}: the products, their order, category (with its icon), name, size, photos and description. Changes reach the app the next time it refreshes.`}
          actions={
            <Link href="/orders/fpproducts" className={buttonVariants({ variant: "outline" })}>
              <ExternalLink className="size-4" /> All product fields
            </Link>
          }
        />

        <ProductList channel={channel} categories={categories} icons={Object.fromEntries(icons)} lines={lines} addable={addable} canEdit={canEdit} />
      </div>
    </div>
  );
}
