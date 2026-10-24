import { TradeOrderPage } from "../../trade";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return <TradeOrderPage kind="retailers" uid={uid} />;
}
