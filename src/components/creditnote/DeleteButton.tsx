"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteCreditNote } from "@/app/credit-note/actions";
import { Button } from "@/components/ui/button";

/** Deletes a credit note and all its items, after a confirmation. `redirectTo` is for the detail page. */
export function DeleteButton({ id, label, redirectTo, compact }: {
  id: string; label: string; redirectTo?: string; compact?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function remove() {
    if (!window.confirm(`Delete credit note ${label}? This cannot be undone.`)) return;
    start(async () => {
      const res = await deleteCreditNote(id);
      if (!res.ok) { setError(res.error); return; }
      setError(null);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  }

  if (compact) {
    return (
      <button type="button" onClick={remove} disabled={pending} title="Delete credit note"
        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
        <Trash2 className="h-4 w-4" />
      </button>
    );
  }
  return (
    <>
      <Button type="button" variant="outline" onClick={remove} disabled={pending}>
        <Trash2 className="h-4 w-4" /> {pending ? "Deleting…" : "Delete"}
      </Button>
      {error ? <span className="text-[13px] font-semibold text-destructive">{error}</span> : null}
    </>
  );
}
