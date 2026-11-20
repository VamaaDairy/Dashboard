import { Suspense } from "react";
import { DispatchNav } from "./nav";

/** Every Dispatch page: the tabs, then the page across the whole width (the map pages fill the screen below them). */
export default function DispatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="px-4 md:px-6">
        <Suspense fallback={<div className="h-11 border-b border-foreground/10" />}>
          <DispatchNav />
        </Suspense>
      </div>
      {children}
    </div>
  );
}
