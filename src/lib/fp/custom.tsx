import type { ReactNode } from "react";
import { query } from "@/lib/db";
import { DocEditor, type ProductOpt } from "@/components/fp/DocEditor";
import { FpScreen } from "@/components/fp/FpScreen";
import { Panel } from "@/components/orders/common";
import { optionsFor, type Option } from "./crud";
import { entityScreen, screenFor } from "./screens";
import type { DocKind } from "@/app/fp/actions";
import { PrintStockTransfer, PrintTransaction } from "@/components/fp/PrintDoc";
import { SectionShell } from "@/components/orders/SectionShell";
import { DETAILS } from "./rowActions";
import { ScrollText } from "lucide-react";
import { CompanyDashboardView } from "@/components/fp/dash/CompanyDashboard";
import { ReportScreen } from "@/components/fp/dash/ReportScreen";
import { Panel as MapPanel } from "@/components/orders/common";
import { TeamMap } from "@/components/orders/TeamMap";
import { BarChart3, CalendarCheck, Gauge, Layers, MapPinned, Globe2, Users2 } from "lucide-react";
import { dashFilters } from "./dash";
import { SectionTabs } from "@/components/orders/SectionTabs";
import { TABBED } from "./tabs";
import { ConfigEditor } from "@/components/fp/ConfigEditor";
import { configFor, configRecords, loadConfig } from "./configs";
import { canEdit as canEditKey } from "@/lib/orders/session";
import { Settings2 } from "lucide-react";
import { CATEGORY_FIELDS, categoryInsights, customerPoints, dayWise, employeePoints, marketVisits, overallSummary, productivityReport } from "./insights";

/**
 * Routes that are not a plain list: a document editor (above the list of what it created), or a
 * single document. The Footprints sidebar item "Purchase Orders" is the form, "View Purchase Orders" the list.
 */
const firmsAt = (levels: number[]) =>
  query<Option>(`select f.uid::text as id, f.name || ' (' || f.firm_code || ')' as label from fp_firm f join fp_channel c on c.uid = f.channel_uid where c.level = any($1::int[]) and f.active = 1 order by f.name`, [levels]);

const EDITORS: Record<string, { kind: DocKind; from: number[]; to: number[]; title: string; list: string }> = {
  primaryOrder: { kind: "order-primary", from: [1], to: [0], title: "New purchase order", list: "fpmybookingorders" },
  counterSale: { kind: "counter-sale", from: [0, 1], to: [], title: "New counter sale", list: "counterSale" },
  salesReturn: { kind: "sales-return", from: [3], to: [1], title: "New sales return", list: "fpsalesreturnview" },
  createStockTransfer: { kind: "stock-transfer", from: [0, 1], to: [], title: "New stock transfer", list: "stockTransferView" },
};

/** List shown under each editor. */
const LIST_OF: Record<string, string> = {
  primaryOrder: "fpmybookingorders", counterSale: "counterSale", salesReturn: "fpsalesreturnview", createStockTransfer: "stockTransferView",
};

/** Single-document screens: /fp/<route>?id=<uuid> */
const VIEWS: Record<string, { detail: string; title: string }> = {
  orderProcessing: { detail: "fpcustbookingorders", title: "Order" },
  transactionView: { detail: "fpsalesview", title: "Invoice" },
  transactionEdit: { detail: "fpsalesview", title: "Invoice" },
  editStockTransfer: { detail: "stockTransferView", title: "Stock transfer" },
  fpsales: { detail: "fpsalesview", title: "Sales" },
  fpsalesreturn: { detail: "fpsalesview", title: "Sales return" },
  fppurchase: { detail: "fpsalesview", title: "Purchase" },
  fppurchasereturn: { detail: "fpsalesview", title: "Purchase return" },
};

async function DocView({ routeKey, id }: { routeKey: string; id: string | undefined }) {
  const v = VIEWS[routeKey];
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return <SectionShell icon={ScrollText} title={v.title} subtitle="Open a document from its list to see it here."><p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-[13px] text-muted-foreground">No document selected.</p></SectionShell>;
  }
  const d = await DETAILS[v.detail](id).catch(() => null);
  if (!d) return <SectionShell icon={ScrollText} title={v.title} subtitle=""><p className="px-4 py-10 text-center text-[13px] text-muted-foreground">That document no longer exists.</p></SectionShell>;
  return (
    <SectionShell icon={ScrollText} title={d.title} subtitle={v.title}>
      <Panel title="Details">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 p-4 text-[13px] sm:grid-cols-4">
          {d.facts.map(([k, val]) => <div key={k}><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="text-foreground">{val}</dd></div>)}
        </dl>
      </Panel>
      {d.tables.map((t) => (
        <Panel key={t.title} title={t.title}>
          <div className="overflow-x-auto"><table className="w-full text-[13px]">
            <thead className="border-b border-border bg-muted/40"><tr>{t.head.map((h) => <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>)}</tr></thead>
            <tbody>{t.rows.map((r, i) => <tr key={i} className="border-b border-border/70">{r.map((c, j) => <td key={j} className="px-4 py-2">{c ?? "—"}</td>)}</tr>)}</tbody>
          </table></div>
        </Panel>
      ))}
    </SectionShell>
  );
}

