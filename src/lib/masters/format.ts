import { DISPLAY_TZ } from "./constants";
import type { Kind } from "./types";

const day = (v: unknown): string => {
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { timeZone: DISPLAY_TZ, day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
};

const dayTime = (v: unknown): string => {
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return `${day(d)} ${d.toLocaleTimeString("en-GB", { timeZone: DISPLAY_TZ, hour: "2-digit", minute: "2-digit" })}`;
};

/** A cell as text, the way the screen and the CSV both show it. */
export function cellText(kind: Kind | undefined, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  switch (kind) {
    case "date":
      return day(v);
    case "datetime":
      return dayTime(v);
    case "money":
      return Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "num":
      return Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
    default:
      return String(v).trim();
  }
}
