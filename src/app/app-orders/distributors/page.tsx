import { TradeListPage } from "../trade";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; date?: string }> }) {
  return <TradeListPage kind="distributors" searchParams={searchParams} />;
}
