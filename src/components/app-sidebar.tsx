"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Beaker, Boxes, CalendarDays, ChevronRight, ClipboardCheck, Contact, Cylinder, Droplets, FileClock, Fuel, Home, LogOut,
  MessageCircle, Package, ReceiptText, RefreshCw, Scale, Truck, UserPlus, Users, Zap,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
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

/**
 * The two things done every day, and nothing else at this level. Everything
 * that is set up once and then left alone lives further down.
 */
interface NavItem {
  href: string; key: string; label: string; icon: React.ElementType; exact?: boolean;
  children?: { href: string; key: string; label: string; exact?: boolean }[];
}
const DAILY: NavItem[] = [
  { href: "/", key: "today", label: "Today", icon: Home, exact: true },
  {
    href: "/procurement", key: "procurement", label: "Milk in", icon: Droplets,
    children: [
      { href: "/procurement/vamaa", key: "procurement.collections", label: "Collections" },
      { href: "/procurement/rate-chart", key: "procurement.rates", label: "Rate chart" },
      { href: "/procurement/dashboard", key: "procurement.dashboard", label: "Dashboard" },
    ],
  },
  { href: "/farmers", key: "farmers", label: "Farmers", icon: Contact },
  {
    href: "/tanks", key: "tanks", label: "Tanks", icon: Cylinder,
    children: [
      { href: "/tanks", key: "tanks", label: "Daily", exact: true },
      { href: "/tanks/dashboard", key: "tanks.dashboard", label: "Dashboard" },
    ],
  },
  {
    href: "/daily", key: "production", label: "Production", icon: CalendarDays,
    children: [
      { href: "/daily", key: "production", label: "Daily batches", exact: true },
      { href: "/daily/sku", key: "production.sku", label: "SKU packing" },
      { href: "/daily/products", key: "production.products", label: "Products & ingredients" },
      { href: "/daily/dashboard", key: "production.dashboard", label: "Dashboard" },
    ],
  },
  {
    href: "/fuel", key: "fuel", label: "Fuel", icon: Fuel,
    children: [
      { href: "/fuel/milk-to-plant", key: "fuel.milk", label: "Milk to plant" },
      { href: "/fuel/delivery", key: "fuel.delivery", label: "Delivery outside plant" },
      { href: "/fuel/production", key: "fuel.production", label: "Production in plant" },
      { href: "/fuel/dashboard", key: "fuel.dashboard", label: "Dashboard" },
    ],
  },
  {
    href: "/transport", key: "transport", label: "Transport", icon: Truck,
    children: [
      { href: "/transport/milk-to-plant", key: "transport.milk", label: "Milk to plant" },
      { href: "/transport/delivery", key: "transport.delivery", label: "Delivery outside plant" },
    ],
  },
  {
    href: "/whatsapp", key: "whatsapp", label: "WhatsApp shop", icon: MessageCircle,
    children: [
      { href: "/whatsapp/chats", key: "whatsapp", label: "Chats" },
      { href: "/whatsapp/orders", key: "whatsapp", label: "Orders" },
      { href: "/whatsapp/products", key: "whatsapp", label: "Catalog & setup" },
      { href: "/whatsapp/reviews", key: "whatsapp", label: "Reviews" },
    ],
  },
  { href: "/labour", key: "labour", label: "Labour", icon: Users },
  { href: "/electricity", key: "electricity", label: "Electricity", icon: Zap },
  {
    href: "/credit-note", key: "creditnote", label: "Credit notes", icon: ReceiptText,
    children: [
      { href: "/credit-note", key: "creditnote", label: "All credit notes", exact: true },
      { href: "/credit-note/dashboard", key: "creditnote.dashboard", label: "Dashboard" },
    ],
  },
  {
    href: "/cn", key: "cn", label: "CN Management", icon: ClipboardCheck,
    children: [
      { href: "/cn", key: "cn", label: "All complaints", exact: true },
      { href: "/cn/approvals", key: "cn.approve", label: "Approvals" },
      { href: "/cn/finance", key: "cn.finance", label: "Finance posting" },
      { href: "/cn/dashboard", key: "cn.dashboard", label: "Dashboard" },
    ],
  },
  { href: "/outstandings", key: "outstandings", label: "Outstandings", icon: Scale },
];

