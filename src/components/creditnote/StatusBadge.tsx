import { statusLabel } from "@/lib/creditnote/qty";

/** Plain text, no background: Pending, Approved or Rejected. */
export function StatusBadge({ note }: { note: { status: string } }) {
  return <span className="text-[13px] font-medium text-foreground">{statusLabel(note)}</span>;
}
