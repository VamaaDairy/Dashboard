import { redirect } from "next/navigation";

/** No combined view: each kind has its own page in the sidebar. */
export default function AppOrdersPage() {
  redirect("/app-orders/d2c");
}
