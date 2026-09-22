import { Empty, Section, THead, Th } from "./ui";
import { litresToKg, snfFromClr } from "@/lib/units";
import { formatNumber } from "@/lib/format";
import type { VamaaCollection, VamaaFarmer } from "@/lib/vamaa/client";

/** Every field the API returns for a day's collections, unfiltered and untransformed. */
export function VamaaCollectionsTable({
  date, rows, kgPerLitre,
}: {
  date: string;
  rows: VamaaCollection[];
  kgPerLitre: number;
}) {
  const totalQty = rows.reduce((t, r) => t + (Number(r.quantity) || 0), 0);
  const totalKg = litresToKg(totalQty, kgPerLitre);

  return (
    <Section
      title={`Collections on ${date}`}
      description={`Exactly what /api/v1/export_collection returns for this centre and date, except SNF, which is calculated from CLR and Fat (CLR/4 + 0.20×Fat + 0.70) rather than shown as sent. Kg is the other added column: quantity (litres) × ${formatNumber(kgPerLitre, 2)} kg/L.`}
    >
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-[12px]">
          <THead>
            <Th align="left">Farmer code</Th>
            <Th align="left">Shift</Th>
            <Th align="left">Type</Th>
            <Th>Qty (L)</Th>
            <Th>Kg</Th>
            <Th>Fat</Th>
            <Th>SNF</Th>
            <Th>CLR</Th>
            <Th>Temp</Th>
            <Th>Water</Th>
            <Th>Protein</Th>
            <Th align="left">Qty time</Th>
            <Th>Qty mode</Th>
            <Th align="left">Qlty time</Th>
            <Th>Qlty mode</Th>
            <Th>Sample</Th>
            <Th>Sample status</Th>
            <Th>Status</Th>
            <Th>Rate</Th>
            <Th>Amount</Th>
            <Th>Bottle no</Th>
            <Th>Cans</Th>
            <Th>Bad cans</Th>
            <Th>Bad qty</Th>
            <Th align="left">Reject reasons</Th>
            <Th align="left">Created</Th>
            <Th align="left">Updated</Th>
          </THead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.farmer_code}-${r.shift}-${r.qty_time}-${i}`}
                className="border-b border-border/70 hover:bg-muted"
              >
                <td className="px-3 py-1.5 font-semibold text-foreground">{r.farmer_code}</td>
                <td className="px-3 py-1.5">{r.shift}</td>
                <td className="px-3 py-1.5">{r.type}</td>
                <td className="num px-3 py-1.5 text-right font-semibold">{r.quantity}</td>
                <td className="num px-3 py-1.5 text-right text-muted-foreground">
                  {formatNumber(litresToKg(Number(r.quantity) || 0, kgPerLitre), 2)}
                </td>
                <td className="num px-3 py-1.5 text-right">{r.fat}</td>
                <td className="num px-3 py-1.5 text-right">
                  {formatNumber(snfFromClr(Number(r.clr) || 0, Number(r.fat) || 0), 2)}
                </td>
                <td className="num px-3 py-1.5 text-right">{r.clr}</td>
                <td className="num px-3 py-1.5 text-right">{r.temp}</td>
                <td className="num px-3 py-1.5 text-right">{r.water}</td>
                <td className="num px-3 py-1.5 text-right">{r.protein}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.qty_time}</td>
                <td className="num px-3 py-1.5 text-right">{r.qty_mode}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.qlty_time}</td>
                <td className="num px-3 py-1.5 text-right">{r.qlty_mode}</td>
                <td className="num px-3 py-1.5 text-right">{r.sample}</td>
                <td className="num px-3 py-1.5 text-right">{r.sample_status}</td>
                <td className="num px-3 py-1.5 text-right">{r.status}</td>
                <td className="num px-3 py-1.5 text-right">{r.rate}</td>
                <td className="num px-3 py-1.5 text-right font-semibold">{r.amount}</td>
                <td className="num px-3 py-1.5 text-right">{r.bottle_no}</td>
                <td className="num px-3 py-1.5 text-right">{r.no_of_cans}</td>
                <td className="num px-3 py-1.5 text-right">{r.no_of_bad_cans}</td>
                <td className="num px-3 py-1.5 text-right">{r.bad_quantity}</td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {r.reject_reasons?.length ? JSON.stringify(r.reject_reasons) : "—"}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.created}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.updated}</td>
              </tr>
            ))}
            {rows.length === 0 ? <Empty colSpan={27}>No collections returned for this date.</Empty> : null}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="bg-accent font-semibold">
                <td className="px-3 py-2" colSpan={3}>
                  {rows.length} record{rows.length === 1 ? "" : "s"}
                </td>
                <td className="num px-3 py-2 text-right">{totalQty.toFixed(2)}</td>
                <td className="num px-3 py-2 text-right text-muted-foreground">{formatNumber(totalKg, 2)}</td>
                <td colSpan={22} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </Section>
  );
}

/** Every field the API returns for the centre's registered farmers, unfiltered. */
export function VamaaFarmersTable({ rows }: { rows: VamaaFarmer[] }) {
  return (
    <Section
      title="Farmers"
      description="Exactly what /api/v1/export_farmer returns for this centre — the master list, not tied to any date."
    >
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-[12px]">
          <THead>
            <Th align="left">Code</Th>
            <Th align="left">Name</Th>
            <Th align="left">Mobile</Th>
            <Th align="left">Gender</Th>
            <Th align="left">Milk type</Th>
            <Th align="left">Bank</Th>
            <Th align="left">Branch</Th>
            <Th align="left">Account</Th>
            <Th align="left">IFSC</Th>
            <Th align="left">Name in bank</Th>
            <Th>Status</Th>
            <Th align="left">Aadhar</Th>
            <Th align="left">Potential volume</Th>
            <Th align="left">Created</Th>
            <Th align="left">Docs</Th>
          </THead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.unique_code} className="border-b border-border/70 hover:bg-muted">
                <td className="px-3 py-1.5 font-semibold text-foreground">{f.code}</td>
                <td className="px-3 py-1.5">{f.name_en || `${f.first_name} ${f.last_name}`.trim()}</td>
                <td className="px-3 py-1.5">{f.mobile || "—"}</td>
                <td className="px-3 py-1.5">{f.gender ?? "—"}</td>
                <td className="px-3 py-1.5">{f.milk_type || "—"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{f.bank_name || "—"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{f.bank_branch || "—"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{f.bank_account || "—"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{f.bank_ifsc || "—"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{f.name_in_bank || "—"}</td>
                <td className="num px-3 py-1.5 text-right">{f.status}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{f.aadhar_number || "—"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{f.potential_volume || "—"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{f.created || "—"}</td>
                <td className="px-3 py-1.5">
                  <div className="flex gap-2">
                    {f.cb_passbook_photo ? <DocLink href={f.cb_passbook_photo} label="Passbook" /> : null}
                    {f.cb_aadhaar_photo ? <DocLink href={f.cb_aadhaar_photo} label="Aadhaar" /> : null}
                    {f.cb_aadhaar_photo_back ? <DocLink href={f.cb_aadhaar_photo_back} label="Aadhaar (back)" /> : null}
                    {!f.cb_passbook_photo && !f.cb_aadhaar_photo && !f.cb_aadhaar_photo_back ? "—" : null}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? <Empty colSpan={15}>No farmers returned for this centre.</Empty> : null}
          </tbody>
        </table>
      </div>
      {rows.length > 0 ? (
        <p className="border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
          {rows.length} farmer{rows.length === 1 ? "" : "s"} registered at this centre.
        </p>
      ) : null}
    </Section>
  );
}

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[11px] font-semibold text-primary underline"
    >
      {label}
    </a>
  );
}
