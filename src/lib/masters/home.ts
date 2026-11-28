import type { MasterDef } from "./types";

/**
 * Where a master's screens are. Most masters live at /orders/<slug>; the Customer Master and Employee Master live in
 * their own section (/customers, /employees), where the list, the profile and the add / edit form all are, and their
 * old /orders pages only send people there.
 */
export const listHref = (def: MasterDef) => def.home?.list ?? `/orders/${def.slug}`;
export const newHref = (def: MasterDef) => (def.home ? `${def.home.list}/new` : `/orders/${def.slug}/new`);
export const editHref = (def: MasterDef, id: string) => (def.home ? `${def.home.profile}${id}/edit` : `/orders/${def.slug}/${id}`);
/** after saving: the record's profile when it has one, else the list */
export const savedHref = (def: MasterDef, id: string | null) => (def.home && id ? `${def.home.profile}${id}` : listHref(def));
