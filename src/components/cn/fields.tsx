"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type Option = string | { value: string; label: string };
const norm = (o: Option) => (typeof o === "string" ? { value: o, label: o } : o);

/** A dropdown that shows the label of the chosen option and a placeholder when nothing is chosen. */
export function Pick({ value, onChange, options, placeholder = "Select…", className, id }: {
  value: string; onChange: (v: string) => void; options: Option[]; placeholder?: string; className?: string; id?: string;
}) {
  const items = options.map(norm);
  return (
    <Select items={items} value={value || null} onValueChange={(v) => onChange((v as string | null) ?? "")}>
      <SelectTrigger id={id} className={cn("h-9 w-full border-border-control-hover bg-card md:h-8", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="min-w-(--anchor-width)">
        {items.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** A tick box with its label; the whole row is the click target. */
export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2.5 text-[13px] transition-colors hover:bg-accent/50 has-data-checked:border-border-brand has-data-checked:bg-primary/5">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span>{children}</span>
    </label>
  );
}
