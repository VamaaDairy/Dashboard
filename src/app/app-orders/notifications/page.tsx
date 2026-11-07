import { NotificationsView } from "@/components/shop/NotificationsView";

export const dynamic = "force-dynamic";

/** Push notifications for the Gaia distributor / retailer app. */
export default function PartnerNotificationsPage() {
  return <NotificationsView app="partner" />;
}
