"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteEntity, toggleEntity } from "@/lib/masters/entity/actions";

interface Props {
  slug: string;
  id: string;
  noun: string;
  /** what to call this row in the confirmation */
  label: string;
  /** current state, or null when the master has no on / off flag */
  on: boolean | null;
}

const btn = "rounded-md px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50";

export function RowActions({ slug, id, noun, label, on }: Props) {
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok && r.error) window.alert(r.error);
    });

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Link href={`/orders/${slug}/${id}`} className={`${btn} text-foreground`}>Edit</Link>
      {on !== null ? (
        <button
          type="button"
          disabled={pending}
          className={`${btn} text-foreground`}
          onClick={() => {
            if (on && !window.confirm(`Deactivate this ${noun}${label ? ` "${label}"` : ""}? It stays in the list and can be reactivated.`)) return;
            run(() => toggleEntity(slug, id, !on));
          }}
        >
          {on ? "Deactivate" : "Activate"}
        </button>
      ) : null}
      <button
        type="button"
        disabled={pending}
        className={`${btn} text-destructive`}
        onClick={() => {
          if (!window.confirm(`Delete this ${noun}${label ? ` "${label}"` : ""} permanently? This cannot be undone.`)) return;
          run(() => deleteEntity(slug, id));
        }}
      >
        Delete
      </button>
    </div>
  );
}
