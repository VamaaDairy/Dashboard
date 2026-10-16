import { Route } from "lucide-react";
import { SectionShell } from "@/components/orders/SectionShell";

export const dynamic = "force-dynamic";

export default function Page() {
  return <SectionShell icon={Route} title="Secondary orders" subtitle="Distributor to retailer orders." />;
}
