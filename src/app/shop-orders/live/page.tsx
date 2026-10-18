import Link from "next/link";
import { MapPin } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { LiveMap } from "@/components/shop/LiveMap";

export const dynamic = "force-dynamic";

export default function LivePage() {
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={MapPin}
          title="Live delivery map"
          subtitle="Where the riders are and where the open orders are going."
          actions={<Link href="/shop-orders" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Orders</Link>}
        />
        <LiveMap />
      </div>
    </div>
  );
}
