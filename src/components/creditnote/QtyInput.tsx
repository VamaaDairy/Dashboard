"use client";

import { Input } from "@/components/ui/input";

/**
 * A quantity as whole cases + loose pieces ("2 CRT" + "5 Pcs"). An item counted
 * singly (ppc = 1: KG, PCS ...) gets one box in its own unit.
 */
export function QtyInput({ unit, ppc, cases, loose, onChange }: {
  unit: string; ppc: number; cases: string; loose: string;
  onChange: (cases: string, loose: string) => void;
}) {
  const attrs = { type: "number", min: 0, step: "any", inputMode: "decimal" as const };
  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <Input {...attrs} value={cases} onChange={(e) => onChange(e.target.value, loose)} />
        <span className="shrink-0 text-[12px] font-medium text-muted-foreground">{unit}</span>
      </div>
      {ppc > 1 ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Input {...attrs} value={loose} onChange={(e) => onChange(cases, e.target.value)} />
          <span className="shrink-0 text-[12px] font-medium text-muted-foreground">Pcs</span>
        </div>
      ) : null}
    </div>
  );
}
