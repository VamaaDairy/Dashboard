import { Fragment, type ReactNode } from "react";
import {
  buildDayReport, byUnit, f2, fatSnf, litre, num, qty, rupee, signed, smart, wavg,
  type DayReportData, type Flow, type PackRow,
} from "@/lib/production/day-report-model";

/**
 * The daily production report, laid out for A4 print: page 1 is the day at a glance (five steps from milk collected to
 * packed, six charts and the points to check), then the details. Black on white only: no colour, no rules, no shading.
 * Printed from Production > Daily batches > Day report (PDF); the browser's "Save as PDF" makes the file.
 */
export function DayReport({ data }: { data: DayReportData }) {
  const r = buildDayReport(data);
  const day = labels(data.date, data.pulledAt);
  const nb = data.batches.length;
  const order = [...data.collection].sort((a, b) => a.center.localeCompare(b.center) || shiftRank(a.shift) - shiftRank(b.shift));
  const multiCentre = new Set(data.collection.map((v) => v.center)).size > 1;
  const units = new Set([...r.madePacked.values()].map((m) => m.unit));
  const batchWord = (n: number) => `${n} batch${n === 1 ? "" : "es"}`;

  return (
    <div className="dpr">
      <style dangerouslySetInnerHTML={{ __html: css(day) }} />

      {/* ---------------------------------------------------------------- page 1: the day at a glance */}
      <header className="dpr-head">
        <div>
          <h1 className="dpr-title">Daily Production Report</h1>
          <p className="dpr-subtitle">Gaia Plant, Tum Gaon · milk collected to packed product</p>
        </div>
        <div className="dpr-when">
          <div className="dpr-weekday">{day.weekday}</div>
          <div className="dpr-date">{day.long}</div>
          <div className="dpr-pulled">Figures as entered, pulled {day.pulled}</div>
        </div>
      </header>

      <div className="dpr-steps">
        {[
          { label: "Milk collected", value: `${litre(r.collected)} L`,
            sub: r.colFat == null ? "No collection entered" : `Fat ${f2(r.colFat)}% · SNF ${f2(r.colSnf)}%` },
          { label: "Put into tanks", value: `${litre(r.intoL)} L`, sub: r.gap > 0.5 ? `${litre(r.gap)} L in no tank` : "All of the milk collected" },
          { label: "Drawn for production", value: `${litre(r.drawn)} L`, sub: nb ? `for ${batchWord(nb)}` : "No batches" },
          { label: "Made", value: nb ? batchWord(nb) : "Nothing", sub: nb ? byUnit(r.made) : "No batch entered" },
          { label: "Packed", value: data.packing.length ? `${num(r.pcs)} pcs` : "Nothing",
            sub: data.packing.length ? `${data.packing.length} SKUs · ${rupee(r.material)} material` : "No packing entered" },
        ].map((s, i) => (
          <Fragment key={s.label}>
            {i ? <Chevron /> : null}
            <div className="dpr-step">
              <div className="dpr-step-label">{s.label}</div>
              <div className="dpr-step-value">{s.value}</div>
              <div className="dpr-step-sub">{s.sub}</div>
            </div>
          </Fragment>
        ))}
      </div>

      <div className="dpr-charts">
        <Bars title="Milk, litres" note="Collected at the centre, put into tanks, drawn for batches" rows={[
          { label: "Collected", value: r.collected, text: `${litre(r.collected)} L` },
          { label: "Put into tanks", value: r.intoL, text: `${litre(r.intoL)} L` },
          { label: "Drawn", value: r.drawn, text: `${litre(r.drawn)} L` },
        ]} />
        <Bars title="Collected by shift" note="Litres, then fat / SNF %" label={58} text={112} rows={order.map((v) => ({
          label: `${multiCentre ? `${v.center} ` : ""}${SHIFT[v.shift] ?? v.shift}`, value: v.litre,
          text: `${litre(v.litre)} L   ${fatSnf(v.fat, v.snf)}`,
        }))} />
        <Bars title="Tank stock at close" note="Bar is the milk in the tank; box is its capacity" label={48} text={104} rows={r.tanks.map((t) => ({
          label: t.tank, value: Math.max(0, t.closing ?? 0), box: t.capacity,
          text: t.capacity ? `${litre(t.closing ?? 0)} of ${num(t.capacity)} L` : `${litre(t.closing ?? 0)} L`,
        }))} />
        <Bars title="Milk drawn, by product" note="Litres of milk drawn › what the batch made" label={92} text={96} rows={data.batches.map((b) => ({
          label: b.product, value: b.milk_l ?? 0, text: `${smart(b.milk_l ?? 0)} L › ${qty(b.output ?? 0, b.unit)}`,
        }))} />
        <Bars title="Packed, by category" note="Pieces packed" text={70} rows={[...r.categories].map(([cat, items]) => {
          const pcs = items.reduce((a, p) => a + (p.pcs ?? 0), 0);
          return { label: cat, value: pcs, text: `${num(pcs)} pcs` };
        })} />
        <Pairs title="Made vs packed" note={`By bulk product${units.size > 1 ? " · each unit on its own scale" : ""}`}
          rows={[...r.madePacked].map(([name, m]) => ({ label: name, unit: m.unit, made: m.made, packed: m.packed }))} />
      </div>

      <section className="dpr-sec dpr-checks-sec">
        <h2 className="dpr-sec-title">
          Points to check{r.checks.length ? <span className="dpr-count"> {r.checks.length} item{r.checks.length === 1 ? "" : "s"}</span> : null}
        </h2>
        {r.checks.length ? (
          <ul className="dpr-checks">
            {r.checks.map((c, i) => <li key={i}><b>{c.lead}</b> {c.text}</li>)}
          </ul>
        ) : (
          <p className="dpr-ok">No gaps found: the milk, tank, batch and packing figures for this day agree.</p>
        )}
      </section>

      {/* ---------------------------------------------------------------- details */}
      <div className="dpr-details">
        <h2 className="dpr-title">Details</h2>

        <Section title="Milk collected" note="Milk in">
          <div className="dpr-two">
            <div>
              <div className="dpr-subhead">At the collection centre</div>
              <table>
                <Cols w={[44, 50, 42, 52, 34, 36]} />
                <thead><tr><th>Centre</th><th>Shift</th><th className="r">Farmers</th><th className="r">Litres</th><th className="r">Fat %</th><th className="r">SNF %</th></tr></thead>
                <tbody>
                  {order.map((v) => (
                    <tr key={`${v.center}-${v.shift}`}>
                      <td>{v.center}</td><td>{SHIFT[v.shift] ?? v.shift}</td><td className="r">{num(v.farmers)}</td>
                      <td className="r">{litre(v.litre)}</td><td className="r">{f2(v.fat)}</td><td className="r">{f2(v.snf)}</td>
                    </tr>
                  ))}
                  <tr className="dpr-total"><td>Total</td><td /><td /><td className="r">{litre(r.collected)}</td><td className="r">{f2(r.colFat)}</td><td className="r">{f2(r.colSnf)}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <div className="dpr-subhead">Put into tanks</div>
              <table>
                <Cols w={[64, 42, 32, 39, 32, 46]} />
                <thead><tr><th>Tank</th><th className="r">Litres</th><th className="r">Fat %</th><th className="r">SNF %</th><th className="r">₹ / L</th><th className="r">Cost ₹</th></tr></thead>
                <tbody>
                  {[...r.into].map(([tank, ms]) => {
                    const L = ms.reduce((a, m) => a + (m.litre ?? 0), 0);
                    const cost = ms.reduce((a, m) => a + (m.litre ?? 0) * (m.rate ?? 0), 0);
                    return (
                      <tr key={tank}>
                        <td>{tank}</td><td className="r">{litre(L)}</td>
                        <td className="r">{f2(wavg(ms.map((m) => [m.litre, m.fat])))}</td><td className="r">{f2(wavg(ms.map((m) => [m.litre, m.snf])))}</td>
                        <td className="r">{L ? (cost / L).toFixed(2) : "—"}</td><td className="r">{num(cost)}</td>
                      </tr>
                    );
                  })}
                  {r.gap > 0.5 ? <tr><td>No tank chosen</td><td className="r">{litre(r.gap)}</td><td /><td /><td /><td /></tr> : null}
                  {(() => {
                    const all = [...r.into.values()].flat();
                    const cost = all.reduce((a, m) => a + (m.litre ?? 0) * (m.rate ?? 0), 0);
                    return (
                      <tr className="dpr-total">
                        <td>Into tanks</td><td className="r">{litre(r.intoL)}</td>
                        <td className="r">{f2(wavg(all.map((m) => [m.litre, m.fat])))}</td><td className="r">{f2(wavg(all.map((m) => [m.litre, m.snf])))}</td>
                        <td className="r">{r.intoL ? (cost / r.intoL).toFixed(2) : "—"}</td><td className="r">{num(cost)}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
          <p className="dpr-note">Fat and SNF are averaged by litres. ₹ / L and cost are the milk cost each tank entry was booked at.</p>
          {data.procurement.length ? (
            <>
              <div className="dpr-subhead dpr-gap">Other procurement</div>
              <table>
                <Cols w={[90, 50, 50, 55, 40, 40, 70]} />
                <thead><tr><th>Centre</th><th>Shift</th><th className="r">Kg</th><th className="r">Litres</th><th className="r">Fat %</th><th className="r">SNF %</th><th>Tanker</th></tr></thead>
                <tbody>
                  {data.procurement.map((p, i) => (
                    <tr key={i}>
                      <td>{p.center}</td><td>{SHIFT[p.shift] ?? p.shift}</td><td className="r">{smart(p.kg)}</td><td className="r">{litre(p.litre)}</td>
                      <td className="r">{f2(p.fat)}</td><td className="r">{f2(p.snf)}</td><td>{p.tanker ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </Section>

        <Section title="Tank stock" note={`${r.tanks.length} tanks in use`}>
          <table>
            <Cols w={[38, 46, 50, 54, 48, 48, 46, ...(r.hasTransfer ? [46] : []), ...(r.hasOther ? [42] : []), 54, 54, 34]} />
            <thead>
              <tr>
                <th>Tank</th><th className="r">Capacity</th><th className="r">Opening</th><th className="r">Fat / SNF</th>
                <th className="r">+ Milk in</th><th className="r">+ Put back</th><th className="r">− Drawn</th>
                {r.hasTransfer ? <th className="r">± Transfer</th> : null}{r.hasOther ? <th className="r">± Other</th> : null}
                <th className="r">Closing</th><th className="r">Fat / SNF</th><th className="r">Full</th>
              </tr>
            </thead>
            <tbody>
              {r.tanks.map((t) => {
                const f = r.flows.get(t.tank) ?? NO_FLOW;
                const op = t.opening ?? 0;
                const cl = t.closing ?? 0;
                return (
                  <tr key={t.tank}>
                    <td className="b">{t.tank}</td><td className="r">{t.capacity ? num(t.capacity) : "—"}</td><td className="r">{litre(op)}</td>
                    <td className="r s">{Math.abs(op) > 0.05 ? fatSnf(t.opening_fat, t.opening_snf) : "—"}</td>
                    <td className="r">{f.milkIn ? litre(f.milkIn) : "–"}</td><td className="r">{f.back ? litre(f.back) : "–"}</td>
                    <td className="r">{f.drawn ? litre(f.drawn) : "–"}</td>
                    {r.hasTransfer ? <td className="r">{Math.abs(f.transfer) > 0.05 ? signed(f.transfer) : "–"}</td> : null}
                    {r.hasOther ? <td className="r">{Math.abs(f.other) > 0.05 ? signed(f.other) : "–"}</td> : null}
                    <td className="r b">{litre(cl)}</td><td className="r s">{Math.abs(cl) > 0.05 ? fatSnf(t.closing_fat, t.closing_snf) : "—"}</td>
                    <td className="r">{t.capacity ? `${((cl / t.capacity) * 100).toFixed(0)}%` : "—"}</td>
                  </tr>
                );
              })}
              {(() => {
                const tot = (k: keyof Flow) => r.tanks.reduce((a, t) => a + (r.flows.get(t.tank)?.[k] ?? 0), 0);
                const cap = r.tanks.reduce((a, t) => a + (t.capacity ?? 0), 0);
                const op = r.tanks.reduce((a, t) => a + (t.opening ?? 0), 0);
                const cl = r.tanks.reduce((a, t) => a + (t.closing ?? 0), 0);
                const cell = (v: number) => (Math.abs(v) >= 0.05 ? litre(v) : "–");
                return (
                  <tr className="dpr-total">
                    <td>Total</td><td className="r">{num(cap)}</td><td className="r">{litre(op)}</td>
                    <td className="r s">{fatSnf(wavg(r.tanks.map((t) => [t.opening, t.opening_fat])), wavg(r.tanks.map((t) => [t.opening, t.opening_snf])))}</td>
                    <td className="r">{cell(tot("milkIn"))}</td><td className="r">{cell(tot("back"))}</td><td className="r">{cell(tot("drawn"))}</td>
                    {r.hasTransfer ? <td className="r">{signed(tot("transfer"))}</td> : null}
                    {r.hasOther ? <td className="r">{signed(tot("other"))}</td> : null}
                    <td className="r">{litre(cl)}</td>
                    <td className="r s">{fatSnf(wavg(r.tanks.map((t) => [t.closing, t.closing_fat])), wavg(r.tanks.map((t) => [t.closing, t.closing_snf])))}</td>
                    <td className="r">{cap ? `${((cl / cap) * 100).toFixed(0)}%` : "—"}</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
          <p className="dpr-note">
            Opening + Milk in + Put back − Drawn{r.hasTransfer ? " ± Transfer" : ""}{r.hasOther ? " ± Other" : ""} = Closing, in litres. Put back is milk
            made in a batch and returned to a tank. Fat and SNF are each tank&apos;s running book average.
            {r.hiddenTanks ? ` ${r.hiddenTanks} other tank${r.hiddenTanks === 1 ? " was" : "s were"} empty with no movement.` : ""}
          </p>
        </Section>

        <Section title="Production batches" note={`${litre(r.drawn)} L of milk drawn`}>
          {nb ? (
            <>
              <table className="dpr-top">
                <Cols w={[80, 54, 44, 50, 52, 138, 52, 52]} />
                <thead>
                  <tr>
                    <th>Product</th><th className="r">Milk drawn</th><th>From tank</th><th className="r">Milk fat / SNF</th>
                    <th className="r">Lab test fat / SNF</th><th>Other inputs</th><th className="r">Made</th><th className="r">Milk cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.batches.map((b, i) => {
                    const milk = b.milk_l ?? 0;
                    const tests = b.tests.filter((x) => x.fat != null || x.snf != null)
                      .map((x) => `${fatSnf(x.fat, x.snf)}${x.clr != null ? ` · CLR ${smart(x.clr)}` : ""}`);
                    const inputs = b.ingredients.map((x) => `${x.name.slice(0, 1).toUpperCase()}${x.name.slice(1)} ${smart(x.qty)} ${x.unit ?? ""}`.trim());
                    if (b.workers || b.hours || b.labour_cost) inputs.push(`Labour ${smart(b.workers ?? 0)} people · ${smart(b.hours ?? 0)} h · ${rupee(b.labour_cost)}`);
                    return (
                      <tr key={i}>
                        <td><b>{b.product}</b>{b.batch_no ? <div className="s">Batch {b.batch_no}</div> : null}</td>
                        <td className="r">{smart(milk)} L</td>
                        <td className="s">{b.draws.length === 1 ? b.draws[0].tank : b.draws.map((x, j) => <div key={j}>{x.tank} {smart(x.litre)} L</div>)}</td>
                        <td className="r s">{fatSnf(b.fat, b.snf)}</td>
                        <td className="r s">{tests.length ? tests.map((t, j) => <div key={j}>{t}</div>) : "—"}</td>
                        <td className="s">{inputs.length ? inputs.join(" · ") : "—"}{b.notes ? <div><i>{b.notes}</i></div> : null}</td>
                        <td className="r">{b.output ? <b>{qty(b.output, b.unit)}</b> : "Not entered"}</td>
                        <td className="r">{rupee(b.milk_cost)}{milk >= 1 && b.milk_cost ? <div className="s">₹{(b.milk_cost / milk).toFixed(2)} / L</div> : null}</td>
                      </tr>
                    );
                  })}
                  <tr className="dpr-total">
                    <td>Total · {batchWord(nb)}</td><td className="r">{litre(r.drawn)} L</td><td />
                    <td className="r s">{fatSnf(wavg(data.batches.map((b) => [b.milk_l, b.fat])), wavg(data.batches.map((b) => [b.milk_l, b.snf])))}</td>
                    <td /><td />
                    <td className="r">{[...r.made].filter(([, v]) => Math.abs(v) > 0.0001).map(([u, v]) => <div key={u}>{smart(v)} {u}</div>)}</td>
                    <td className="r">{rupee(data.batches.reduce((a, b) => a + (b.milk_cost ?? 0), 0))}</td>
                  </tr>
                </tbody>
              </table>
              <p className="dpr-note">
                Milk fat / SNF is the tank&apos;s book average for the milk drawn; the lab test is the one entered for that milk. Milk cost is the
                book cost of the milk drawn.
              </p>
            </>
          ) : <p>No production batch was entered on this day.</p>}
        </Section>

        <Section title="Packing" note={`${num(r.pcs)} pieces · ${data.packing.length} SKUs`}>
          {data.packing.length ? <Packing rows={data.packing} categories={r.categories} pcs={r.pcs} material={r.material} date={data.date} /> : <p>No packing was entered on this day.</p>}
        </Section>

        <Section title="Made vs packed" note="by bulk product">
          {r.madePacked.size ? (
            <>
              <table>
                <Cols w={[118, 66, 66, 66, 10, 186]} />
                <thead><tr><th>Bulk product</th><th className="r">Made</th><th className="r">Packed</th><th className="r">Difference</th><th /><th>What it means</th></tr></thead>
                <tbody>
                  {[...r.madePacked].map(([name, m]) => {
                    const diff = m.made - m.packed;
                    const what = m.batches === 0 ? "Packed, but no batch was entered on this day"
                      : m.made <= 0 ? "Batch entered with nothing made"
                        : m.lines === 0 ? "Made, nothing packed on this day"
                          : Math.abs(diff) < 0.5 ? "All of it packed"
                            : diff > 0 ? `${smart(diff)} ${m.unit} made but not packed on this day`
                              : `${smart(-diff)} ${m.unit} more packed than made on this day`;
                    return (
                      <tr key={name}>
                        <td className="b">{name}</td><td className="r">{m.batches ? qty(m.made, m.unit) : "—"}</td>
                        <td className="r">{m.lines ? qty(m.packed, m.unit) : "—"}</td><td className="r b">{signed(diff, m.unit)}</td><td />
                        <td className="s">{what}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="dpr-note">
                Made is the output of this day&apos;s batches; packed is the bulk used by this day&apos;s packing. A difference can be stock
                carried from one day to the next.
              </p>
            </>
          ) : <p>Nothing was made or packed on this day.</p>}
        </Section>

        {data.moves.length ? (
          <Section title="Tank movements" note={`${data.moves.length} entries`}>
            <table className="dpr-tight">
              <Cols w={[16, 40, 244, 56, 40, 40, 44]} />
              <thead><tr><th className="r">#</th><th>Tank</th><th>Movement</th><th className="r">Litres</th><th className="r">Fat %</th><th className="r">SNF %</th><th className="r">₹ / L</th></tr></thead>
              <tbody>
                {data.moves.map((m, i) => {
                  const L = m.litre ?? 0;
                  let what = m.source === "production" && m.batch_product ? `Drawn for ${m.batch_product}` : m.notes || m.source || "Entered on the tank";
                  if (m.transfer_tank) what += ` (${m.direction === "in" ? "from" : "to"} ${m.transfer_tank})`;
                  return (
                    <tr key={i}>
                      <td className="r s">{i + 1}</td><td className="b">{m.tank}</td><td className="s">{what}</td>
                      <td className="r">{L >= 0.05 ? `${m.direction === "in" ? "+" : "−"}${litre(L)}` : litre(L)}</td>
                      <td className="r s">{f2(m.fat)}</td><td className="r s">{f2(m.snf)}</td><td className="r s">{m.rate ? f2(m.rate) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="dpr-note">Every tank entry on this day in the order it was made: + into a tank, − out of it.</p>
          </Section>
        ) : null}

        <p className="dpr-source">
          Source: Gaia Dashboard (Milk in, Tanks, Production, SKU packing), as entered by the plant. Quantities are as entered; nothing in
          this report is estimated.
        </p>
      </div>
    </div>
  );
}

function Packing({ rows, categories, pcs, material, date }: {
  rows: PackRow[]; categories: Map<string, PackRow[]>; pcs: number; material: number; date: string;
}) {
  const showBatch = rows.some((p) => p.batch_date || p.made_outside);
  const unitsOf = (items: PackRow[]) => {
    const m = new Map<string, number>();
    for (const p of items) if (p.bulk_unit) m.set(p.bulk_unit, (m.get(p.bulk_unit) ?? 0) + (p.bulk_used ?? 0));
    return m;
  };
  const boxed = rows.filter((p) => (p.per_case ?? 1) > 1);
  const boxes = boxed.reduce((a, p) => a + (p.cases ?? 0), 0);
  const loose = boxed.reduce((a, p) => a + (p.loose ?? 0), 0);
  const all = unitsOf(rows);
  return (
    <>
      <table>
        <Cols w={[30, showBatch ? 150 : 178, 58, 40, 36, 48, 62, ...(showBatch ? [64] : []), 52]} />
        <thead>
          <tr>
            <th>Code</th><th>SKU</th><th>Packed in</th><th className="r">Boxes</th><th className="r">Loose</th><th className="r">Pieces</th>
            <th className="r">Bulk used</th>{showBatch ? <th>Batch</th> : null}<th className="r">Material ₹</th>
          </tr>
        </thead>
        <tbody>
          {[...categories].map(([cat, items]) => (
            <Fragment key={cat}>
              <tr className="dpr-group">
                <td colSpan={5}>{cat}</td>
                <td className="r">{num(items.reduce((a, p) => a + (p.pcs ?? 0), 0))}</td>
                <td className="r">{byUnit(unitsOf(items))}</td>
                {showBatch ? <td /> : null}
                <td className="r">{num(items.reduce((a, p) => a + (p.material ?? 0), 0))}</td>
              </tr>
              {items.map((p) => {
                const single = (p.per_case ?? 1) <= 1;
                return (
                  <tr key={p.code}>
                    <td className="s">{p.code}</td><td>{p.name.startsWith("Gaia ") ? p.name.slice(5) : p.name}</td><td className="s">{packedIn(p)}</td>
                    <td className="r">{single || !p.cases ? "–" : num(p.cases)}</td>
                    <td className="r">{single || p.cases_only || !p.loose ? "–" : num(p.loose)}</td>
                    <td className="r">{num(p.pcs)}</td>
                    <td className="r">{p.bulk_used ? qty(p.bulk_used, p.bulk_unit) : "—"}</td>
                    {showBatch ? <td className="s">{p.made_outside ? "Made outside" : p.batch_date ? batchLabel(p) : "—"}</td> : null}
                    <td className="r">{p.material ? num(p.material) : "—"}</td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
          <tr className="dpr-total">
            <td colSpan={3}>Total · {rows.length} SKUs</td>
            <td className="r">{boxes ? num(boxes) : "–"}</td><td className="r">{loose ? num(loose) : "–"}</td><td className="r">{num(pcs)}</td>
            <td className="r">{[...all].filter(([, v]) => Math.abs(v) > 0.0001).map(([u, v]) => <div key={u}>{smart(v)} {u}</div>)}</td>
            {showBatch ? <td /> : null}<td className="r">{rupee(material)}</td>
          </tr>
        </tbody>
      </table>
      <p className="dpr-note">
        Pieces = boxes × pieces a box + loose. Bulk used = pieces × bulk in each piece. Material ₹ is the packing material booked for the SKU
        on this day. Boxes count only SKUs packed in boxes or crates.
        {!showBatch && date < "2026-11-21" ? " The batch each SKU was packed from is asked from 21 Nov 2026, so these lines have none." : ""}
      </p>
    </>
  );
}

// ------------------------------------------------------------------ charts: black bars on white
type Bar = { label: string; value: number; text: string; box?: number | null };

/** Horizontal bars on one scale; `box`, when given, is an empty outline on the same scale (a tank's capacity). */
function Bars({ title, note, rows, label = 70, text = 86 }: { title: string; note: string; rows: Bar[]; label?: number; text?: number }) {
  const max = Math.max(0, ...rows.map((r) => Math.max(r.value, r.box ?? 0))) || 1;
  return (
    <div>
      <div className="dpr-chart-title">{title}</div>
      <div className="dpr-chart-note">{note}</div>
      {rows.length ? (
        <div className="dpr-bars" style={{ gridTemplateColumns: `${label}pt minmax(0, 1fr) ${text}pt` }}>
          {rows.map((r, i) => (
            <Fragment key={i}>
              <span className="dpr-bar-label">{r.label}</span>
              <svg className="dpr-bar" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
                {r.box ? <rect x="0" y="0.5" width={(100 * r.box) / max} height="9" fill="none" stroke="#000" strokeWidth="0.6" vectorEffect="non-scaling-stroke" /> : null}
                {r.value > 0 ? <rect x="0" y="0.5" width={Math.max(0.4, (100 * r.value) / max)} height="9" fill="#000" /> : null}
              </svg>
              <span className="dpr-bar-text">{r.text}</span>
            </Fragment>
          ))}
        </div>
      ) : <div className="dpr-empty">Nothing on this day</div>}
    </div>
  );
}

/** Two bars a row, made (solid) over packed (outline); each unit (L, kg) has its own scale. */
function Pairs({ title, note, rows }: { title: string; note: string; rows: { label: string; unit: string; made: number; packed: number }[] }) {
  const max = new Map<string, number>();
  for (const r of rows) max.set(r.unit, Math.max(max.get(r.unit) ?? 0, r.made, r.packed));
  return (
    <div>
      <div className="dpr-chart-head">
        <div className="dpr-chart-title">{title}</div>
        <div className="dpr-legend">
          <svg viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10" fill="#000" /></svg>Made
          <svg viewBox="0 0 10 10" aria-hidden="true"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="#000" /></svg>Packed
        </div>
      </div>
      <div className="dpr-chart-note">{note}</div>
      {rows.length ? (
        <div className="dpr-bars dpr-pairs" style={{ gridTemplateColumns: "86pt minmax(0, 1fr) 86pt" }}>
          {rows.map((r, i) => {
            const m = max.get(r.unit) || 1;
            return (
              <Fragment key={i}>
                <span className="dpr-bar-label">{r.label}</span>
                <svg className="dpr-bar dpr-pair" viewBox="0 0 100 13" preserveAspectRatio="none" aria-hidden="true">
                  {r.made > 0 ? <rect x="0" y="0" width={Math.max(0.4, (100 * r.made) / m)} height="5.6" fill="#000" /> : null}
                  {r.packed > 0 ? <rect x="0" y="7.2" width={Math.max(0.4, (100 * r.packed) / m)} height="5.6" fill="none" stroke="#000" strokeWidth="0.6" vectorEffect="non-scaling-stroke" /> : null}
                </svg>
                <span className="dpr-bar-text">{r.made ? smart(r.made) : "—"} / {r.packed ? smart(r.packed) : "—"} {r.unit}</span>
              </Fragment>
            );
          })}
        </div>
      ) : <div className="dpr-empty">Nothing on this day</div>}
    </div>
  );
}

function Chevron() {
  return (
    <svg className="dpr-chev" viewBox="0 0 12 22" aria-hidden="true">
      <path d="M4.3 7 7.7 11 4.3 15" fill="none" stroke="#000" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="dpr-sec">
      <div className="dpr-sec-head"><h2 className="dpr-sec-title">{title}</h2><span className="dpr-sec-note">{note}</span></div>
      {children}
    </section>
  );
}

function Cols({ w }: { w: number[] }) {
  const t = w.reduce((a, x) => a + x, 0);
  return <colgroup>{w.map((x, i) => <col key={i} style={{ width: `${(100 * x) / t}%` }} />)}</colgroup>;
}

// ------------------------------------------------------------------ helpers
const NO_FLOW: Flow = { milkIn: 0, back: 0, drawn: 0, transfer: 0, other: 0 };
const SHIFT: Record<string, string> = { M: "Morning", E: "Evening" };
const shiftRank = (s: string) => (s === "M" ? 0 : s === "E" ? 1 : 2);
const BOX: Record<string, string> = { CRT: "Crate", CBX: "Box", BOX: "Box", BAG: "Bag", TIN: "Tin", JAR: "Jar" };

function packedIn(p: PackRow) {
  const n = Math.round(p.per_case ?? 1);
  if (n <= 1) return "Single";
  const u = (p.case_unit ?? "").toUpperCase();
  return `${BOX[u] ?? (u ? `${u.slice(0, 1)}${u.slice(1).toLowerCase()}` : "Case")} of ${n}`;
}

function batchLabel(p: PackRow) {
  const d = new Date(`${(p.batch_date ?? "").slice(0, 10)}T00:00:00Z`);
  const when = d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
  return p.batch_product && p.batch_product !== p.bulk_product ? `${when} · ${p.batch_product}` : when;
}

function labels(date: string, pulledAt: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { timeZone: "UTC", ...o });
  const pulled = new Date(pulledAt).toLocaleString("en-GB", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return {
    weekday: f({ weekday: "long" }), long: f({ day: "numeric", month: "long", year: "numeric" }),
    short: f({ day: "numeric", month: "short", year: "numeric" }), pulled: `${pulled} IST`,
  };
}

/** The report's own styles: A4 pages with a running header and "Page x of y", and only the report on paper. */
function css(day: { weekday: string; long: string; short: string }) {
  const font = `"Helvetica Neue", Helvetica, Arial, sans-serif`;
  const q = (s: string) => JSON.stringify(s);
  return `
#day-report-print { display: none; }
@page {
  size: A4; margin: 18mm 16mm 17mm;
  @top-left { content: "Daily Production Report"; font: 500 7.8pt ${font}; color: #000; }
  @top-right { content: ${q(`${day.weekday}, ${day.long}`)}; font: 7.8pt ${font}; color: #000; }
  @bottom-left { content: ${q(`Gaia Plant, Tum Gaon  ·  Daily Production Report  ·  ${day.short}`)}; font: 7.3pt ${font}; color: #000; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 7.3pt ${font}; color: #000; }
}
@page :first { @top-left { content: none; } @top-right { content: none; } }
@media print {
  html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
  body.dpr-printing > *:not(#day-report-print) { display: none !important; }
  body.dpr-printing #day-report-print { display: block !important; }
}
.dpr { color: #000; background: #fff; font-family: ${font}; font-size: 8.4pt; line-height: 1.3; font-variant-numeric: tabular-nums; }
.dpr, .dpr * { box-sizing: border-box; }
.dpr h1, .dpr h2, .dpr p, .dpr ul { margin: 0; padding: 0; font: inherit; }
.dpr .dpr-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16pt; }
.dpr .dpr-title { font-size: 21pt; font-weight: 700; line-height: 1.15; }
.dpr .dpr-subtitle { font-size: 9.5pt; margin-top: 3pt; }
.dpr .dpr-when { text-align: right; white-space: nowrap; }
.dpr .dpr-weekday { font-size: 9pt; }
.dpr .dpr-date { font-size: 13pt; font-weight: 700; line-height: 1.25; }
.dpr .dpr-pulled { font-size: 7pt; margin-top: 3pt; }
.dpr .dpr-steps { display: flex; align-items: flex-start; margin-top: 24pt; }
.dpr .dpr-step { flex: 1 1 0; min-width: 0; }
.dpr .dpr-chev { flex: none; width: 12pt; height: 22pt; margin-top: 9pt; }
.dpr .dpr-step-label { font-size: 7.6pt; }
.dpr .dpr-step-value { font-size: 15pt; font-weight: 700; line-height: 1.2; margin-top: 3pt; white-space: nowrap; }
.dpr .dpr-step-sub { font-size: 7.4pt; line-height: 1.27; margin-top: 1pt; }
.dpr .dpr-charts { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 26pt; row-gap: 22pt; margin-top: 26pt; }
.dpr .dpr-chart-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8pt; }
.dpr .dpr-chart-title { font-size: 9.5pt; font-weight: 700; }
.dpr .dpr-chart-note { font-size: 7.4pt; margin: 2pt 0 8pt; }
.dpr .dpr-legend { display: flex; align-items: center; gap: 3pt; font-size: 7.4pt; white-space: nowrap; }
.dpr .dpr-legend svg { width: 6pt; height: 6pt; margin-left: 5pt; overflow: visible; }
.dpr .dpr-bars { display: grid; align-items: center; column-gap: 6pt; row-gap: 6pt; font-size: 7.8pt; }
.dpr .dpr-pairs { row-gap: 7pt; }
.dpr .dpr-bar-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dpr .dpr-bar-text { text-align: right; white-space: nowrap; }
.dpr .dpr-bar { display: block; width: 100%; height: 7.5pt; overflow: visible; }
.dpr .dpr-pair { height: 12.5pt; }
.dpr .dpr-empty { font-size: 8pt; }
.dpr .dpr-sec { margin-top: 20pt; break-inside: avoid; }
.dpr .dpr-sec-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; margin-bottom: 7pt; }
.dpr .dpr-sec-title { font-size: 12.5pt; font-weight: 700; line-height: 1.2; }
.dpr .dpr-count { font-weight: 400; }
.dpr .dpr-sec-note { font-size: 7.6pt; }
.dpr .dpr-checks-sec { margin-top: 24pt; }
.dpr .dpr-checks { list-style: disc; padding-left: 11pt; margin-top: 6pt; }
.dpr .dpr-checks li { margin-bottom: 3pt; line-height: 1.38; }
.dpr .dpr-ok { margin-top: 6pt; }
.dpr .dpr-details { break-before: page; }
.dpr .dpr-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 24pt; align-items: start; }
.dpr .dpr-subhead { font-size: 9pt; font-weight: 700; margin-bottom: 5pt; }
.dpr .dpr-gap { margin-top: 10pt; }
.dpr .dpr-note { font-size: 7.3pt; line-height: 1.32; margin-top: 6pt; }
.dpr .dpr-source { font-size: 7.3pt; margin-top: 18pt; }
.dpr table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.dpr thead { display: table-header-group; }
.dpr tr { break-inside: avoid; }
.dpr th { font-weight: 500; font-size: 7.5pt; text-align: left; vertical-align: bottom; padding: 0 4pt 6pt; }
.dpr td { padding: 2.7pt 4pt; vertical-align: middle; }
.dpr th:first-child, .dpr td:first-child { padding-left: 0; }
.dpr th:last-child, .dpr td:last-child { padding-right: 0; }
.dpr .r { text-align: right; }
.dpr .b { font-weight: 700; }
.dpr .s { font-size: 7.6pt; }
.dpr tr.dpr-group td { font-weight: 700; padding-top: 9pt; }
.dpr tr.dpr-total td { font-weight: 700; padding-top: 8pt; }
.dpr table.dpr-top td { vertical-align: top; padding-top: 4.5pt; padding-bottom: 4.5pt; }
.dpr table.dpr-top tr.dpr-total td { padding-top: 8pt; }
.dpr table.dpr-tight td { padding-top: 2.4pt; padding-bottom: 2.4pt; }
`;
}
