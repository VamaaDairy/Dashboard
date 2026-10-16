import { Contact } from "lucide-react";
import { SectionShell } from "@/components/orders/SectionShell";

export const dynamic = "force-dynamic";

export default function Page() {
  return <SectionShell icon={Contact} title="Customers" subtitle="Distributors and retailers." />;
}
