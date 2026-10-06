import { redirect } from "next/navigation";
import { today } from "@/lib/dates";

/** The Milk in section opens on today's collections. */
export default function ProcurementPage() {
  redirect(`/procurement/vamaa/${today()}`);
}
