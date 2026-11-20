"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A box that fills the rest of the screen below where it starts (at least `min` px), with a button (top left) for the
 * browser's own full screen. Maps inside it follow its size.
 */
export function ScreenBox({ children, className, min = 480 }: { children: React.ReactNode; className?: string; min?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const fit = () => {
      const el = box.current;
      if (!el || document.fullscreenElement) return;
      setH(Math.max(min, Math.round(window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - 12)));
    };
    const onFull = () => setFull(document.fullscreenElement === box.current);
    fit();
    window.addEventListener("resize", fit);
    document.addEventListener("fullscreenchange", onFull);
    return () => { window.removeEventListener("resize", fit); document.removeEventListener("fullscreenchange", onFull); };
  }, [min]);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.current?.requestFullscreen?.();
  };
  return (
    <div ref={box} style={full ? undefined : { height: h ?? min }} className={cn("relative overflow-hidden bg-background", full && "h-screen w-screen", className)}>
      {children}
      <button type="button" onClick={toggle} title={full ? "Leave full screen" : "Full screen"} aria-label={full ? "Leave full screen" : "Full screen"}
        className="absolute top-3 left-3 z-20 inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background/95 shadow-sm hover:bg-muted">
        {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
      </button>
    </div>
  );
}

/** Reloads the page's data every `seconds` while the tab is in view. */
export function Refresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) router.refresh(); }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

/** ‹ date › with a date box: moves the page to another day (?date=), keeping its other settings. */
export function DayStepper({ date, base }: { date: string; base: string }) {
  const router = useRouter();
  const go = (d: string) => {
    const q = new URLSearchParams(window.location.search);
    q.set("date", d);
    router.push(`${base}?${q.toString()}`);
  };
  const step = (n: number) => {
    const x = new Date(`${date}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() + n);
    go(x.toISOString().slice(0, 10));
  };
  const btn = "inline-flex size-8 items-center justify-center rounded-lg border border-input text-sm hover:bg-muted";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => step(-1)} className={btn} aria-label="Day before">‹</button>
      <input type="date" value={date} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Delivery day"
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm" />
      <button type="button" onClick={() => step(1)} className={btn} aria-label="Next day">›</button>
    </div>
  );
}
