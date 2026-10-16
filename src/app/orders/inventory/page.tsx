import { Warehouse } from "lucide-react";
import { SectionShell } from "@/components/orders/SectionShell";

export const dynamic = "force-dynamic";

export default function Page() {
  return <SectionShell icon={Warehouse} title="Inventory" subtitle="Stock on hand by product and location." />;
}
