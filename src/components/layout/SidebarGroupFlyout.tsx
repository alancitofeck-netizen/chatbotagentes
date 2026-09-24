"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import { isNavItemActive, type NavItem } from "@/lib/navigation/sidebarConfig";

interface SidebarGroupFlyoutProps {
  open: boolean;
  /** El ítem sobre el que está el hover/foco — el flyout se posiciona
   * relativo a este, no al contenedor de la sección entera. */
  anchorRef: RefObject<HTMLElement | null>;
  category: string;
  items: NavItem[];
  pathname: string;
}

const ROW_HEIGHT_PX = 38;

/** Reemplaza el Tooltip de una sola línea cuando el rail está colapsado
 * (`!isExpanded` en Sidebar.tsx) — al pasar el mouse/foco sobre CUALQUIER
 * ícono muestra toda su sección, no solo la etiqueta de ese ítem. Mismo
 * patrón de portal + posicionamiento por getBoundingClientRect que
 * Tooltip.tsx, con más contenido (una lista navegable, no solo texto). */
export function SidebarGroupFlyout({ open, anchorRef, category, items, pathname }: SidebarGroupFlyoutProps) {
  const [style, setStyle] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const estimatedHeight = 32 + items.length * ROW_HEIGHT_PX;
    const maxTop = window.innerHeight - 12 - estimatedHeight;
    setStyle({ top: Math.max(8, Math.min(rect.top - 6, Math.max(8, maxTop))), left: rect.right + 8 });
  }, [open, anchorRef, items.length]);

  if (!open || !style || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="menu"
      aria-label={category}
      style={{ position: "fixed", top: style.top, left: style.left, zIndex: 70 }}
      className="w-56 rounded-[14px] border border-[var(--sidebar-line-2)] bg-[var(--sidebar-pop)] p-1.5 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.85)]"
    >
      <p className="px-2.5 pb-1.5 pt-1 text-xs text-[var(--sidebar-muted)]">{category}</p>
      {items.map((item) => {
        const Icon = item.icon;
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.id}
            href={item.comingSoon ? "#" : item.href}
            aria-disabled={item.comingSoon}
            onClick={(e) => item.comingSoon && e.preventDefault()}
            role="menuitem"
            className={cn(
              "flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px]",
              item.comingSoon
                ? "cursor-default text-neutral-600"
                : active
                  ? "text-[#F6F6FB] [&>svg]:stroke-[var(--sidebar-accent)]"
                  : "text-[var(--sidebar-text-2)] hover:bg-white/[0.05] hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
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
          </Link>
        );
      })}
    </div>,
    document.body,
  );
}
