"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppWindow,
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardList,
  CircleDollarSign,
  FileCheck2,
  Folder,
  GraduationCap,
  Inbox,
  Kanban,
  LayoutDashboard,
  ListTodo,
  Pin,
  Plug,
  PinOff,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { UserMenu } from "@/components/layout/UserMenu";
import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";
import { useSidebarPinned } from "./useSidebarPinned";
import { cn } from "@/lib/utils/cn";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Uppercase section header the item groups under when the sidebar is
   * expanded (Sidebar.tsx) or in MobileNav's drawer — see groupNavItems(). */
  category: string;
  comingSoon?: boolean;
  /** Shows a small green "IA" pill next to the label when expanded — no
   * current nav item is actually an AI feature yet, this just wires the
   * pattern up for the day one is (explicit request, not speculative). */
  isAI?: boolean;
}

/** CRM/ATS become real links once workspace_modules.enabled is true for that
 * workspace (docs/blueprint/03-modules.md) — the (protected) layout fetches
 * that server-side and passes it down, this is the only place that decides
 * comingSoon vs. a real href.
 *
 * "Contactos" isn't a top-level item anymore — it moved under Inbox's own
 * secondary nav (src/app/(protected)/inbox/layout.tsx) as /inbox/contactos,
 * one unified communication area instead of two separate sidebar entries.
 *
 * "ATS" isn't a top-level item anymore either — it's now a tab inside CRM's
 * own tab strip (CrmAtsTabStrip.tsx), next to "Tareas". Its route (/ats,
 * /ats/[vacancyId]) deliberately did NOT move under /crm/ats — ATS has its
 * own independent workspace_modules activation flag, and nesting the route
 * would have made it unreachable if CRM were ever disabled while ATS stayed
 * enabled. Only the *navigation entry point* moved, not the module boundary.
 *
 * "KPIs" used to live as a tab inside CRM (CrmAtsTabStrip.tsx) but is now
 * its own top-level module/route (/kpis) per explicit user request — same
 * KpisSection component, same queries, not workspace_modules-gated (it
 * never was even as a CRM tab; `KpisSection` shows its own "conectá tu
 * hoja" empty state internally when there's no Google Sheets connection
 * yet, same as Inbox/Calendario/Documentos being always-on links).
 *
 * "Tareas" follows that same promotion pattern: it used to be a tab inside
 * CRM (CrmAtsTabStrip.tsx) and is now its own top-level module (/tasks),
 * redesigned into a full Notion/Linear-style workspace, per explicit user
 * request. Unlike KPIs it IS workspace_modules-gated (docs/blueprint
 * 03-modules.md's 3-layer enforcement), because unlike KPIs it has real
 * data of its own (tasks/checklists/comments/files) rather than just an
 * external-connection empty state.
 *
 * "Classroom" is a different case again: it's a GLOBAL course catalog (one
 * shared curriculum teaching Growth Link itself), not per-workspace content,
 * so it's never workspace_modules-gated either — always a real link, same
 * as KPIs/Inbox/Calendario/Documentos, per explicit user request (see
 * supabase/migrations/0071_classroom_module.sql).
 *
 * "Pólizas" moved OUT of Asesores' own tab strip (AdvisorsSecondaryNav.tsx,
 * since removed) into its own top-level module/route (/polizas, was
 * /advisors/polizas), per explicit user request — it's meant to feel like a
 * full portfolio-management platform in its own right, not a tab buried
 * inside another module. Its own category ("Pólizas") rather than folding
 * it into "Clientes" matches the requested sidebar layout exactly. The
 * `workspace_modules` gate (`policies`) was already independent of
 * `advisors` since its own creation — only the nav entry/route moved, not
 * the module boundary (same posture as every other promotion/demotion
 * above).
 *
 * "Asesores" was later relabeled "Prospectos" (still `/advisors`, still
 * `module_key='advisors'` — only the visible label changed) once "Posibles
 * Pólizas" moved out into Pólizas' own tab strip (PoliciesSecondaryNav.tsx),
 * leaving this module as purely a pre-sale deals/prospects board.
 *
 * `category` groups these into section headers (Sidebar.tsx's expanded
 * panel, MobileNav's drawer) — grouping the real items that already exist,
 * not inventing new modules to match any external reference. */