export async function customScreen(routeKey: string, sp: Record<string, string>): Promise<ReactNode | null> {
  if (routeKey === "companyDashboard") return <CompanyDashboardView sp={sp} />;
  const cfg = configFor(routeKey);
  if (cfg) {
    const records = await configRecords(cfg);
    const id = records.find((r) => r.id === sp.id)?.id ?? records[0]?.id ?? "";
    const [value, editable] = await Promise.all([id ? loadConfig(cfg, id) : Promise.resolve({}), canEditKey(`fp.${routeKey}`)]);
    return (
      <SectionShell icon={Settings2} title={cfg.title} subtitle={cfg.subtitle}>
        <Panel
          title={cfg.entity === "channel" ? "Channel" : "Designation"}
          actions={
            <form action={`/fp/${cfg.route}`} className="flex items-center gap-2">
              <select name="id" defaultValue={id} className="h-8 min-w-48 rounded-lg border border-border bg-background px-2 text-[13px]">{records.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
              <button className="h-8 rounded-lg border border-border bg-white px-3 text-[12px] font-medium hover:bg-muted">Open</button>
            </form>
          }
        >
          {id ? <ConfigEditor key={id} routeKey={routeKey} recordId={id} mode={cfg.mode} fields={cfg.fields} flags={cfg.flags} initial={value} canEdit={editable} custom={cfg.custom} />
              : <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">Nothing to configure yet.</p>}
        </Panel>
      </SectionShell>
    );
  }
  const tabs = TABBED[routeKey];
  if (tabs) {
    const active = tabs.find((t) => t.key === sp.t) ?? tabs[0];
    const screen = entityScreen(routeKey, active.entity);
    if (screen) {
      const path = `/fp/${screen.route.url.replace(/^\//, "")}`;
      return (
        <FpScreen screen={screen} sp={sp} tab={active.key} entity={active.entity} heading={screen.route.title}
          above={<SectionTabs path={path} tabs={tabs.map((t) => ({ key: t.key, label: t.label }))} active={active.key} />} />
      );
    }
  }
  if (routeKey === "activity") return <ReportScreen icon={Users2} title="Market Visits" path="/fp/activity" sp={sp} load={marketVisits} />;
  if (routeKey === "frontlineEmployee") return <ReportScreen icon={CalendarCheck} title="Day-wise Visit Dashboard" path="/fp/frontlineEmployee" sp={sp} day show={["region", "team", "designation"]} load={(f) => dayWise(f, f.to)} />;
  if (routeKey === "productivity") return <ReportScreen icon={Gauge} title="Sales Rep Productivity" path="/fp/productivity" sp={sp} load={productivityReport} />;
  if (routeKey === "overallSummaryDashboard") return <ReportScreen icon={Globe2} title="Overall Summary Dashboard" path="/fp/overall-summary-dashboard" sp={sp} show={[]} load={overallSummary} />;
  if (routeKey === "categoryInsights")
    return <ReportScreen icon={Layers} title="Category Insights" path="/fp/categoryInsights" sp={sp} tabs={CATEGORY_FIELDS.map(([key, label]) => ({ key, label }))} load={(f) => categoryInsights(f, sp.field ?? "category")} />;
  if (routeKey === "location" || routeKey === "empmapview") {
    const pts = await employeePoints(dashFilters(sp));
    return (
      <SectionShell icon={MapPinned} title="Employee Map View" subtitle={`${pts.length} employees with a recorded location`}>
        <MapPanel title="Last known position"><TeamMap points={pts} /></MapPanel>
      </SectionShell>
    );
  }
  if (routeKey === "customerLocation") {
    const pts = await customerPoints({ state: sp.state ?? "", team: sp.team ?? "", channel: sp.channel ?? "" });
    return (
      <SectionShell icon={BarChart3} title="Customer Map" subtitle={`${pts.length} customers with coordinates`}>
        <MapPanel title="Customers"><TeamMap points={pts} /></MapPanel>
      </SectionShell>
    );
  }
  if (routeKey === "printTransaction" || routeKey === "printStockTransfer") {
    if (!sp.id) return <SectionShell icon={ScrollText} title="Print" subtitle="Use the Print link on an invoice or stock transfer."><p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-[13px] text-muted-foreground">No document selected.</p></SectionShell>;
    return routeKey === "printTransaction" ? <PrintTransaction id={sp.id} /> : <PrintStockTransfer id={sp.id} />;
  }
  if (VIEWS[routeKey]) return <DocView routeKey={routeKey} id={sp.id} />;
  const ed = EDITORS[routeKey];
  if (!ed) return null;
  const listScreen = screenFor(LIST_OF[routeKey]);
  if (!listScreen) return null;
  const [fromOptions, toOptions, staff, products] = await Promise.all([
    firmsAt(ed.from),
    ed.to.length ? firmsAt(ed.to) : Promise.resolve([] as Option[]),
    optionsFor("staff"),
    query<ProductOpt>(`select uid::text as id, sku_code || ' — ' || sku_name as label, dp, mrp from fp_product where active = 1 order by sku_name`),
  ]);
  const toList = ed.kind === "stock-transfer" ? staff : toOptions;
  return (
    <FpScreen
      screen={listScreen}
      sp={sp}
      heading={listScreen.route.title}
      above={
        <Panel title={ed.title}>
          <DocEditor routeKey={routeKey} kind={ed.kind} fromOptions={fromOptions} toOptions={toList} staff={staff} products={products} listHref={`/fp/${LIST_OF[routeKey] === routeKey ? "" : ""}${listScreen.route.url.replace(/^\//, "")}`} />
        </Panel>
      }
    />
  );
}
