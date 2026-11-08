"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-semibold text-background">
      <Printer className="size-4" /> {label}
    </button>
  );
}
