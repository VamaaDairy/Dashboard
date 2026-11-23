import { EditOfferView } from "@/components/shop/MarketingViews";

export const dynamic = "force-dynamic";

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditOfferView app="d2c" id={Number((await params).id)} />;
}
