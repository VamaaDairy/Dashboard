import "server-only";
import ExcelJS from "exceljs";
import { query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { getLabourRates } from "@/lib/daily/heads";
import { DEFAULT_LABOUR_RATES, labourRatesOn } from "@/lib/daily/labour";

/**
 * The Labour page as an Excel workbook (issue #77): one row per day in [from, to] with the labourers and the ₹ of
 * each shift (at the rates in force that day), the total paid, milk processed and ₹ per litre; then the rates.
 */
export async function labourWorkbook(from: string, to: string): Promise<Buffer> {
  const scenario = await activeScenarioId();
  const days = await query<{
    day: string; day_regular: number | null; day_special: number | null; night: number | null; contract: number | null;
    amount: string | null; milk: string | null;
  }>(
    `select to_char(d.day, 'YYYY-MM-DD') as day, l.day_regular, l.day_special, l.night, l.contract,
            o.amount, d.milk_processed_l as milk
       from production_day d
       join overhead_head h on h.scenario_id = d.scenario_id and h.code = 'labour'
       left join daily_overhead o on o.day_id = d.id and o.head_id = h.id
       left join labour_day l on l.day_id = d.id
      where d.scenario_id = $1 and d.day between $2::date and $3::date
        and (o.amount is not null or l.day_id is not null)
      order by d.day`,
    [scenario, from, to],
  );
  const rates = await getLabourRates(); // newest first
  // the rates in force that day, as the Labour page uses them (its defaults before any rates were set)
  const rateOn = (day: string) => labourRatesOn(rates, day) ?? DEFAULT_LABOUR_RATES;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Vamaa Dairy Dashboard";
  wb.created = new Date();
  const navy = "FF2F3992";
  const head = (ws: ExcelJS.Worksheet, row: number) => {
    const r = ws.getRow(row);
    r.font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
    r.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    r.height = 30;
  };
  const rupee = '"₹"#,##0';

  // ---- Labour, day by day
  const ws = wb.addWorksheet("Labour", { views: [{ state: "frozen", ySplit: 3, xSplit: 1 }] });
  ws.columns = [
    { key: "day", width: 13 },
    { key: "dr", width: 9 }, { key: "ds", width: 9 }, { key: "n", width: 9 }, { key: "c", width: 10 }, { key: "w", width: 11 },
    { key: "drA", width: 12 }, { key: "dsA", width: 12 }, { key: "nA", width: 12 }, { key: "cA", width: 12 }, { key: "t", width: 13 },
    { key: "milk", width: 13 }, { key: "perL", width: 11 },
  ];
  ws.mergeCells("A1:M1");
  ws.getCell("A1").value = `VAMAA DAIRY PRIVATE LIMITED - Labour, ${from} to ${to}`;
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: navy } };
  ws.addRow([]);
  ws.addRow(["Date", "Day", "Special", "Night", "Contract", "Total labourers", "Day ₹", "Special ₹", "Night ₹", "Contract ₹", "Total paid ₹", "Milk processed (L)", "₹ per L milk"]);
  head(ws, 3);

  const first = 4;
  for (const d of days) {
    const r = rateOn(d.day);
    const n = (v: number | null) => Number(v ?? 0);
    const shifts = d.day_regular !== null;
    const amount = d.amount === null ? null : Number(d.amount);
    const milk = d.milk === null ? null : Number(d.milk);
    const row = ws.addRow([
      new Date(`${d.day}T00:00:00Z`),
      shifts ? n(d.day_regular) : null, shifts ? n(d.day_special) : null, shifts ? n(d.night) : null, shifts ? n(d.contract) : null,
      shifts ? n(d.day_regular) + n(d.day_special) + n(d.night) + n(d.contract) : null,
      shifts ? n(d.day_regular) * r.dayRegular : null,
      shifts ? n(d.day_special) * r.daySpecial : null,
      shifts ? n(d.night) * r.night : null,
      shifts ? n(d.contract) * r.contract : null,
      amount,
      milk,
      amount !== null && milk ? amount / milk : null,
    ]);
    row.getCell(1).numFmt = "dd-mmm-yyyy";
  }
  const last = ws.rowCount;
  if (days.length) {
    const sum = (col: string) => ({ formula: `SUM(${col}${first}:${col}${last})` });
    const total = ws.addRow([
      "Total", sum("B"), sum("C"), sum("D"), sum("E"), sum("F"), sum("G"), sum("H"), sum("I"), sum("J"), sum("K"), sum("L"),
      // over the days that have milk processed, like each day's own figure
      { formula: `IF(L${last + 1}>0,SUMIFS(K${first}:K${last},L${first}:L${last},">0")/L${last + 1},"")` },
    ]);
    total.font = { bold: true };
    total.border = { top: { style: "thin" } };
  } else {
    ws.addRow(["No labour entered in these dates."]);
  }
  for (const c of ["G", "H", "I", "J", "K"]) ws.getColumn(c).numFmt = rupee;
  ws.getColumn("L").numFmt = "#,##0";
  ws.getColumn("M").numFmt = '"₹"0.000';

  // ---- the rates
  const rs = wb.addWorksheet("Rates", { views: [{ state: "frozen", ySplit: 1 }] });
  rs.columns = [{ width: 16 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }];
  rs.addRow(["Applies from", "Day ₹", "Special ₹", "Night ₹", "Contract ₹"]);
  head(rs, 1);
  if (!rates.length) {
    const d = DEFAULT_LABOUR_RATES;
    rs.addRow(["(default)", d.dayRegular, d.daySpecial, d.night, d.contract]);
  }
  for (const r of rates) {
    const row = rs.addRow([new Date(`${r.effective_from}T00:00:00Z`), r.dayRegular, r.daySpecial, r.night, r.contract]);
    row.getCell(1).numFmt = "dd-mmm-yyyy";
  }
  for (const c of [2, 3, 4, 5]) rs.getColumn(c).numFmt = rupee;

  return Buffer.from(await wb.xlsx.writeBuffer());
}
