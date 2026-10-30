"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { closeDeletionRequestAction } from "./actions";

export function CloseButtons({ id }: { id: number }) {
  const [busy, start] = useTransition();
  const close = (status: "done" | "rejected") =>
    start(async () => {
      const r = await closeDeletionRequestAction(id, status);
      if (!r.ok) alert(r.error);
    });
  return (
    <div className="flex justify-end gap-1.5">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => close("done")}>Mark done</Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => close("rejected")}>Reject</Button>
    </div>
  );
}
