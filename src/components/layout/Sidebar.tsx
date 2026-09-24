"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronsUpDown, PanelLeft, Search, Star } from "lucide-react";
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
          "relative z-[1] flex h-10 flex-1 items-center gap-3 rounded-[10px] px-3 transition-colors duration-150",
          item.comingSoon ? "cursor-default text-neutral-600" : isActive ? "text-[#F6F6FB]" : "text-[var(--sidebar-text-2)] hover:bg-white/[0.04] hover:text-white",
        )}
      >
        {/* Píldora deslizante — un solo bloque compartido (framer-motion
           layoutId, se anima solo entre ítems/secciones sin recalcular
           offsetTop a mano) en vez de un simple bar de 3px: fondo "raised",
           anillo interno y una barrita de acento con glow anidada adentro
           (equivalente a .pill/.pill::before del mock), todo por detrás del
           ícono/label (z-0) gracias al z-[1] del Link. */}
        {isActive && (
          <motion.span
            layoutId="sidebar-active-pill"
            transition={{ type: "spring", stiffness: 500, damping: 42 }}
            className="absolute inset-0 z-0 rounded-[10px] bg-[var(--sidebar-raised)] shadow-[inset_0_0_0_1px_var(--sidebar-line),0_10px_24px_-14px_rgba(0,0,0,0.8)]"
            aria-hidden="true"
          >
            <span className="absolute -left-2 top-[10px] bottom-[10px] w-[3px] rounded-[0_3px_3px_0] bg-[var(--sidebar-accent)] shadow-[0_0_14px_var(--sidebar-accent)]" />
          </motion.span>
        )}
        <motion.span whileHover={{ scale: 1.08 }} transition={{ duration: 0.2 }} className="relative z-[1] flex shrink-0 items-center justify-center">
          <Icon className={cn("size-[18px]", isActive && "stroke-[var(--sidebar-accent)]")} aria-hidden="true" />
        </motion.span>
        <span className={cn("relative z-[1] flex min-w-0 items-center gap-2", isExpanded ? "flex-1" : "w-0 flex-none", fadeClassName(isExpanded))}>
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
            "absolute right-3 top-1/2 z-[2] -translate-y-1/2 rounded-md p-1 transition-opacity",
            isFavorite
              ? "text-[#E8C66A] opacity-100"
              : "text-[var(--sidebar-muted)] opacity-0 hover:text-white group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          <Star className="size-3.5" aria-hidden="true" fill={isFavorite ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
}

