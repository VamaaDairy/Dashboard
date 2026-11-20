import { Suspense } from "react";
import { DispatchNav } from "./nav";

/** Every Dispatch page: the section's title and tabs, then the page across the whole width. */
export default function DispatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="px-4 pt-3 md:px-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground">Dispatch</h1>
          <p className="text-[13px] text-tertiary-foreground">Confirmed orders onto trips, the trucks on the road, and how every trip went.</p>
        </div>
        <Suspense fallback={<div className="mt-2 h-10 border-b border-border" />}>
          <DispatchNav />
        </Suspense>
      </div>
      {children}
    </div>
  );
}