export function getNavItems(enabledModules: ReadonlySet<string>): NavItem[] {
  return [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, category: "Principal" },
    { label: "Asistente IA", href: "/asistente", icon: Bot, category: "Principal", isAI: true, comingSoon: !enabledModules.has("ai_assistant") },
    { label: "Inbox", href: "/inbox", icon: Inbox, category: "Principal" },
    { label: "CRM", href: "/crm", icon: Kanban, category: "Clientes", comingSoon: !enabledModules.has("crm") },
    { label: "Prospectos", href: "/advisors", icon: ShieldCheck, category: "Clientes", comingSoon: !enabledModules.has("advisors") },
    { label: "Mini Apps", href: "/mini-apps", icon: AppWindow, category: "Clientes", comingSoon: !enabledModules.has("mini_apps") },
    { label: "Asesoría Guiada", href: "/asesoria-guiada", icon: ClipboardList, category: "Clientes", comingSoon: !enabledModules.has("advisory_sessions") },
    { label: "Pólizas", href: "/polizas", icon: FileCheck2, category: "Pólizas", comingSoon: !enabledModules.has("policies") },
    {
      label: "Extracción IA",
      href: "/extraccion-polizas",
      icon: Sparkles,
      category: "Pólizas",
      isAI: true,
      comingSoon: !enabledModules.has("policy_extraction"),
    },
    {
      label: "Aseguradoras",
      href: "/aseguradoras",
      icon: Plug,
      category: "Pólizas",
      comingSoon: !enabledModules.has("insurance_providers"),
    },
    { label: "Calendario", href: "/calendar", icon: CalendarDays, category: "Operación" },
    { label: "Cobranza", href: "/cobranza", icon: CircleDollarSign, category: "Operación", comingSoon: !enabledModules.has("collections") },
    { label: "Metas y Bonos", href: "/metas", icon: Trophy, category: "Operación", comingSoon: !enabledModules.has("goals") },
    { label: "Tareas", href: "/tasks", icon: ListTodo, category: "Operación", comingSoon: !enabledModules.has("tasks") },
    { label: "Documentos", href: "/documents", icon: Folder, category: "Operación" },
    { label: "KPIs", href: "/kpis", icon: BarChart3, category: "Inteligencia" },
    {
      label: "Crear mi Presentación",
      href: "/presentaciones",
      icon: Sparkles,
      category: "Inteligencia",
      isAI: true,
      comingSoon: !enabledModules.has("presentations"),
    },
    { label: "Classroom", href: "/classroom", icon: GraduationCap, category: "Aprendizaje" },
  ];
}

/** Groups a flat NavItem[] by `category`, preserving first-seen order —
 * kept separate from getNavItems() itself (which stays flat) so a future
 * consumer that doesn't want grouping isn't forced into the nested shape.
 * Both Sidebar.tsx and MobileNav.tsx call this on top of the same flat
 * list. */
export function groupNavItems(items: NavItem[]): { category: string; items: NavItem[] }[] {
  const order: string[] = [];
  const grouped = new Map<string, NavItem[]>();
  for (const item of items) {
    if (!grouped.has(item.category)) {
      grouped.set(item.category, []);
      order.push(item.category);
    }
    grouped.get(item.category)!.push(item);
  }
  return order.map((category) => ({ category, items: grouped.get(category)! }));
}

/** ATS pages (/ats, /ats/[vacancyId]) live outside /crm but should still
 * highlight the CRM sidebar icon, since ATS is now reached exclusively via
 * CRM's tab strip. Exported so MobileNav.tsx shares the exact same rule
 * instead of re-deriving it. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  if (href === "/crm" && pathname.startsWith("/ats")) return true;
  return false;
}

const ROLE_LABELS: Record<string, string> = { owner: "Owner", admin: "Admin", agent: "Agente", viewer: "Viewer" };

const HOVER_CLOSE_DELAY_MS = 250;

/** Shared "text/label fade" treatment for anything that only appears once
 * the panel is expanded (nav labels, category headers, workspace name,
 * user name/email) — expand fades in with a delay (lets the width
 * animation get underway first, per the user's explicit "first the panel
 * expands, then the text appears" spec); collapse fades out immediately
 * (delay 0), otherwise label text would still read fully opaque while the
 * panel is already visibly narrower than the text, clipped mid-transition
 * by the row's own overflow-hidden. */
function fadeClassName(isExpanded: boolean) {
  return cn(
    "overflow-hidden whitespace-nowrap transition-[opacity,transform] duration-[180ms] ease-out motion-reduce:transition-none",
    isExpanded ? "opacity-100 translate-x-0 delay-100" : "pointer-events-none opacity-0 -translate-x-2 delay-0",
  );
}

