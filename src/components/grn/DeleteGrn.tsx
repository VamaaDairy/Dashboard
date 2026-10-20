"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteGrn } from "@/app/pod/actions";

export function DeleteGrn({ id, invoice }: { id: number; invoice: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Delete"
      aria-label={`Delete POD for invoice ${invoice}`}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
      onClick={() => {
        if (!confirm(`Delete the POD image for invoice ${invoice}?`)) return;
        start(async () => { await deleteGrn(id); router.refresh(); });
      }}
    >
      <Trash2 className="size-4" />
    </button>
  );
}
