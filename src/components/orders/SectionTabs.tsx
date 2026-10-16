import Link from "next/link";

export interface TabDef { key: string; label: string }

/** URL-driven tabs (?t=key) so each tab is a plain server render and can be linked to. */
export function SectionTabs({ path, tabs, active }: { path: string; tabs: TabDef[]; active: string }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.key === tabs[0].key ? path : `${path}?t=${t.key}`}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium ${
            t.key === active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function pickTab(tabs: TabDef[], t: string | undefined): string {
  return tabs.some((x) => x.key === t) ? (t as string) : tabs[0].key;
}
