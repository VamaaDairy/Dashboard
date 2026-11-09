import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgePercent } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { OfferForm } from "@/components/shop/OfferForm";
import { BLANK, canEditShop, offerChoices } from "@/lib/shop/offer-page";

export const dynamic = "force-dynamic";

export default async function NewOfferPage() {
  if (!(await canEditShop())) redirect("/shop-orders/offers");
  const { products, categories } = await offerChoices();
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader icon={BadgePercent} title="New offer" subtitle="Set it up once; the server applies it to every app order that qualifies."
          actions={<Link href="/shop-orders/offers" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">All offers</Link>} />
        <OfferForm id={null} initial={BLANK} products={products} categories={categories} />
      </div>
    </div>
  );
}
