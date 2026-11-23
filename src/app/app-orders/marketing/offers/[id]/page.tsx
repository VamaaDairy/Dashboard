import { EditOfferView } from "@/components/shop/MarketingViews";

export const dynamic = "force-dynamic";

export default async function EditPartnerOfferPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditOfferView app="partners" id={Number((await params).id)} />;
}
