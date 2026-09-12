"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3, Beaker, Boxes, CalendarDays, Droplets, FileClock, LayoutGrid, LogOut,
  Package, RefreshCw, Settings2, SlidersHorizontal, User,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { GaiaLogo } from "@/components/brand";
import { recalculate } from "@/app/actions";

const CLASS_ICONS: Record<string, React.ElementType> = {
  milk_batch: Droplets,
  ingredient: Beaker,
  packaging: Boxes,
  recipe: Package,
  product: Package,
};

export interface SidebarClass {
  code: string;
  label: string;
  count: number;
}

export function AppSidebar({
  classes, calc,
}: {
  classes: SidebarClass[];
  calc: { node_count: number | null; error_count: number; duration_ms: number | null } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [recalcing, setRecalcing] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.success) setUser({ name: d.name ?? d.email, role: d.role ?? "" }); })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-3 px-4 pt-5 pb-3">
        <Link href="/" className="flex items-center justify-center">
          <GaiaLogo className="w-full h-auto max-w-[195px] group-data-[collapsible=icon]:max-w-[44px] transition-all duration-200" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/"}
                  tooltip="Overview"
                  render={
                    <Link href="/">
                      <LayoutGrid />
                      <span>Overview</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/daily")}
                  tooltip="Daily production"
                  render={
                    <Link href="/daily">
                      <CalendarDays />
                      <span>Daily production</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/reports")}
                  tooltip="Production by product"
                  render={
                    <Link href="/reports">
                      <BarChart3 />
                      <span>By product</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Rates &amp; masters</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {classes.map((c) => {
                const Icon = CLASS_ICONS[c.code] ?? Package;
                const href = `/c/${c.code}`;
                return (
                  <SidebarMenuItem key={c.code}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(href)}
                      tooltip={c.label}
                      render={
                        <Link href={href}>
                          <Icon />
                          <span className="flex-1">{c.label}</span>
                          <span className="num text-[11px] text-slate-400">{c.count}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {[
                { href: "/parameters", label: "Parameters", icon: SlidersHorizontal },
                { href: "/schema", label: "Columns & classes", icon: Settings2 },
                { href: "/audit", label: "Change log", icon: FileClock },
              ].map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.label}
                    render={
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-4 space-y-1">
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-1.5">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${calc?.error_count ? "bg-red-500" : "bg-[#3E9B4F]"}`} />
            {calc ? `${calc.node_count ?? 0} values · ${calc.duration_ms ?? 0} ms` : "not calculated"}
          </div>
          {calc?.error_count ? (
            <div className="mt-0.5 text-red-600">{calc.error_count} formula error(s)</div>
          ) : null}
        </div>

        <SidebarMenuButton
          tooltip="Recalculate"
          render={
            <button
              onClick={() => { setRecalcing(true); recalculate().finally(() => setRecalcing(false)); }}
              disabled={recalcing}
              className="w-full flex items-center gap-2 text-[#2B4C86] disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${recalcing ? "animate-spin" : ""}`} />
              <span>{recalcing ? "Recalculating…" : "Recalculate"}</span>
            </button>
          }
        />

        <SidebarMenuButton
          tooltip="Profile"
          render={
            <Link href="/parameters">
              <User />
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold text-slate-700 truncate">{user?.name ?? "—"}</span>
                <span className="text-xs text-slate-400 capitalize">{user?.role ?? ""}</span>
              </div>
            </Link>
          }
        />

        <SidebarMenuButton
          tooltip="Logout"
          render={
            <button onClick={handleLogout} className="w-full flex items-center gap-2 text-red-500 hover:text-red-700">
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          }
        />
      </SidebarFooter>
    </Sidebar>
  );
}
