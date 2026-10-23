"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Reloads the list the moment an order is added or decided (checked every few seconds while the tab is open). */
export function LiveRefresh({ everyMs = 5000 }: { everyMs?: number }) {
  const router = useRouter();
  const last = useRef<string | null>(null);

  useEffect(() => {
    let stop = false;
    const check = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/orders/pulse", { cache: "no-store" });
        if (!r.ok || stop) return;
        const { p } = (await r.json()) as { p: string };
        if (last.current !== null && last.current !== p) router.refresh();
        last.current = p;
      } catch {
        // offline for a moment: try again next time
      }
    };
    check();
    const t = setInterval(check, everyMs);
    document.addEventListener("visibilitychange", check);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router, everyMs]);

  return null;
}
