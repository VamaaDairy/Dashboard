"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteCreditNote } from "@/app/credit-note/actions";
import { buttonVariants } from "@/components/ui/button";
import type { CreditNote } from "@/lib/creditnote/data";

/** List-row actions: open the note (to review and approve it, if pending) and delete. */
export function RowActions({ note }: { note: CreditNote }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function remove() {
    if (!window.confirm(`Delete credit note ${note.challan_no}? This cannot be undone.`)) return;
    start(async () => {
      const res = await deleteCreditNote(note.id);
      if (!res.ok) { setError(res.error); return; }
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/credit-note/${note.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        {note.status === "pending" ? "Review" : "Open"}
      </Link>
      <button type="button" onClick={remove} disabled={pending} title="Delete"
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40">
        <Trash2 className="h-4 w-4" />
      </button>
      {error ? <span className="text-[12px] font-semibold text-destructive">{error}</span> : null}
    </div>
  );
}
