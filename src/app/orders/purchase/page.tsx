import { ShoppingCart } from "lucide-react";
import { SectionShell } from "@/components/orders/SectionShell";

export const dynamic = "force-dynamic";

export default function Page() {
  return <SectionShell icon={ShoppingCart} title="Purchase" subtitle="Purchase entries and suppliers." />;
}
