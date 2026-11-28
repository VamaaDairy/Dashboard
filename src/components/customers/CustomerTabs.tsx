import Link from "next/link";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { CUSTOMER_KINDS, type CustomerKind } from "@/lib/customers";

/** Distributors / Retailers / D2C customers / Duplicates, with how many of each. */
export function CustomerTabs({ on, counts, duplicates, showD2c = true }: { on: CustomerKind | "duplicates"; counts: Record<CustomerKind, number>; duplicates?: number; showD2c?: boolean }) {
  const tab = (active: boolean) =>
    cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted");
  return (
    <nav className="flex flex-wrap gap-1.5">
      {CUSTOMER_KINDS.filter((k) => showD2c || k.key !== "d2c").map((k) => (
        <Link key={k.key} href={k.key === "d2c" ? "/d2c/customers" : `/customers/${k.key}`} className={tab(on === k.key)}>
          {k.label} <span className="num opacity-70">{counts[k.key].toLocaleString("en-IN")}</span>
        </Link>
      ))}
      <Link href="/customers/duplicates" className={tab(on === "duplicates")}>
        <Copy className="size-3.5" /> Same mobile twice{duplicates !== undefined ? <span className="num opacity-70">{duplicates}</span> : null}
      </Link>
    </nav>
  );
}
