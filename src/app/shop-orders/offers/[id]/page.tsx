import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BadgePercent } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { OfferForm } from "@/components/shop/OfferForm";
import { getOffer } from "@/lib/shop/offers";
import { canEditShop, offerChoices, toInput } from "@/lib/shop/offer-page";

export const dynamic = "force-dynamic";

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  if (!(await canEditShop())) redirect("/shop-orders/offers");
  const [offer, { products, categories }] = await Promise.all([getOffer(id), offerChoices()]);
  if (!offer) notFound();
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader icon={BadgePercent} title={offer.title} subtitle="Changes apply to new orders straight away; placed orders keep what they got."
          actions={<Link href="/shop-orders/offers" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">All offers</Link>} />
        <OfferForm id={id} initial={toInput(offer)} products={products} categories={categories} />
      </div>
    </div>
  );
}
