import { redirect } from "next/navigation";
import { today } from "@/lib/dates";

// redirects to today, so it must run on every request, never once at build time
export const dynamic = "force-dynamic";

/** The Milk in section opens on today's collections. */
export default function ProcurementPage() {
  redirect(`/procurement/vamaa/${today()}`);
}
