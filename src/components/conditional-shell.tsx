"use client";

import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, type SidebarClass } from "./app-sidebar";

const PUBLIC_ROUTES = ["/login"];

export function ConditionalShell({
  children, classes, calc,
}: {
  children: React.ReactNode;
  classes: SidebarClass[];
  calc: { node_count: number | null; error_count: number; duration_ms: number | null } | null;
}) {
  const pathname = usePathname();

  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return <main className="flex-1 bg-white text-slate-800 min-h-screen">{children}</main>;
  }

  return (
    <SidebarProvider>
      <AppSidebar classes={classes} calc={calc} />
      <main className="flex-1 min-w-0 bg-white text-slate-800">
        <SidebarTrigger />
        {children}
      </main>
    </SidebarProvider>
  );
}
