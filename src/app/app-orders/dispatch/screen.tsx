"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { control, iconButton } from "./ui";

/**
 * A box that fills the rest of the screen below where it starts (at least `min` px), with a button (top left) for the
 * browser's own full screen. Maps inside it follow its size.
 */
export function ScreenBox({ children, className, min = 480, button = "top-left" }: {
  children: React.ReactNode; className?: string; min?: number; button?: "top-left" | "top-right";
}) {
  const box = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const fit = () => {
      const el = box.current;
      if (!el || document.fullscreenElement) return;
      setH(Math.max(min, Math.round(window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - 16)));
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
        className={cn(iconButton, "absolute top-3 z-20 shadow-sm", button === "top-left" ? "left-3" : "right-3")}>
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

/** ‹ date › with a date box and a Today shortcut: moves the page to another day (?date=), keeping its other settings. */
export function DayStepper({ date, base, today }: { date: string; base: string; today: string }) {
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
  return (
    <div className="inline-flex items-center gap-1">
      <button type="button" onClick={() => step(-1)} className={iconButton} aria-label="Day before"><ChevronLeft className="size-4" /></button>
      <input type="date" value={date} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Delivery day" className={cn(control, "w-[9.25rem] tabular-nums")} />
      <button type="button" onClick={() => step(1)} className={iconButton} aria-label="Next day"><ChevronRight className="size-4" /></button>
      {date !== today ? (
        <button type="button" onClick={() => go(today)} className="ml-1 h-8 rounded-lg px-2.5 text-[13px] text-tertiary-foreground transition-colors hover:bg-muted hover:text-foreground">Today</button>
      ) : null}
    </div>
  );
}
