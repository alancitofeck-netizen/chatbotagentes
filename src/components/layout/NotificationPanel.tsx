"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CheckCheck, Trash2, Circle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatRelativeTime } from "@/lib/utils/format";
import { PRIORITY_ICON_CLASS, getEventMeta, type NotificationCategory } from "@/lib/notifications/catalog";
import type { NotificationRow } from "@/lib/notifications/types";

export type PanelFilter = "all" | "unread" | NotificationCategory;

const FILTER_TABS: { value: PanelFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "No leídas" },
  { value: "crm", label: "CRM" },
  { value: "inbox", label: "Inbox" },
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

export function NotificationPanel({
  triggerRef,
  panelRef,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onDeleteAll,
  onNavigate,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  notifications: NotificationRow[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onNavigate: (n: NotificationRow) => void;
}) {
  const [filter, setFilter] = useState<PanelFilter>("all");
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
  }, [triggerRef]);

  const filtered = notifications.filter((n) => matchesFilter(n, filter));
  const hasUnread = notifications.some((n) => !n.read);

  if (!position) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notificaciones"
      style={{ top: position.top, right: position.right }}
      className="fixed z-50 flex max-h-[32rem] w-[23rem] flex-col overflow-hidden rounded-xl border border-border-default bg-surface-1 shadow-[var(--elevation-lg)] transition-all duration-[var(--duration-fast)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border-default px-4 py-3">
        <h3 className="text-[14px] font-semibold text-foreground">Notificaciones</h3>
        <div className="flex items-center gap-1">
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
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border-default px-3 py-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors duration-[var(--duration-fast)]",
              filter === tab.value ? "bg-accent-500 text-white" : "text-neutral-500 hover:bg-surface-2 hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-neutral-500">No hay notificaciones acá.</p>
        ) : (
          <ul className="divide-y divide-border-default">
            {filtered.map((n) => {
              const meta = getEventMeta(n.eventType);
              const Icon = meta?.icon;
              return (
                <li
                  key={n.id}
                  className={cn("group flex gap-3 px-4 py-3 transition-colors duration-[var(--duration-fast)] hover:bg-surface-2", !n.read && "bg-accent-50/40")}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                      PRIORITY_ICON_CLASS[n.priority],
                    )}
                  >
                    {Icon ? <Icon size={15} aria-hidden="true" /> : <Circle size={8} aria-hidden="true" />}
                  </div>
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => {
                      if (!n.read) onMarkRead(n.id);
                      if (n.actionUrl) onNavigate(n);
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-medium text-foreground">{n.title}</p>
                      {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-accent-500" aria-hidden="true" />}
                    </div>
                    <p className="text-[12.5px] text-neutral-500">{n.message}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-400">{formatRelativeTime(n.createdAt)}</p>
                  </button>
                  <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {!n.read && (
                      <button
                        type="button"
                        title="Marcar como leída"
                        aria-label="Marcar como leída"
                        onClick={() => onMarkRead(n.id)}
                        className="flex size-6 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-3 hover:text-foreground"
                      >
                        <CheckCheck size={13} aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Eliminar"
                      aria-label="Eliminar"
                      onClick={() => onDelete(n.id)}
                      className="flex size-6 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
