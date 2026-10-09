"use client";

import { useState, useTransition } from "react";
import { RefreshCw, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publishCatalogNow, syncCatalogNow, type Result } from "@/app/whatsapp/actions";

function ActionButton({ run, icon: Icon, label, busyLabel }: {
  run: () => Promise<Result>;
  icon: React.ElementType;
  label: string;
  busyLabel: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => start(async () => {
          const r = await run();
          setMsg(r.ok ? { ok: true, text: r.message ?? "Done" } : { ok: false, text: r.error });
        })}
      >
        <Icon className={pending && Icon === RefreshCw ? "animate-spin" : ""} /> {pending ? busyLabel : label}
      </Button>
      {msg ? <span className={`max-w-md text-right text-xs ${msg.ok ? "text-muted-foreground" : "text-destructive"}`}>{msg.text}</span> : null}
    </div>
  );
}

export function SyncButton() {
  return <ActionButton run={syncCatalogNow} icon={RefreshCw} label="Sync from WhatsApp catalog" busyLabel="Syncing…" />;
}

export function PublishButton() {
  return <ActionButton run={publishCatalogNow} icon={UploadCloud} label="Publish to WhatsApp catalog" busyLabel="Publishing…" />;
}