function SidebarNavItem({
  item,
  isActive,
  isExpanded,
  showTooltips,
}: {
  item: NavItem;
  isActive: boolean;
  isExpanded: boolean;
  /** True until the panel's own width transition has actually finished —
   * NOT simply `!isExpanded`. Hovering an item is itself a hover of the
   * panel container, which starts the expand transition immediately, so
   * gating the tooltip on `!isExpanded` would hide it the instant it
   * should appear. Showing it until the width transition completes (see
   * Sidebar's onTransitionEnd) instead means: collapsed + hover → tooltip
   * appears right away and stays up through the expand animation → hands
   * off to the now-faded-in label text the moment the panel finishes
   * widening. */
  showTooltips: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const tooltipId = useId();
  const Icon = item.icon;
  const showTooltip = showTooltips && isHovered;

  return (
    <>
      <Link
        ref={ref}
        href={item.comingSoon ? "#" : item.href}
        aria-disabled={item.comingSoon}
        aria-current={isActive ? "page" : undefined}
        aria-describedby={showTooltip ? tooltipId : undefined}
        onClick={(e) => item.comingSoon && e.preventDefault()}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        className={cn(
          "relative mx-2 flex h-10 items-center justify-center rounded-xl transition-colors duration-150 ease-out",
          item.comingSoon
            ? "cursor-default text-neutral-600"
            : isActive
              ? "bg-accent-500 text-white shadow-[var(--elevation-glow-accent)]"
              : "text-neutral-400 hover:bg-accent-500/12 hover:text-neutral-100",
        )}
      >
        {isActive && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-white" aria-hidden="true" />}
        <span className="flex size-10 shrink-0 items-center justify-center">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <span className={cn("flex min-w-0 items-center gap-2 pr-3", isExpanded ? "flex-1" : "w-0 flex-none", fadeClassName(isExpanded))}>
          <span className="truncate text-sm font-medium">{item.label}</span>
          {item.comingSoon && (
            <Badge variant="neutral" className="ml-auto shrink-0">
              Pronto
            </Badge>
          )}
          {item.isAI && !item.comingSoon && (
            <Badge variant="success" className="ml-auto shrink-0 px-1.5 py-0 text-[10px]">
              IA
            </Badge>
          )}
        </span>
      </Link>
      <Tooltip id={tooltipId} targetRef={ref} open={showTooltip} side="right">
        {item.comingSoon ? `${item.label} (Pronto)` : item.label}
      </Tooltip>
    </>
  );
}

/** Collapsed-by-default (72px, icons only) sidebar that expands to 280px on
 * hover/focus — Linear/Slack/Notion-style floating panel, replacing the
 * previous permanently icon-only floating dock (docs/blueprint/
 * 14-design-system.md §10, updated here per explicit user request — see
 * that doc's own updated entry for the full rationale).
 *
 * Two-piece structure so hovering never reflows page content:
 * 1. `.sidebar-placeholder` — stays in the normal flex row (shrink-0), only
 *    ever 72px or 280px depending on `isPinned` (no transition of its own —
 *    pinning is a deliberate action, not something that needs to animate
 *    itself; see globals.css's `[data-sidebar-pinned]` rule for the
 *    pre-hydration width, avoiding a flash before React takes over).
 * 2. The actual floating panel — `position: fixed`, animates its own width
 *    between 72px/280px on hover/focus, rendered on top of page content so
 *    the placeholder (and therefore the main content next to it) never
 *    moves during a hover preview. z-[60] (not the app's usual z-50 overlay
 *    layer) because /tasks and /classroom's own course-player each mount a
 *    `fixed left-0 z-50` drawer at the `lg:hidden` breakpoint — one step
 *    wider than this sidebar's own `md:flex` breakpoint — so in the
 *    768–1023px band both can be visible at once; z-[60] guarantees this
 *    sidebar always wins that stacking fight instead of getting buried. */
export function Sidebar({
  enabledModules,
  workspaceName,
  role,
  userName,
  userEmail,
  userAvatarUrl = null,
  isPlatformAdmin = false,
}: {
  enabledModules: string[];
  workspaceName: string;
  role: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string | null;
  isPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const navItems = useMemo(() => getNavItems(new Set(enabledModules)), [enabledModules]);
  const groups = useMemo(() => groupNavItems(navItems), [navItems]);

  const [isPinned, setPinned] = useSidebarPinned();
  const [isHovering, setIsHovering] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isExpanded = isPinned || isHovering;

  // Tracks whether the panel's own width transition has actually finished —
  // see SidebarNavItem's showTooltips doc comment for why this can't just
  // be `!isExpanded`. Reset to false the moment it collapses, flips true
  // only once the width transition genuinely completes (onTransitionEnd
  // below). Pinned is a special case handled as a render-time invariant
  // (not an effect — this is React's sanctioned "adjust state during
  // render" pattern for exactly this kind of derived-state correction,
  // guarded so each branch only fires once per real transition, never an
  // infinite loop): on first mount with a persisted pin, or the instant pin
  // is toggled on while already hover-expanded, the panel is already at
  // 280px with nothing left to animate — `transitionend` never fires
  // because width never actually changes, so without this the tooltip
  // would get stuck showing forever alongside the already-visible labels.
  const [hasFinishedExpanding, setHasFinishedExpanding] = useState(false);
  if (!isExpanded && hasFinishedExpanding) setHasFinishedExpanding(false);
  if (isPinned && isExpanded && !hasFinishedExpanding) setHasFinishedExpanding(true);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handleEnter = useCallback(() => {
    clearCloseTimer();
    setIsHovering(true);
  }, [clearCloseTimer]);

  // 250ms grace period before collapsing — an imprecise mouse path crossing
  // the panel's own edge (or briefly moving toward a tooltip/scrollbar)
  // shouldn't flicker it closed. Cancelled by handleEnter if the mouse (or
  // focus) re-enters before the timer fires.
  const handleLeave = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setIsHovering(false), HOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  // Escape collapses an open hover-preview but deliberately never unpins —
  // a pin is an intentional, persistent choice, not something an accidental
  // Escape keystroke should undo. Also blurs focus out of the
  // now-collapsing panel so a keyboard user isn't left with a focus ring on
  // a link whose label just faded out.
  useEffect(() => {
    if (!isExpanded || isPinned) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      clearCloseTimer();
      setIsHovering(false);
      if (containerRef.current?.contains(document.activeElement)) {
        (document.activeElement as HTMLElement | null)?.blur();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, isPinned, clearCloseTimer]);

  const roleLabel = ROLE_LABELS[role] ?? role;

  return (
    <>
      <div className={cn("sidebar-placeholder hidden shrink-0 md:block", isPinned ? "w-[280px]" : "w-[72px]")} aria-hidden="true" />

      <div
        ref={containerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={(e) => {
          if (!containerRef.current?.contains(e.relatedTarget as Node | null)) handleLeave();
        }}
        onTransitionEnd={(e) => {
          if (e.propertyName === "width" && isExpanded) setHasFinishedExpanding(true);
        }}
        aria-expanded={isExpanded}
        className={cn(
          "fixed inset-y-0 left-0 z-[60] hidden flex-col overflow-hidden bg-neutral-950 transition-[width] duration-[220ms] ease-out motion-reduce:transition-none md:flex",
          isExpanded ? "w-[280px]" : "w-[72px]",
        )}
      >
        <div className="flex h-16 shrink-0 items-center px-2.5">
          <span className="flex size-10 shrink-0 items-center justify-center">
            <Logo size="sm" inverted />
          </span>
          <div className={cn("flex min-w-0 flex-1 items-center justify-between gap-2 pr-1", fadeClassName(isExpanded))}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{workspaceName}</p>
              <p className="truncate text-xs text-neutral-400">{roleLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setPinned(!isPinned)}
              aria-pressed={isPinned}
              title={isPinned ? "Desanclar sidebar" : "Anclar sidebar"}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-white/10 hover:text-white"
            >
              {isPinned ? <PinOff className="size-4" aria-hidden="true" /> : <Pin className="size-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <nav aria-label="Navegación principal" className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden py-2">
          {groups.map((group) => (
            <div key={group.category} className="flex flex-col">
              <p
                role="presentation"
                className={cn(
                  "overflow-hidden px-4 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 transition-[opacity,transform,max-height,padding] duration-[180ms] ease-out motion-reduce:transition-none",
                  isExpanded ? "max-h-8 pb-1 pt-3 opacity-100 translate-x-0 delay-100" : "pointer-events-none max-h-0 pb-0 pt-0 opacity-0 -translate-x-2 delay-0",
                )}
              >
                {group.category}
              </p>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <SidebarNavItem
                    key={item.label}
                    item={item}
                    isActive={isNavItemActive(pathname, item.href)}
                    isExpanded={isExpanded}
                    showTooltips={!hasFinishedExpanding}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2.5 px-2.5 py-3">
          <UserMenu name={userName} email={userEmail} avatarUrl={userAvatarUrl} variant="sidebar" isPlatformAdmin={isPlatformAdmin} />
          <div className={cn("flex min-w-0 flex-1 flex-col", fadeClassName(isExpanded))}>
            <span className="truncate text-xs font-medium text-white">{userName || "Tu cuenta"}</span>
            <span className="truncate text-[11px] text-neutral-400">{userEmail}</span>
          </div>
        </div>
      </div>
    </>
  );
}