/** Colapsable-por-toggle-explícito (76px, íconos) o expandido (272px) — port
 * fiel de sidebar-premium-v2.html (mock que el usuario pasó dos veces,
 * segunda vez corrigiendo explícitamente que el primer port "quedó
 * practicamente igual al anterior" — esta versión reproduce sus mismos
 * ancho/colores/animaciones: píldora-bloque, buscador propio del rail,
 * toggle siempre visible con flip, spotlight que sigue el cursor, hint de
 * "G", flyouts oscuros) en vez de expandir al pasar el mouse (ver
 * docs/blueprint/14-design-system.md §10): el usuario controla cuándo se
 * expande/colapsa (el botón toggle, siempre visible, o Ctrl/Cmd+B), nunca
 * por accidente al pasar el mouse. Suma, respecto de la versión previa:
 * colapso por sección, favoritos con reorder, flyouts en modo colapsado, y
 * el atajo de teclado "G luego <letra>".
 *
 * Misma estructura de dos piezas que antes para que expandir/colapsar
 * nunca reflowee el contenido de la página:
 * 1. `.sidebar-placeholder` — se queda en el flex row normal (shrink-0),
 *    76px o 272px según `isPinned` (ver globals.css's
 *    `[data-sidebar-pinned]` para el ancho pre-hidratación, evitando un
 *    flash antes de que React tome control).
 * 2. El panel flotante real — `position: fixed`, anima su propio ancho
 *    entre 76px/272px, se renderiza encima del contenido de la página así
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
  const navRef = useRef<HTMLElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

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

  // Ctrl/Cmd+B — togglea expandir/colapsar desde cualquier lado, igual que
  // el mock. El botón del header hace lo mismo por clic.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setPinned(!isPinned);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPinned, setPinned]);

  // "Buscar o saltar a…" — no duplica el Buscador Global (GlobalSearch.tsx,
  // en el Navbar): le pasa el foco a su mismo <input id="global-search-input">,
  // que ya abre su propio dropdown en onFocus. Ver también el atajo Ctrl/Cmd+K
  // ya wireado ahí mismo.
  function openSearch() {
    document.getElementById("global-search-input")?.focus();
  }

  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    Promise.resolve().then(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform)));
  }, []);

  // Spotlight que sigue el cursor dentro del nav — mutación directa del DOM
  // (no state) porque mousemove dispara con mucha frecuencia; igual técnica
  // que el mock (ahí eran custom properties --mx/--my sobre un ::after).
  function handleNavMouseMove(e: React.MouseEvent<HTMLElement>) {
    const nav = navRef.current;
    const spot = spotlightRef.current;
    if (!nav || !spot) return;
    const rect = nav.getBoundingClientRect();
    spot.style.transform = `translate(${e.clientX - rect.left - 110}px, ${e.clientY - rect.top + nav.scrollTop - 110}px)`;
  }

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
  // matchee un NavItem.shortcut navega ahí. Mismo timeout y mismo hint
  // flotante ("gHint" más abajo) que sidebar-premium-v2.html. "g" en sí
  // mismo nunca es un shortcut de destino (ver el comentario en
  // sidebarConfig.ts sobre "goals").
  const [gHintVisible, setGHintVisible] = useState(false);
  useEffect(() => {
    let armed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    function disarm() {
      armed = false;
      setGHintVisible(false);
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
        setGHintVisible(true);
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
      <div className={cn("sidebar-placeholder hidden shrink-0 md:block", isPinned ? "w-[272px]" : "w-[76px]")} aria-hidden="true" />

      <div
        ref={containerRef}
        aria-expanded={isExpanded}
        className={cn(
          "fixed inset-y-0 left-0 z-[60] hidden flex-col overflow-hidden bg-[var(--sidebar-bg)] transition-[width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none md:flex",
          isExpanded ? "w-[272px]" : "w-[76px]",
        )}
      >
        {/* Header — fila (logo + nombre + chevron + toggle) cuando está
           expandido; se apila vertical (logo arriba, toggle abajo, ambos
           centrados) cuando está colapsado — el botón de toggle NUNCA se
           esconde (a diferencia de la v1 de este port, que solo dejaba
           expandir haciendo clic en el logo). */}
        <div className={cn("flex shrink-0 items-center px-3 pb-2.5 pt-3.5", isExpanded ? "flex-row gap-1.5" : "flex-col gap-2.5")}>
          {hasMultipleWorkspaces ? (
            <Link
              href="/select-workspace"
              title="Cambiar de espacio de trabajo"
              className={cn(
                "flex min-w-0 items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-white/[0.04]",
                isExpanded ? "flex-1" : "flex-none",
              )}
            >
              <Logo size="sm" inverted />
              {/* Envueltos juntos (no dos elementos sueltos con solo opacity-0
                 cada uno) — así `w-0` de verdad los saca del layout al
                 colapsar; si no, el chevron (shrink-0) sigue ocupando ancho
                 real aunque sea invisible, y el contenido desborda el rail
                 angosto de 76px (recortado por el overflow-hidden del panel
                 — la causa real del logo "distorsionado" reportado). */}
              <span className={cn("flex min-w-0 items-center gap-2.5", isExpanded ? "flex-1" : "w-0 flex-none", fadeClassName(isExpanded))}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-white">{workspaceName}</span>
                  <span className="truncate text-xs text-[var(--sidebar-muted)]">{roleLabel}</span>
                </span>
                <ChevronsUpDown className="size-4 shrink-0 text-[var(--sidebar-muted)]" aria-hidden="true" />
              </span>
            </Link>
          ) : (
            <div className={cn("flex min-w-0 items-center gap-2.5 rounded-xl p-1.5", isExpanded ? "flex-1" : "flex-none")}>
              <Logo size="sm" inverted />
              <span className={cn("flex min-w-0 flex-col", isExpanded ? "flex-1" : "w-0 flex-none", fadeClassName(isExpanded))}>
                <span className="truncate text-sm font-semibold text-white">{workspaceName}</span>
                <span className="truncate text-xs text-[var(--sidebar-muted)]">{roleLabel}</span>
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setPinned(!isPinned)}
            aria-pressed={isPinned}
            title={isPinned ? "Contraer menú (Ctrl+B)" : "Expandir menú (Ctrl+B)"}
            className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[var(--sidebar-muted)] transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <PanelLeft className={cn("size-[18px] transition-transform duration-300", !isExpanded && "scale-x-[-1]")} aria-hidden="true" />
          </button>
        </div>

        {/* Buscador propio del rail — foco entra al mismo <input> real del
           Buscador Global del Navbar (ver openSearch arriba); no es un
           campo de texto propio ni un buscador paralelo. */}
        <button
          type="button"
          onClick={openSearch}
          title="Buscar (Ctrl+K)"
          className={cn(
            "mb-1.5 flex h-10 items-center gap-2.5 rounded-[10px] border border-[var(--sidebar-line)] bg-[var(--sidebar-raised)]/40 text-[var(--sidebar-muted)] transition-colors hover:border-[var(--sidebar-line-2)] hover:text-[var(--sidebar-text-2)]",
            isExpanded ? "mx-3 px-3" : "mx-[14px] w-9 justify-center px-0",
          )}
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          {/* Envueltos juntos, no dos elementos sueltos — mismo motivo que el
             nombre del workspace de arriba: el badge de teclado es
             shrink-0, así que sin colapsar el ancho del wrapper entero
             seguía empujando/tapando el ícono de lupa al colapsar el rail. */}
          <span className={cn("flex min-w-0 items-center gap-2.5", isExpanded ? "flex-1" : "w-0 flex-none", fadeClassName(isExpanded))}>
            <span className="flex-1 truncate text-left text-[13px]">Buscar o saltar a…</span>
            <span className="shrink-0 rounded-md border border-[var(--sidebar-line-2)] bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-neutral-300">
              {isMac ? "⌘K" : "Ctrl K"}
            </span>
          </span>
        </button>

        <nav
          ref={navRef}
          onMouseMove={handleNavMouseMove}
          onMouseEnter={() => spotlightRef.current && (spotlightRef.current.style.opacity = "1")}
          onMouseLeave={() => spotlightRef.current && (spotlightRef.current.style.opacity = "0")}
          aria-label="Navegación principal"
          className={cn("relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden py-2", isExpanded ? "px-3" : "px-[14px]")}
        >
          {/* Spotlight que sigue el cursor — puro flourish visual, igual
             mecánica que .nav::after en el mock, sin afectar el layout
             (pointer-events-none, detrás de todo vía -z-10). */}
          <div
            ref={spotlightRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 -z-10 size-[220px] rounded-full opacity-0 transition-opacity duration-200"
            style={{ background: "radial-gradient(closest-side, rgba(139,124,255,.10), transparent)" }}
          />
          {renderedGroups.map((group) => {
            const isSectionClosed = isExpanded && closedSections.includes(group.category);
            return (
              <div key={group.category} className="mt-1 flex flex-col">
                <button
                  type="button"
                  onClick={() => isExpanded && toggleSection(group.category)}
                  tabIndex={isExpanded ? 0 : -1}
                  className={cn(
                    "flex w-full items-center gap-2 overflow-hidden rounded-lg px-3 text-xs font-medium text-[var(--sidebar-muted)] transition-[opacity,transform,max-height,padding] duration-[180ms] ease-out hover:text-neutral-300 motion-reduce:transition-none",
                    isExpanded ? "max-h-8 pb-1.5 pt-3.5 opacity-100 translate-x-0 delay-100" : "pointer-events-none max-h-0 pb-0 pt-0 opacity-0 -translate-x-2 delay-0",
                  )}
                >
                  <span>{group.category}</span>
                  {isSectionClosed && <span className="text-[11px] text-[var(--sidebar-muted)]">{group.items.length}</span>}
                  <ChevronsUpDown
                    className={cn("ml-auto size-3.5 shrink-0 rotate-0 transition-transform duration-200", isSectionClosed && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none",
                    isSectionClosed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
                  )}
                >
                  <div className="flex flex-col gap-0.5 overflow-hidden">
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

        <div className="flex shrink-0 items-center gap-2.5 border-t border-[var(--sidebar-line)] px-2.5 py-3">
          <UserMenu
            name={userName}
            email={userEmail}
            avatarUrl={userAvatarUrl}
            variant="sidebar"
            isPlatformAdmin={isPlatformAdmin}
            hasMultipleWorkspaces={hasMultipleWorkspaces}
          />
          <div className={cn("flex min-w-0 flex-1 flex-col", fadeClassName(isExpanded))}>
            <span className="truncate text-[13.5px] font-semibold text-white">{userName || "Tu cuenta"}</span>
            <span className="truncate text-xs text-[var(--sidebar-muted)]">{userEmail}</span>
          </div>
        </div>
      </div>

      {/* Hint flotante del combo "G luego <letra>" — mismo texto/estilo que
         #gHint en el mock. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed bottom-6 left-1/2 z-[91] flex -translate-x-1/2 items-center gap-2 rounded-[10px] border border-[var(--sidebar-line-2)] bg-[var(--sidebar-pop)] px-3 py-2 text-[12.5px] text-[var(--sidebar-text-2)] shadow-[0_24px_48px_-16px_rgba(0,0,0,0.85)] transition-opacity duration-150",
          gHintVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <span className="rounded-md border border-[var(--sidebar-line-2)] bg-white/5 px-1.5 py-0.5 font-mono text-[10.5px]">G</span>
        Ahora tocá una letra para saltar a esa sección
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
