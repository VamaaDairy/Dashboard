"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check, ChevronRight, ChevronsUpDown, LogOut, Package, RefreshCw,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { GaiaLogo } from "@/components/brand";
import { recalculate } from "@/app/actions";
import { CLASS_ICONS, SECTIONS, sectionFor, type NavItem, type NavSection } from "@/lib/nav";

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

  // Which section is showing. The page you are on picks it; otherwise the last one you chose.
  // A page that sits in several sections (dashboards, Labour, ...) keeps the section you are in.
  const [section, setSection] = useState<string>(() => sectionFor(pathname) ?? "plant");
  const [picking, setPicking] = useState(false);
  const sectionRef = useRef<string | null>(null);
  useEffect(() => { sectionRef.current = section; }, [section]);
  useEffect(() => {
    let current = sectionRef.current;
    if (current === null) {
      // first load: the section chosen last time, if this page is in it
      try { current = localStorage.getItem("sidebar-section"); } catch { /* storage unavailable */ }
    }
    const here = sectionFor(pathname, current);
    if (here) {
      setSection(here);
      try { localStorage.setItem("sidebar-section", here); } catch { /* ignore */ }
    } else {
      try {
        const saved = localStorage.getItem("sidebar-section");
        if (saved && SECTIONS.some((s) => s.id === saved)) setSection(saved);
      } catch { /* storage unavailable */ }
    }
    setPicking(false);
  }, [pathname]);
  const chooseSection = (id: string) => {
    setSection(id);
    setPicking(false);
    try { localStorage.setItem("sidebar-section", id); } catch { /* ignore */ }
  };

  // Which items with sub-items are expanded. The one you're in opens by itself;
  // the rest remember how you left them (per browser, best effort).
  const inItem = (i: NavItem) => !!i.children?.some((c) => pathname.startsWith(c.href)) || (i.href !== "/" && pathname.startsWith(i.href));
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("sidebar-open-items") ?? "{}") as Record<string, boolean>;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a saved preference after mount
      setOpenItems((s) => ({ ...saved, ...s }));
    } catch { /* storage unavailable - keep the defaults */ }
  }, []);
  const itemId = (s: NavSection, i: NavItem) => `${s.id}:${i.key}:${i.label}`;
  const isOpen = (s: NavSection, i: NavItem) => openItems[itemId(s, i)] ?? inItem(i);
  const toggleItem = (s: NavSection, i: NavItem) =>
    setOpenItems((o) => {
      const next = { ...o, [itemId(s, i)]: !isOpen(s, i) };
      try { localStorage.setItem("sidebar-open-items", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.success) setUser({ name: d.name ?? d.email, role: d.role ?? "", levels: d.levels ?? {} }); })
      .catch(() => {});
  }, []);

  // Until we know who is signed in, show nothing that needs access.
  const isOwner = user?.role === "owner";
  const can = (key: string) => isOwner || (!!user && (user.levels[key] ?? "none") !== "none");
  const showMasters = can("masters");
  const visibleItem = (item: NavItem): NavItem[] => {
    if (item.ownerOnly) return isOwner ? [item] : [];
    if (!item.children) return can(item.key) ? [item] : [];
    const children = item.children.filter((c) => can(c.key));
    if (!children.length) return [];
    // the item's own page may be off-limits while a child is allowed - link to that child instead
    return [{ ...item, href: can(item.key) ? item.href : children[0].href, children }];
  };
  const visibleSections = SECTIONS.flatMap((s) => {
    if (s.ownerOnly && !isOwner) return [];
    const groups = s.groups
      .map((g) => ({ ...g, items: g.items.flatMap(visibleItem) }))
      .filter((g) => g.items.length || (g.classes && showMasters && classes.length));
    const extra = s.id === "admin" && isOwner; // Recalculate lives here
    return groups.length || extra ? [{ ...s, groups }] : [];
  });
  const current = visibleSections.find((s) => s.id === section) ?? visibleSections[0];
  const canRecalc = isOwner;

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
        {/* ---------------- section switcher ---------------- */}
        {current ? (
          <SidebarMenu className="mt-3">
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip={`Section: ${current.label}`}
                aria-expanded={picking}
                className="border bg-sidebar-accent/40"
                render={
                  <button onClick={() => setPicking((v) => !v)}>
                    <current.icon />
                    <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Section</span>
                      <span className="truncate font-semibold">{current.label}</span>
                    </span>
                    <ChevronsUpDown className="ml-auto opacity-60" />
                  </button>
                }
              />
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
      </SidebarHeader>

      <SidebarContent>
        {picking ? (
          <SidebarGroup>
            <SidebarGroupLabel>Switch section</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleSections.map((s) => (
                  <SidebarMenuItem key={s.id}>
                    <SidebarMenuButton
                      isActive={s.id === current?.id}
                      tooltip={s.label}
                      render={
                        <button onClick={() => chooseSection(s.id)}>
                          <s.icon />
                          <span className="flex-1 text-left">{s.label}</span>
                          {s.id === current?.id ? <Check className="opacity-70" /> : null}
                        </button>
                      }
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : current ? (
          <>
            {current.groups.map((g) => (
              <SidebarGroup key={g.label}>
                <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {g.items.map((item) => (
                      <SidebarMenuItem key={`${item.key}:${item.label}`}>
                        <SidebarMenuButton
                          isActive={item.exact ? pathname === item.href : item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
                          tooltip={item.label}
                          render={
                            <Link href={item.href}>
                              <item.icon />
                              <span>{item.label}</span>
                            </Link>
                          }
                        />
                        {item.children ? (
                          <SidebarMenuAction
                            onClick={() => toggleItem(current, item)}
                            aria-expanded={isOpen(current, item)}
                            aria-label={`${isOpen(current, item) ? "Hide" : "Show"} ${item.label} pages`}
                            title={`${isOpen(current, item) ? "Hide" : "Show"} ${item.label} pages`}
                          >
                            <ChevronRight className={`transition-transform ${isOpen(current, item) ? "rotate-90" : ""}`} />
                          </SidebarMenuAction>
                        ) : null}
                        {item.children && isOpen(current, item) ? (
                          <SidebarMenuSub>
                            {item.children.map((sub) => (
                              <SidebarMenuSubItem key={sub.href}>
                                <SidebarMenuSubButton
                                  isActive={sub.exact ? pathname === sub.href : pathname.startsWith(sub.href)}
                                  render={<Link href={sub.href}>{sub.label}</Link>}
                                />
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        ) : null}
                      </SidebarMenuItem>
                    ))}
                    {/* standing rates, changed now and then */}
                    {g.classes && showMasters ? classes.map((c) => {
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
                    }) : null}
                    {current.id === "admin" && g.label === "System" && canRecalc ? (
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
                              <span className="flex-1 text-left">{recalcing ? "Recalculating…" : "Recalculate"}</span>
                              {calc?.error_count ? (
                                <span className="num rounded-full bg-destructive/15 px-1.5 text-[10px] font-bold text-destructive">
                                  {calc.error_count}
                                </span>
                              ) : null}
                            </button>
                          }
                        />
                      </SidebarMenuItem>
                    ) : null}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </>
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
          <a href="/profile" title="My profile" className="flex min-w-0 flex-col leading-tight hover:underline">
            <span className="truncate text-xs font-semibold text-foreground">{user?.name ?? "—"}</span>
            <span className="text-xs capitalize text-muted-foreground">{user?.role ?? ""}</span>
          </a>
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
