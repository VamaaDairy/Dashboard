import { PackageSearch } from "lucide-react";
import { SectionShell } from "@/components/orders/SectionShell";

export const dynamic = "force-dynamic";

export default function Page() {
  return <SectionShell icon={PackageSearch} title="Products" subtitle="Product master: SKUs, categories and prices." />;
}
