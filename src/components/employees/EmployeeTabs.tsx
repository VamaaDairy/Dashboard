import Link from "next/link";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WINGS, type WingTab } from "@/lib/employees";

/** Salesforce / Plant / Office / Not set, with how many in each, and the departments page. */
export function EmployeeTabs({ on, counts }: { on: WingTab | "departments"; counts: Record<WingTab, number> }) {
  const tab = (active: boolean) =>
    cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted");
  return (
    <nav className="flex flex-wrap gap-1.5">
      {WINGS.map((w) => (
        <Link key={w.key} href={`/employees/${w.key}`} className={tab(on === w.key)} title={w.about}>
          {w.label} <span className="num opacity-70">{counts[w.key]}</span>
        </Link>
      ))}
      <Link href="/employees/unset" className={tab(on === "unset")}>Not set <span className="num opacity-70">{counts.unset}</span></Link>
      <Link href="/employees/departments" className={tab(on === "departments")}><Building2 className="size-3.5" /> Departments</Link>
    </nav>
  );
}