/** Opened when the model itself changes - rarely, and never during a normal day. */
const SETUP = [
  { href: "/audit", key: "audit", label: "Change log", icon: FileClock },
  { href: "/users", key: "", label: "Users", icon: UserPlus, ownerOnly: true },
];

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
  const [user, setUser] = useState<{ name: string; role: string; levels: Record<string, string> } | null>(null);
  const [recalcing, setRecalcing] = useState(false);
  // Setup opens itself when you are already in it, otherwise stays shut.
  const [setupOpen, setSetupOpen] = useState(() =>
    SETUP.some((s) => pathname.startsWith(s.href)),
  );

  // Which sections with sub-items are expanded. The one you're in opens by
  // itself; the rest remember how you left them (per browser, best effort).
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DAILY.filter((i) => i.children).map((i) => [i.href, pathname.startsWith(i.href)])),
  );
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("sidebar-open-sections") ?? "{}") as Record<string, boolean>;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a saved preference after mount
      setOpenSections((s) => ({ ...s, ...saved }));
    } catch { /* storage unavailable - keep the defaults */ }
  }, []);
  useEffect(() => {
    const here = DAILY.find((i) => i.children && pathname.startsWith(i.href));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open the section you've just navigated into
    if (here) setOpenSections((s) => (s[here.href] ? s : { ...s, [here.href]: true }));
  }, [pathname]);
  const toggleSection = (href: string) =>
    setOpenSections((s) => {
      const next = { ...s, [href]: !s[href] };
      try { localStorage.setItem("sidebar-open-sections", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.success) setUser({ name: d.name ?? d.email, role: d.role ?? "", levels: d.levels ?? {} }); })
      .catch(() => {});
  }, []);

  // Until we know who is signed in, show nothing that needs access.
  const can = (key: string) => user?.role === "owner" || (!!user && (user.levels[key] ?? "none") !== "none");
  const visibleDaily = DAILY.flatMap((item) => {
    if (!("children" in item) || !item.children) return can(item.key) ? [item] : [];
    const children = item.children.filter((c) => can(c.key));
    if (!children.length) return [];
    // the section's own page may be off-limits while a child is allowed - link to that child instead
    return [{ ...item, href: can(item.key) ? item.href : children[0].href, children }];
  });
  const visibleSetup = SETUP.filter((item) => ("ownerOnly" in item ? user?.role === "owner" : can(item.key)));
  const canRecalc = user?.role === "owner";
  const showSetup = visibleSetup.length > 0 || canRecalc;
  const showMasters = can("masters");

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
        {/* ---------------- every day ---------------- */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleDaily.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={item.exact ? pathname === item.href : pathname.startsWith(item.href)}
                    tooltip={item.label}
                    render={
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    }
                  />
                  {"children" in item && item.children ? (
                    <SidebarMenuAction
                      onClick={() => toggleSection(item.href)}
                      aria-expanded={!!openSections[item.href]}
                      aria-label={`${openSections[item.href] ? "Hide" : "Show"} ${item.label} sections`}
                      title={`${openSections[item.href] ? "Hide" : "Show"} ${item.label} sections`}
                    >
                      <ChevronRight className={`transition-transform ${openSections[item.href] ? "rotate-90" : ""}`} />
                    </SidebarMenuAction>
                  ) : null}
                  {"children" in item && item.children && openSections[item.href] ? (
                    <SidebarMenuSub>
                      {item.children.map((sub) => (
                        <SidebarMenuSubItem key={sub.href}>
                          <SidebarMenuSubButton
                            isActive={"exact" in sub && sub.exact ? pathname === sub.href : pathname.startsWith(sub.href)}
                            render={<Link href={sub.href}>{sub.label}</Link>}
                          />
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ---------------- standing rates, changed now and then ---------------- */}
        {showMasters ? (
        <SidebarGroup>
          <SidebarGroupLabel>Rates &amp; masters</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {(showMasters ? classes : []).map((c) => {
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
                          <span className="num text-[11px] text-muted-foreground">{c.count}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        ) : null}

        {/* ---------------- setup: shut unless you go looking ---------------- */}
        {showSetup ? (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Setup"
                  render={
                    <button
                      onClick={() => setSetupOpen((v) => !v)}
                      className="w-full flex items-center gap-2 text-muted-foreground"
                    >
                      <ChevronRight className={`w-4 h-4 transition-transform ${setupOpen ? "rotate-90" : ""}`} />
                      <span className="flex-1 text-left">Setup</span>
                      {calc?.error_count && user?.role === "owner" ? (
                        <span className="num rounded-full bg-destructive/15 px-1.5 text-[10px] font-bold text-destructive">
                          {calc.error_count}
                        </span>
                      ) : null}
                    </button>
                  }
                />
              </SidebarMenuItem>

              {setupOpen ? (
                <>
                  {visibleSetup.map((item) => (
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
                  {canRecalc ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Recalculate"
                      render={
                        <button
                          onClick={() => { setRecalcing(true); recalculate().finally(() => setRecalcing(false)); }}
                          disabled={recalcing}
                          className="w-full flex items-center gap-2 text-primary disabled:opacity-50"
                        >
                          <RefreshCw className={`w-4 h-4 ${recalcing ? "animate-spin" : ""}`} />
                          <span>{recalcing ? "Recalculating…" : "Recalculate"}</span>
                        </button>
                      }
                    />
                  </SidebarMenuItem>
                  ) : null}
                </>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="px-2 pb-4 space-y-1">
        {/* Only worth saying when something is actually wrong. */}
        {calc?.error_count && user?.role === "owner" ? (
          <div className="block rounded-lg bg-destructive/10 px-3 py-2 text-[11px] font-semibold text-destructive group-data-[collapsible=icon]:hidden">
            {calc.error_count} formula error(s)
          </div>
        ) : null}

        <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:hidden">
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-xs font-semibold text-foreground">{user?.name ?? "—"}</span>
            <span className="text-xs capitalize text-muted-foreground">{user?.role ?? ""}</span>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <SidebarMenuButton
          tooltip="Sign out"
          className="hidden group-data-[collapsible=icon]:flex"
          render={
            <button onClick={handleLogout} className="w-full flex items-center gap-2 text-destructive">
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          }
        />
      </SidebarFooter>
    </Sidebar>
  );
}
