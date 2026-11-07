/** Who a dashboard push notification can go to, per app (shared by the two Notifications pages). */

export type NotifyApp = "d2c" | "partner";
export type Audience =
  | "customers" | "customer" | "riders"                         // Gaia D2C app + delivery riders
  | "partners" | "distributors" | "retailers" | "partner";      // distributor / retailer app
export interface SendSummary { audience: string; sent: number; failed: number }
export interface Recipient { id: number; name: string; phone: string; kind?: string }

/** The audience that needs one recipient picked from a search. */
export const ONE_OF: Record<NotifyApp, Audience> = { d2c: "customer", partner: "partner" };

export const AUDIENCES: Record<NotifyApp, { v: Audience; label: string }[]> = {
  d2c: [
    { v: "customers", label: "All customers (signed in)" },
    { v: "customer", label: "One customer" },
    { v: "riders", label: "All delivery riders" },
  ],
  partner: [
    { v: "partners", label: "All distributors and retailers" },
    { v: "distributors", label: "All distributors" },
    { v: "retailers", label: "All retailers" },
    { v: "partner", label: "One distributor or retailer" },
  ],
};

/** Every partner-app log row starts with this, so each page shows only its own history. */
export const PARTNER_LOG_PREFIX = "Distributor app: ";
/** push_log rows of one app ("All distributors" is how the old combined page logged them). */
export const LOG_WHERE: Record<NotifyApp, string> = {
  d2c: `audience not like '${PARTNER_LOG_PREFIX}%' and audience <> 'All distributors'`,
  partner: `(audience like '${PARTNER_LOG_PREFIX}%' or audience = 'All distributors')`,
};
