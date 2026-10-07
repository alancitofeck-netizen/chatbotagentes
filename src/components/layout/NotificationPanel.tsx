"use client";

import { useLayoutEffect, useState, useSyncExternalStore, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CheckCheck, Trash2, Circle, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatRelativeTime } from "@/lib/utils/format";
import { PRIORITY_ICON_CLASS, getEventMeta, type NotificationCategory } from "@/lib/notifications/catalog";
import type { NotificationRow } from "@/lib/notifications/types";

export type PanelFilter = "all" | "unread" | NotificationCategory;

const FILTER_TABS: { value: PanelFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "No leídas" },
  { value: "inbox", label: "Inbox" },
  { value: "crm", label: "CRM" },
  { value: "calendario", label: "Calendario" },
  { value: "ia", label: "IA" },
  { value: "sistema", label: "Sistema" },
];

/** "Sistema" agrupa además Agentes/Automatizaciones en el filtro visible
 * (el spec del usuario solo pide 7 tabs) — la categoría real en `metadata`
 * sigue siendo la específica, esto es puramente un agrupamiento de UI. */
function matchesFilter(n: NotificationRow, filter: PanelFilter) {
  if (filter === "all") return true;
  if (filter === "unread") return !n.read;
  if (filter === "sistema") return n.category === "sistema" || n.category === "agentes" || n.category === "automatizaciones";
  return n.category === filter;
}

/** Texto del botón principal según a dónde lleva la notificación. */
function actionLabel(category: NotificationRow["category"]) {
  if (category === "inbox") return "Responder";
  if (category === "crm") return "Ver lead";
  if (category === "calendario") return "Ver agenda";
  return "Abrir";
}

const MOBILE_QUERY = "(max-width: 767px)";

