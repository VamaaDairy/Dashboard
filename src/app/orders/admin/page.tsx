import { Cog } from "lucide-react";
import { EntityPanel } from "@/components/orders/EntityPanel";
import { Panel, StatusChip, TD, TH } from "@/components/orders/common";
import { SectionShell } from "@/components/orders/SectionShell";
import { pickTab, SectionTabs, type TabDef } from "@/components/orders/SectionTabs";
import { SettingsForm } from "@/components/orders/SettingsForm";
import { UploadPanel } from "@/components/orders/UploadPanel";
import { canEdit, params, type SP } from "@/lib/orders/session";
import { getSettings, SETTINGS, syncStatus } from "@/lib/orders/settings";
import { UPLOADS } from "@/lib/orders/upload";

export const dynamic = "force-dynamic";

const TABS: TabDef[] = [
  { key: "upload", label: "Bulk upload" },
  { key: "settings", label: "Settings" },
  { key: "integration", label: "Integration status" },
  { key: "sync_log", label: "Sync log" },
];

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await params(searchParams);
  const tab = pickTab(TABS, sp.t);

  return (
    <SectionShell icon={Cog} title="Uploads, settings & integration" subtitle="Load data from CSV files, set organisation switches, and see what has synced with the ERP.">
      <SectionTabs path="/orders/admin" tabs={TABS} active={tab} />
      {tab === "upload" && <Panel title="Bulk upload"><UploadPanel options={UPLOADS} /></Panel>}
      {tab === "settings" && (
        <Panel title="Organisation settings">
          <SettingsForm defs={SETTINGS} values={await getSettings()} canEdit={await canEdit("orders.admin")} />
        </Panel>
      )}
      {tab === "integration" && <Integration />}
      {tab === "sync_log" && <EntityPanel entity="sync_log" path="/orders/admin" tab={tab} access="orders.admin" sp={sp} filterBy={["status", "entity"]} />}
    </SectionShell>
  );
}

async function Integration() {
  const rows = await syncStatus();
  return (
    <Panel title="ERP sync status">
      <table className="w-full text-[13px]">
        <thead className="border-b border-border bg-muted/40">
          <tr><th className={TH}>Entity</th><th className={`${TH} text-right`}>Records here</th><th className={TH}>Last sync</th><th className={TH}>Status</th><th className={TH}>Message</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.entity} className="border-b border-border/70">
              <td className={`${TD} font-medium capitalize text-foreground`}>{r.entity.replace(/_/g, " ")}</td>
              <td className={`${TD} text-right tabular-nums`}>{r.records}</td>
              <td className={`${TD} text-muted-foreground`}>{r.last_run ?? "Never"}</td>
              <td className={TD}>{r.status ? <StatusChip value={r.status === "success" ? "approved" : r.status === "failed" ? "rejected" : "pending"} /> : <span className="text-muted-foreground">—</span>}</td>
              <td className={`${TD} text-muted-foreground`}>{r.message ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">
        Record sync runs in the Sync log tab (a connected ERP job can write to it). Nothing syncs by itself until an ERP connection is configured.
      </p>
    </Panel>
  );
}
