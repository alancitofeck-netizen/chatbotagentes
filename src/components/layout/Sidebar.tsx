"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronDown, PanelLeftClose, Star } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { UserMenu } from "@/components/layout/UserMenu";
import { Badge } from "@/components/ui/Badge";
import { useSidebarPinned } from "./useSidebarPinned";
import { useSidebarFavorites } from "./useSidebarFavorites";
import { useSidebarClosedSections } from "./useSidebarClosedSections";
import { SidebarGroupFlyout } from "./SidebarGroupFlyout";
import { cn } from "@/lib/utils/cn";
import { getSidebarNavItems, groupNavItems, isNavItemActive, type NavItem } from "@/lib/navigation/sidebarConfig";

// NavItem/getSidebarNavItems/groupNavItems/isNavItemActive now live in
// src/lib/navigation/sidebarConfig.ts, resolved from the declarative
// SIDEBAR_MODULES config there — MobileNav.tsx imports straight from that
// module too (see its own import), not from here.

const ROLE_LABELS: Record<string, string> = { owner: "Owner", admin: "Admin", agent: "Agente", viewer: "Viewer" };

/** Shared "text/label fade" treatment for anything that only appears once
 * the panel is expanded (nav labels, category headers, workspace name,
 * user name/email) — expand fades in with a delay (lets the width
 * animation get underway first), collapse fades out immediately (delay 0),
 * otherwise label text would still read fully opaque while the panel is
 * already visibly narrower than the text, clipped mid-transition by the
 * row's own overflow-hidden. */
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
  isFavorite,
  onToggleFavorite,
  isDraggable,
  onReorderFavorite,
  onFlyoutHoverStart,
  onFlyoutHoverEnd,
}: {
  item: NavItem;
  isActive: boolean;
  isExpanded: boolean;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  /** Solo true para las filas renderizadas dentro de la sección sintética
   * "Fijados" — el reorder por drag-and-drop solo aplica ahí. */
  isDraggable: boolean;
  onReorderFavorite: (fromId: string, toId: string) => void;
  /** Dispara el flyout de sección completa cuando el rail está colapsado —
   * ver SidebarGroupFlyout.tsx. No se usa cuando isExpanded. */
  onFlyoutHoverStart: (el: HTMLElement) => void;
  onFlyoutHoverEnd: () => void;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const Icon = item.icon;

  function handleEnter() {
    if (!isExpanded && ref.current) onFlyoutHoverStart(ref.current);
  }
  function handleLeave() {
    if (!isExpanded) onFlyoutHoverEnd();
  }

  return (
    <div
      className={cn("group relative mx-2 flex h-10 items-center", isDraggable && "cursor-grab active:cursor-grabbing")}
      draggable={isDraggable}
      onDragStart={isDraggable ? (e) => e.dataTransfer.setData("text/plain", item.id) : undefined}
      onDragOver={isDraggable ? (e) => e.preventDefault() : undefined}
      onDrop={
        isDraggable
          ? (e) => {
              e.preventDefault();
              const fromId = e.dataTransfer.getData("text/plain");
              if (fromId && fromId !== item.id) onReorderFavorite(fromId, item.id);
            }
          : undefined
      }
    >
      <Link
        ref={ref}
        href={item.comingSoon ? "#" : item.href}
        aria-disabled={item.comingSoon}
        aria-current={isActive ? "page" : undefined}
        onClick={(e) => item.comingSoon && e.preventDefault()}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}
        className={cn(
          "relative flex h-10 flex-1 items-center justify-center rounded-xl transition-colors duration-[220ms] ease-out",
          item.comingSoon
            ? "cursor-default text-neutral-600"
            : isActive
              ? "bg-[var(--sidebar-accent)] text-[var(--on-accent)] shadow-[var(--elevation-glow-accent)]"
              : "text-neutral-400 hover:bg-[var(--sidebar-accent)]/12 hover:text-neutral-100",
        )}
      >
        {isActive && (
          <motion.span
            layoutId="sidebar-active-indicator"
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-white"
            aria-hidden="true"
          />
        )}
        <motion.span whileHover={{ scale: 1.08 }} transition={{ duration: 0.2 }} className="flex size-10 shrink-0 items-center justify-center">
          <Icon className="size-[18px]" aria-hidden="true" />
        </motion.span>
        <span className={cn("flex min-w-0 items-center gap-2 pr-2", isExpanded ? "flex-1" : "w-0 flex-none", fadeClassName(isExpanded))}>
          <span className="truncate text-sm font-medium">{item.label}</span>
          {(item.comingSoon || (item.isAI && !item.comingSoon)) && (
            <span className="ml-auto flex shrink-0 items-center gap-1">
              {item.comingSoon && <Badge variant="neutral">Pronto</Badge>}
              {item.isAI && !item.comingSoon && (
                <Badge variant="success" className="px-1.5 py-0 text-[10px]">
                  IA
                </Badge>
              )}
            </span>
          )}
        </span>
      </Link>

      {/* Botón de favorito — sibling del Link, nunca anidado adentro (un
         <button> dentro de un <a> es HTML inválido). Solo tiene sentido con
         el panel expandido: en modo rail colapsado no hay lugar ni
         necesidad (el flyout de la sección ya lo deja acceder igual). */}
      {isExpanded && !item.comingSoon && (
        <button
          type="button"
          onClick={() => onToggleFavorite(item.id)}
          aria-pressed={isFavorite}
          title={isFavorite ? "Quitar de Fijados" : "Fijar"}
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 transition-opacity",
            isFavorite ? "text-amber-400 opacity-100" : "text-neutral-400 opacity-0 hover:text-white group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          <Star className="size-3.5" aria-hidden="true" fill={isFavorite ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
}

/** Colapsable-por-toggle-explícito (72px, íconos) o expandido (280px) —
 * reemplaza el modelo anterior de expandir al pasar el mouse (ver
 * docs/blueprint/14-design-system.md §10 y el port de sidebar-premium-v2
 * pedido por el usuario) por uno de toggle explícito: el usuario controla
 * cuándo se expande/colapsa (clic en el logo o en el botón dedicado del
 * header), nunca por accidente al pasar el mouse. Suma, respecto de la
 * versión anterior: colapso por sección, favoritos con reorder, flyouts en
 * modo colapsado, y el atajo de teclado "G luego <letra>".
 *
 * Misma estructura de dos piezas que antes para que expandir/colapsar
 * nunca reflowee el contenido de la página:
 * 1. `.sidebar-placeholder` — se queda en el flex row normal (shrink-0),
 *    72px o 280px según `isPinned` (ver globals.css's
 *    `[data-sidebar-pinned]` para el ancho pre-hidratación, evitando un
 *    flash antes de que React tome control).
 * 2. El panel flotante real — `position: fixed`, anima su propio ancho
 *    entre 72px/280px, se renderiza encima del contenido de la página así
 *    el placeholder (y por lo tanto el contenido principal) nunca se mueve
 *    durante la animación. z-[60] (no el z-50 habitual de overlays de la
 *    app) porque /tasks y /classroom montan un drawer `fixed left-0 z-50`
 *    en `lg:hidden` — un breakpoint más ancho que el `md:flex` de este
 *    sidebar — así que en la banda 768–1023px ambos pueden estar visibles
 *    a la vez; z-[60] garantiza que este sidebar siempre gane esa pelea de
 *    stacking en vez de quedar tapado. */
export function Sidebar({
  enabledModules,
  workspaceName,
  role,
  userName,
  userEmail,
  userAvatarUrl = null,
  isPlatformAdmin = false,
  hasMultipleWorkspaces = false,
}: {
  enabledModules: string[];
  workspaceName: string;
  role: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string | null;
  isPlatformAdmin?: boolean;
  hasMultipleWorkspaces?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = useMemo(() => getSidebarNavItems(new Set(enabledModules)), [enabledModules]);
  const groups = useMemo(() => groupNavItems(navItems), [navItems]);

  const [isPinned, setPinned] = useSidebarPinned();
  const isExpanded = isPinned;
  const containerRef = useRef<HTMLDivElement>(null);

  const { favorites, toggleFavorite, reorderFavorites } = useSidebarFavorites();
  const { closedSections, toggleSection } = useSidebarClosedSections();

  const favoriteItems = useMemo(
    () => favorites.map((id) => navItems.find((item) => item.id === id)).filter((item): item is NavItem => Boolean(item)),
    [favorites, navItems],
  );
  const renderedGroups = useMemo(
    () => (favoriteItems.length > 0 ? [{ category: "Fijados", items: favoriteItems }, ...groups] : groups),
    [groups, favoriteItems],
  );

  // Flyout de sección completa en modo colapsado — reemplaza al Tooltip de
  // una sola línea que existía antes (ver SidebarGroupFlyout.tsx). Grace
  // period de 150ms antes de ocultar, igual criterio que el resto de los
  // hover-preview de esta app, para que el mouse cruzando el borde del ítem
  // hacia el flyout no lo cierre de golpe.
  const [flyoutGroup, setFlyoutGroup] = useState<{ category: string; items: NavItem[] } | null>(null);
  const flyoutAnchorElRef = useRef<HTMLElement | null>(null);
  const flyoutHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFlyout = useCallback((category: string, items: NavItem[], el: HTMLElement) => {
    if (flyoutHideTimerRef.current) {
      clearTimeout(flyoutHideTimerRef.current);
      flyoutHideTimerRef.current = null;
    }
    flyoutAnchorElRef.current = el;
    setFlyoutGroup({ category, items });
  }, []);

  const hideFlyoutSoon = useCallback(() => {
    if (flyoutHideTimerRef.current) clearTimeout(flyoutHideTimerRef.current);
    flyoutHideTimerRef.current = setTimeout(() => setFlyoutGroup(null), 150);
  }, []);

  useEffect(() => hideFlyoutSoon, [hideFlyoutSoon]);

  // Atajo "G luego <letra>" — arma un buffer de 1200ms al presionar "g" (sin
  // modificadores, sin foco en un campo editable), la siguiente letra que
  // matchee un NavItem.shortcut navega ahí. Mismo timeout que
  // sidebar-premium-v2.html. "g" en sí mismo nunca es un shortcut de
  // destino (ver el comentario en sidebarConfig.ts sobre "goals").
  useEffect(() => {
    let armed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    function disarm() {
      armed = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isEditable = Boolean(target) && (target!.tagName === "INPUT" || target!.tagName === "TEXTAREA" || target!.isContentEditable);
      if (isEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (armed) {
        const hit = navItems.find((item) => item.shortcut === key && !item.comingSoon);
        disarm();
        if (hit) {
          e.preventDefault();
          router.push(hit.href);
        }
        return;
      }
      if (key === "g") {
        armed = true;
        timer = setTimeout(disarm, 1200);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (timer) clearTimeout(timer);
    };
  }, [navItems, router]);

  const roleLabel = ROLE_LABELS[role] ?? role;

  return (
    <>
      <div className={cn("sidebar-placeholder hidden shrink-0 md:block", isPinned ? "w-[280px]" : "w-[72px]")} aria-hidden="true" />

      <div
        ref={containerRef}
        aria-expanded={isExpanded}
        className={cn(
          "fixed inset-y-0 left-0 z-[60] hidden flex-col overflow-hidden bg-[var(--sidebar-bg)] transition-[width] duration-[220ms] ease-out motion-reduce:transition-none md:flex",
          isExpanded ? "w-[280px]" : "w-[72px]",
        )}
      >
        <div className="flex h-16 shrink-0 items-center px-2.5">
          <button
            type="button"
            onClick={() => setPinned(!isPinned)}
            aria-pressed={isPinned}
            title={isPinned ? "Colapsar sidebar" : "Expandir sidebar"}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
          >
            <Logo size="sm" inverted />
          </button>
          <div className={cn("flex min-w-0 flex-1 items-center justify-between gap-2 pr-1", fadeClassName(isExpanded))}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{workspaceName}</p>
              <p className="truncate text-xs text-neutral-400">{roleLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setPinned(false)}
              title="Colapsar sidebar"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-white/10 hover:text-white"
            >
              <PanelLeftClose className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <nav aria-label="Navegación principal" className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden py-2">
          {renderedGroups.map((group) => {
            const isSectionClosed = isExpanded && closedSections.includes(group.category);
            return (
              <div key={group.category} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => isExpanded && toggleSection(group.category)}
                  tabIndex={isExpanded ? 0 : -1}
                  className={cn(
                    "flex w-full items-center justify-between overflow-hidden px-4 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 transition-[opacity,transform,max-height,padding] duration-[180ms] ease-out motion-reduce:transition-none",
                    isExpanded ? "max-h-8 pb-1 pt-3 opacity-100 translate-x-0 delay-100" : "pointer-events-none max-h-0 pb-0 pt-0 opacity-0 -translate-x-2 delay-0",
                  )}
                >
                  <span>{group.category}</span>
                  <ChevronDown className={cn("size-3.5 shrink-0 transition-transform duration-200", isSectionClosed && "-rotate-90")} aria-hidden="true" />
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                    isSectionClosed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
                  )}
                >
                  <div className="flex flex-col gap-1 overflow-hidden">
                    {group.items.map((item) => (
                      <SidebarNavItem
                        key={item.id}
                        item={item}
                        isActive={isNavItemActive(pathname, item.href)}
                        isExpanded={isExpanded}
                        isFavorite={favorites.includes(item.id)}
                        onToggleFavorite={toggleFavorite}
                        isDraggable={group.category === "Fijados"}
                        onReorderFavorite={reorderFavorites}
                        onFlyoutHoverStart={(el) => showFlyout(group.category, group.items, el)}
                        onFlyoutHoverEnd={hideFlyoutSoon}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2.5 px-2.5 py-3">
          <UserMenu
            name={userName}
            email={userEmail}
            avatarUrl={userAvatarUrl}
            variant="sidebar"
            isPlatformAdmin={isPlatformAdmin}
            hasMultipleWorkspaces={hasMultipleWorkspaces}
          />
          <div className={cn("flex min-w-0 flex-1 flex-col", fadeClassName(isExpanded))}>
            <span className="truncate text-xs font-medium text-white">{userName || "Tu cuenta"}</span>
            <span className="truncate text-[11px] text-neutral-400">{userEmail}</span>
          </div>
        </div>
      </div>

      <SidebarGroupFlyout
        open={!isExpanded && flyoutGroup !== null}
        anchorRef={flyoutAnchorElRef}
        category={flyoutGroup?.category ?? ""}
        items={flyoutGroup?.items ?? []}
        pathname={pathname}
      />
    </>
  );
}
