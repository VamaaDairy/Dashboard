import { Truck } from "lucide-react";
import { SectionShell } from "@/components/orders/SectionShell";

export const dynamic = "force-dynamic";

export default function Page() {
  return <SectionShell icon={Truck} title="Primary orders" subtitle="Company to distributor orders." />;
}
