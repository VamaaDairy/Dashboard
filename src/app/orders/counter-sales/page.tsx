import { Store } from "lucide-react";
import { SectionShell } from "@/components/orders/SectionShell";

export const dynamic = "force-dynamic";

export default function Page() {
  return <SectionShell icon={Store} title="Counter sales" subtitle="Over-the-counter sales at the plant or depot." />;
}
