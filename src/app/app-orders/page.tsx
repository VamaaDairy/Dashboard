import { redirect } from "next/navigation";

/** No combined view: D2C orders are on /shop-orders; distributors and retailers each have a page. */
export default function AppOrdersPage() {
  redirect("/app-orders/distributors");
}
