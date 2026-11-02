import { DeleteMovement } from "@/components/store/StoreForms";
import { inr, qtyFmt, type MovementRow } from "@/lib/store/data";

export function MovementTable({ rows, canEdit, empty }: { rows: MovementRow[]; canEdit: boolean; empty: string }) {
  const heads = ["Date", "Type", "Item", "Category", "Quantity", "Rate", "Amount", "Supplier / issued to", "Ref no.", "Notes", "By", ""];
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>{heads.map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-t border-border">
              <td className="whitespace-nowrap px-3 py-2">{m.day.split("-").reverse().join("-")}</td>
              <td className="px-3 py-2"><span className={m.direction === "in" ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>{m.direction === "in" ? "In" : "Out"}</span></td>
              <td className="px-3 py-2 font-medium">{m.item}</td>
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{m.category}{m.subcategory ? ` › ${m.subcategory}` : ""}</td>
              <td className="num whitespace-nowrap px-3 py-2">{m.direction === "in" ? "+" : "−"}{qtyFmt(m.qty)} {m.unit}</td>
              <td className="num px-3 py-2">{inr(m.rate)}</td>
              <td className="num px-3 py-2">{m.rate != null ? inr(m.qty * m.rate) : "—"}</td>
              <td className="px-3 py-2">{m.party ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-xs">{m.ref_no ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">{m.notes ?? ""}</td>
              <td className="px-3 py-2 text-muted-foreground">{m.created_by ?? ""}</td>
              <td className="px-3 py-2">{canEdit ? <DeleteMovement id={m.id} /> : null}</td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={heads.length} className="px-3 py-10 text-center text-muted-foreground">{empty}</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
