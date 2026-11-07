import { NotificationsView } from "@/components/shop/NotificationsView";

export const dynamic = "force-dynamic";

/** Push notifications for the Gaia D2C app (customers) and the delivery riders. */
export default function D2cNotificationsPage() {
  return <NotificationsView app="d2c" />;
}
