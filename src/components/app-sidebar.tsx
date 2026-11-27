"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, ChevronsDownUp, LogOut, Package, RefreshCw, Search, X,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarInput, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar,
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

  const { setOpen: setSidebarOpen } = useSidebar();
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();

  // Every section shows, one under the other; each opens and closes on its own. The one you are in
  // opens by itself (a page in several sections opens the one you used last); the rest remember how you left them.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const lastSection = useRef<string | null>(null);
  useEffect(() => {
    let saved: Record<string, boolean> = {};
    try {
      saved = JSON.parse(localStorage.getItem("sidebar-open-sections") ?? "{}") as Record<string, boolean>;
      if (lastSection.current === null) lastSection.current = localStorage.getItem("sidebar-section");
    } catch { /* storage unavailable */ }
    const here = sectionFor(pathname, lastSection.current);
    if (here) {
      lastSection.current = here;
      try { localStorage.setItem("sidebar-section", here); } catch { /* ignore */ }
    }
    setOpenSections((o) => ({ ...saved, ...o, ...(here ? { [here]: true } : {}) }));
  }, [pathname]);
  const saveSections = (next: Record<string, boolean>) => {
    try { localStorage.setItem("sidebar-open-sections", JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  };
  const toggleSection = (id: string) => setOpenSections((o) => saveSections({ ...o, [id]: !o[id] }));
  const collapseAll = () => setOpenSections(() => saveSections({}));

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
  const isOpen = (s: NavSection, i: NavItem) => (q ? true : openItems[itemId(s, i)] ?? inItem(i));
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
  // While searching: only what matches (a matching section or group keeps everything in it), all opened up.
  const hit = (t: string) => t.toLowerCase().includes(q);
  const shownSections: NavSection[] = !q ? visibleSections : visibleSections.flatMap((s) => {
    if (hit(s.label)) return [s];
    const groups = s.groups.flatMap((g) => {
      if (hit(g.label)) return [g];
      const items = g.items.flatMap((i) => {
        if (hit(i.label)) return [i];
        const children = i.children?.filter((c) => hit(c.label)) ?? [];
        return children.length ? [{ ...i, children }] : [];
      });
      const classHit = !!g.classes && classes.some((c) => hit(c.label));
      return items.length || classHit ? [{ ...g, items }] : [];
    });
    return groups.length ? [{ ...s, groups }] : [];
  });
  const shownClasses = q ? classes.filter((c) => hit(c.label)) : classes;
  const sectionOpen = (id: string) => (q ? true : !!openSections[id]);
  const active = (h: string, exact?: boolean) => (exact || h === "/" ? pathname === h : pathname.startsWith(h));
  const holdsPage = (s: NavSection) =>
    s.groups.some((g) => g.items.some((i) => active(i.href, i.exact) || !!i.children?.some((c) => active(c.href, c.exact))) || (!!g.classes && pathname.startsWith("/c/")));
  const openFromIcon = (id: string) => {
    setSidebarOpen(true);
    setOpenSections((o) => saveSections({ ...o, [id]: true }));
  };
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
        <div className="mt-3 flex items-center gap-1 group-data-[collapsible=icon]:hidden">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <SidebarInput
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setFilter(""); }}
              placeholder="Find a page"
              aria-label="Find a page"
              className="h-8 pl-7 pr-7"
            />
            {filter ? (
              <button onClick={() => setFilter("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <button onClick={collapseAll} title="Close all sections" aria-label="Close all sections"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
            <ChevronsDownUp className="size-4" />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* collapsed to icons: one icon per section; a click opens the sidebar on that section */}
        <SidebarGroup className="hidden group-data-[collapsible=icon]:flex">
          <SidebarMenu>
            {visibleSections.map((s) => (
              <SidebarMenuItem key={s.id}>
                <SidebarMenuButton isActive={holdsPage(s)} tooltip={s.label} render={<button onClick={() => openFromIcon(s.id)}><s.icon /><span>{s.label}</span></button>} />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <div className="py-1 group-data-[collapsible=icon]:hidden">
          {shownSections.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">No page called &quot;{filter}&quot;.</p>
          ) : null}
          {shownSections.map((s) => {
            const open = sectionOpen(s.id);
            const here = holdsPage(s);
            return (
              <SidebarGroup key={s.id} className="py-0.5">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      aria-expanded={open}
                      className={`font-semibold ${here ? "text-foreground" : "text-sidebar-foreground/85"}`}
                      render={
                        <button onClick={() => toggleSection(s.id)}>
                          <s.icon className={here ? "text-primary" : ""} />
                          <span className="flex-1 text-left">{s.label}</span>
                          {here && !open ? <span className="size-1.5 rounded-full bg-primary" aria-label="You are here" /> : null}
                          <ChevronRight className={`opacity-60 transition-transform ${open ? "rotate-90" : ""}`} />
                        </button>
                      }
                    />
                  </SidebarMenuItem>
                </SidebarMenu>
                {open ? (
                  <div className="ml-[18px] border-l border-sidebar-border pl-1.5">
                    {s.groups.map((g) => (
                      <div key={g.label} className="pb-1">
                        {s.groups.length > 1 ? (
                          <div className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</div>
                        ) : null}
                        <SidebarMenu>
                          {g.items.map((item) => (
                            <SidebarMenuItem key={`${item.key}:${item.label}`}>
                              <SidebarMenuButton
                                isActive={item.exact ? pathname === item.href : item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
                                render={
                                  <Link href={item.href}>
                                    <item.icon />
                                    <span>{item.label}</span>
                                  </Link>
                                }
                              />
                              {item.children ? (
                                <SidebarMenuAction
                                  onClick={() => toggleItem(s, item)}
                                  aria-expanded={isOpen(s, item)}
                                  aria-label={`${isOpen(s, item) ? "Hide" : "Show"} ${item.label} pages`}
                                  title={`${isOpen(s, item) ? "Hide" : "Show"} ${item.label} pages`}
                                >
                                  <ChevronRight className={`transition-transform ${isOpen(s, item) ? "rotate-90" : ""}`} />
                                </SidebarMenuAction>
                              ) : null}
                              {item.children && isOpen(s, item) ? (
                                <SidebarMenuSub className="mr-0 pr-0">
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
                          {g.classes && showMasters ? shownClasses.map((c) => {
                            const Icon = CLASS_ICONS[c.code] ?? Package;
                            const href = `/c/${c.code}`;
                            return (
                              <SidebarMenuItem key={c.code}>
                                <SidebarMenuButton
                                  isActive={pathname.startsWith(href)}
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
                          {s.id === "admin" && g.label === "System" && canRecalc && !q ? (
                            <SidebarMenuItem>
                              <SidebarMenuButton
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
                      </div>
                    ))}
                  </div>
                ) : null}
              </SidebarGroup>
            );
          })}
        </div>
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
