import { Megaphone } from "lucide-react";
import type { MasterDef } from "../../types";

/**
 * Announcements (Recibo route `announcement`).
 *
 * Spec columns: 6; built: 6.
 */
export const announcement: MasterDef = {
  slug: "announcement",
  title: "Announcements",
  subtitle: "Announcements shown to app users, with the dates they run.",
  icon: Megaphone,
  from: `fp_announcement m`,
  cols: [
    { key: "title", label: "Title", expr: "m.title" },
    { key: "description", label: "Description", expr: "m.description" },
    { key: "fromDate", label: "From Date", expr: "m.from_date" },
    { key: "toDate", label: "To Date", expr: "m.to_date" },
    { key: "announcementFor", label: "Announcement For", expr: "m.app_type" },
    { key: "status", label: "Status", expr: "m.status" },
  ],
  search: ["m.title", "m.description"],
  filters: [
    { key: "status", label: "Status", expr: "m.status" },
  ],
  order: "m.from_date desc nulls last, m.created_at desc",
};