function subscribeMobile(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Mobile: hoja que sube desde abajo, con asa, cabecera, filtros, agrupación por día
 * y tarjetas con acción. Escritorio: popover anclado a la campana, como antes. */
export function NotificationPanel({
  triggerRef,
  panelRef,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onDeleteAll,
  onNavigate,
  onClose,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  notifications: NotificationRow[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onNavigate: (n: NotificationRow) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<PanelFilter>("all");
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const isMobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia(MOBILE_QUERY).matches, () => false);
  const [todayKey] = useState(() => new Date().toDateString());

  useLayoutEffect(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
  }, [triggerRef]);

  const filtered = notifications.filter((n) => matchesFilter(n, filter));
  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasUnread = unreadCount > 0;
  const today = filtered.filter((n) => new Date(n.createdAt).toDateString() === todayKey);
  const earlier = filtered.filter((n) => new Date(n.createdAt).toDateString() !== todayKey);

  if (!position) return null;

  const renderCard = (n: NotificationRow, index: number) => {
    const meta = getEventMeta(n.eventType);
    const Icon = meta?.icon;
    return (
      <li
        key={n.id}
        style={{ "--delay": `${Math.min(index, 8) * 45}ms` } as CSSProperties}
        className={cn(
          "card-in group relative flex flex-col gap-3 rounded-xl border p-3.5",
          n.read ? "border-border-default bg-surface-1" : "border-accent-500/30 bg-accent-50",
        )}
      >
        <div className="flex gap-3">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", PRIORITY_ICON_CLASS[n.priority])}>
            {Icon ? <Icon size={17} aria-hidden="true" /> : <Circle size={8} aria-hidden="true" />}
          </div>
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => {
              if (!n.read) onMarkRead(n.id);
              if (n.actionUrl) onNavigate(n);
            }}
          >
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[14px] font-semibold text-foreground">{n.title}</p>
              {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-accent-500" aria-hidden="true" />}
            </div>
            <p className="mt-0.5 text-[13px] text-neutral-600">{n.message}</p>
            <p className="mt-1 text-[11px] text-neutral-500">{formatRelativeTime(n.createdAt)}</p>
          </button>
        </div>
        <div className="flex items-center gap-2 pl-[52px]">
          {n.actionUrl && (
            <button
              type="button"
              onClick={() => {
                if (!n.read) onMarkRead(n.id);
                onNavigate(n);
              }}
              className="h-8 rounded-md bg-navy px-3 text-[12.5px] font-medium text-white hover:opacity-90"
            >
              {actionLabel(n.category)}
            </button>
          )}
          {!n.read && (
            <button
              type="button"
              onClick={() => onMarkRead(n.id)}
              className="h-8 rounded-md border border-border-default bg-surface-1 px-3 text-[12.5px] font-medium text-foreground hover:bg-surface-2"
            >
              Leída
            </button>
          )}
          <button
            type="button"
            title="Eliminar"
            aria-label="Eliminar"
            onClick={() => onDelete(n.id)}
            className="ml-auto flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-error-bg hover:text-error-strong"
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </li>
    );
  };

  return createPortal(
    <>
      {isMobile && <div aria-hidden="true" className="sheet-fade fixed inset-0 z-40 bg-black/40" />}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notificaciones"
        style={isMobile ? undefined : { top: position.top, right: position.right }}
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden bg-surface-1 shadow-[var(--elevation-lg)]",
          isMobile
            ? "sheet-up inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
            : "max-h-[32rem] w-[23rem] rounded-xl border border-border-default",
        )}
      >
        {isMobile && (
          <div className="flex justify-center pt-2.5" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-border-strong" />
          </div>
        )}

        <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-2 md:px-4 md:py-3">
          <div className="min-w-0">
            <h3 className={cn("font-display font-semibold tracking-[-0.02em] text-foreground", isMobile ? "text-[26px] leading-tight" : "text-[14px]")}>
              Notificaciones
            </h3>
            {isMobile && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px]">
                <span className="text-neutral-500">{unreadCount} sin leer</span>
                <button type="button" onClick={onMarkAllRead} disabled={!hasUnread} className="font-medium text-accent-700 hover:underline disabled:opacity-40">
                  Marcar todas como leídas
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isMobile && (
              <>
                <button
                  type="button"
                  title="Marcar todas como leídas"
                  aria-label="Marcar todas como leídas"
                  disabled={!hasUnread}
                  onClick={onMarkAllRead}
                  className="flex size-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <CheckCheck size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  title="Eliminar todas"
                  aria-label="Eliminar todas"
                  disabled={notifications.length === 0}
                  onClick={onDeleteAll}
                  className="flex size-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-error-bg hover:text-error-strong disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </>
            )}
            {isMobile && (
              <>
                <button
                  type="button"
                  onClick={onDeleteAll}
                  disabled={notifications.length === 0}
                  aria-label="Eliminar todas"
                  className="flex size-10 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 disabled:opacity-30"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar notificaciones"
                  className="flex size-10 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className={cn("flex gap-2 overflow-x-auto px-5 pb-3 md:gap-1 md:border-b md:border-border-default md:px-3 md:py-2 md:pb-2", isMobile && "pt-1")}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              aria-pressed={filter === tab.value}
              className={cn(
                "shrink-0 rounded-full font-medium transition-colors duration-[var(--duration-fast)]",
                isMobile ? "px-3.5 py-1.5 text-[13px]" : "px-2.5 py-1 text-[12px]",
                filter === tab.value ? "bg-navy text-white" : "border border-border-default text-neutral-600 hover:bg-surface-2 hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.value === "unread" && unreadCount > 0 && <span className="ml-1.5 tabular-nums">{unreadCount}</span>}
            </button>
          ))}
        </div>

        <div className={cn("flex-1 overflow-y-auto", isMobile ? "px-5 pb-6" : "")}>
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-neutral-500">No hay notificaciones acá.</p>
          ) : (
            <div className={cn(isMobile ? "flex flex-col gap-5" : "")}>
              {today.length > 0 && (
                <section className="flex flex-col gap-2.5">
                  {isMobile && <h4 className="text-[13px] font-medium text-neutral-500">Hoy</h4>}
                  <ul className={cn(isMobile ? "flex flex-col gap-2.5" : "divide-y divide-border-default")}>
                    {today.map((n, i) => renderCard(n, i))}
                  </ul>
                </section>
              )}
              {earlier.length > 0 && (
                <section className="flex flex-col gap-2.5">
                  {isMobile && <h4 className="text-[13px] font-medium text-neutral-500">Antes</h4>}
                  <ul className={cn(isMobile ? "flex flex-col gap-2.5" : "divide-y divide-border-default")}>
                    {earlier.map((n, i) => renderCard(n, today.length + i))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>

      </div>
    </>,
    document.body,
  );
}
