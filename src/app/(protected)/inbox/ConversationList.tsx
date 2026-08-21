"use client";

import { useMemo, useState } from "react";
import { Search, Inbox as InboxIcon, Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";
import type { ConversationListItem, WorkspaceMemberOption, WorkspaceTag } from "@/lib/inbox/queries";
import { tagBadgeVariant } from "./tagColor";

export type InboxTab = "all" | "unread" | "assigned" | "unassigned" | "closed";

const TABS: { key: InboxTab; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "unread", label: "No leídas" },
  { key: "assigned", label: "Mis conversaciones" },
  { key: "unassigned", label: "Sin asignar" },
  { key: "closed", label: "Cerradas" },
];

type ChannelFilter = "all" | "whatsapp" | "instagram";

const CHANNEL_TABS: { key: ChannelFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "instagram", label: "🟣 Instagram" },
];

/** Chips de categoría rápida — NO son una columna de prioridad nueva, son
 * un atajo sobre el sistema de tags ya existente (`tags`/`contact_tags`).
 * Un chip solo se muestra si el workspace ya tiene un tag con ese nombre
 * exacto (case-insensitive) creado — nunca se inventa una categoría vacía
 * ni se crea un tag nuevo automáticamente. */
const QUICK_CATEGORIES = [
  { tagName: "urgente", label: "🔴 Urgentes" },
  { tagName: "nuevo lead", label: "🆕 Nuevos leads" },
  { tagName: "seguimiento", label: "⏳ Seguimiento" },
  { tagName: "cita", label: "📅 Citas" },
] as const;

const STATUS_DOT: Record<string, string> = {
  open: "bg-blue-500",
  pending_human: "bg-amber-500",
  closed: "bg-neutral-400",
};

function formatRelative(iso: string | null) {
  if (!iso) return "";
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.round(diffH / 24)}d`;
}

/** Tabs are filtered client-side over the already-fetched `conversations` —
 * "Todas" = todo lo no cerrado, "No leídas"/"Mis conversaciones"/"Sin
 * asignar" are sub-filters of that same active set, "Cerradas" is its own
 * bucket. Only the text search still round-trips to the server (InboxShell's
 * existing debounced fetch). */
function matchesTab(c: ConversationListItem, tab: InboxTab, currentMemberId: string | null): boolean {
  if (tab === "closed") return c.status === "closed";
  if (c.status === "closed") return false;
  if (tab === "unread") return c.unreadCount > 0;
  if (tab === "assigned") return Boolean(currentMemberId) && c.assignedMemberId === currentMemberId;
  if (tab === "unassigned") return !c.assignedMemberId;
  return true;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  activeTab,
  onTabChange,
  currentMemberId,
  members,
  tags,
  search,
  onSearchChange,
  className,
}: {
  conversations: ConversationListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  activeTab: InboxTab;
  onTabChange: (tab: InboxTab) => void;
  currentMemberId: string | null;
  members: WorkspaceMemberOption[];
  tags: WorkspaceTag[];
  search: string;
  onSearchChange: (search: string) => void;
  className?: string;
}) {
  const memberById = useMemo(() => new Map(members.map((m) => [m.memberId, m])), [members]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");

  const channelCounts = useMemo(() => {
    const result: Record<ChannelFilter, number> = { all: conversations.length, whatsapp: 0, instagram: 0 };
    for (const c of conversations) {
      if (c.channel === "instagram") result.instagram += 1;
      else result.whatsapp += 1;
    }
    return result;
  }, [conversations]);

  const counts = useMemo(() => {
    const result: Record<InboxTab, number> = { all: 0, unread: 0, assigned: 0, unassigned: 0, closed: 0 };
    for (const c of conversations) {
      for (const tab of TABS) {
        if (matchesTab(c, tab.key, currentMemberId)) result[tab.key] += 1;
      }
    }
    return result;
  }, [conversations, currentMemberId]);

  const availableCategories = useMemo(
    () => QUICK_CATEGORIES.filter((cat) => tags.some((t) => t.name.trim().toLowerCase() === cat.tagName)),
    [tags],
  );

  const filtered = useMemo(() => {
    let list = conversations.filter((c) => matchesTab(c, activeTab, currentMemberId));
    if (channelFilter !== "all") list = list.filter((c) => c.channel === channelFilter);
    if (activeCategory) list = list.filter((c) => c.tags.some((t) => t.name.trim().toLowerCase() === activeCategory));
    return list;
  }, [conversations, activeTab, currentMemberId, activeCategory, channelFilter]);

  return (
    <div className={cn("h-full flex-col bg-surface-1", className)}>
      <div className="flex flex-col gap-3 border-b border-border-default px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">Bandeja de entrada</h1>
          <button
            type="button"
            aria-label="Nueva conversación"
            className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground"
          >
            <Pencil size={15} />
          </button>
        </div>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar contacto, empresa…"
            className="w-full rounded-full border border-border-strong bg-surface-2 py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus:border-blue-500 focus:bg-surface-1 focus:ring-[3px] focus:ring-blue-100"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {CHANNEL_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setChannelFilter(t.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                channelFilter === t.key ? "bg-foreground text-surface-1" : "text-neutral-600 hover:bg-surface-2",
              )}
            >
              {t.label}
              {channelCounts[t.key] > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                    channelFilter === t.key ? "bg-white/25" : "bg-surface-3 text-neutral-500",
                  )}
                >
                  {channelCounts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTabChange(t.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                activeTab === t.key ? "bg-blue-600 text-white" : "text-neutral-600 hover:bg-surface-2",
              )}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                    activeTab === t.key ? "bg-white/25 text-white" : "bg-surface-3 text-neutral-500",
                  )}
                >
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>
        {availableCategories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto">
            {availableCategories.map((cat) => {
              const isActive = activeCategory === cat.tagName;
              return (
                <button
                  key={cat.tagName}
                  type="button"
                  onClick={() => setActiveCategory(isActive ? null : cat.tagName)}
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                    isActive ? "border-blue-500 bg-blue-50 text-blue-700" : "border-border-default text-neutral-600 hover:bg-surface-2",
                  )}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={InboxIcon} title="Sin conversaciones" description="No hay resultados para este filtro." />
          </div>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((c) => {
              const active = c.id === selectedId;
              const unread = c.unreadCount > 0;
              const assignedMember = c.assignedMemberId ? memberById.get(c.assignedMemberId) : null;
              const assignedName = assignedMember?.fullName ?? null;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      "group relative flex w-full items-start gap-3 border-b border-border-default py-3 pl-3.5 pr-4 text-left transition-colors",
                      active ? "bg-blue-50" : "hover:bg-surface-2",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute inset-y-0 left-0 w-[3px] rounded-r-full transition-colors",
                        active ? "bg-blue-600" : "bg-transparent",
                      )}
                      aria-hidden="true"
                    />
                    <span className="relative shrink-0">
                      <Avatar name={c.contactName} src={c.avatarUrl} size={40} />
                      {c.channel === "instagram" ? (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-surface-1 bg-fuchsia-600 text-[8px]"
                          aria-hidden="true"
                          title="Instagram"
                        >
                          📷
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface-1",
                            STATUS_DOT[c.status] ?? STATUS_DOT.open,
                          )}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-sm", unread ? "font-semibold text-foreground" : "font-medium text-foreground")}>
                          {c.contactName}
                        </span>
                        <span className="shrink-0 text-[11px] text-neutral-500">{formatRelative(c.lastMessageAt)}</span>
                      </div>
                      {c.channel === "instagram" && c.instagramUsername && (
                        <p className="truncate text-[11.5px] text-fuchsia-600">@{c.instagramUsername}</p>
                      )}
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className={cn("truncate text-[13px]", unread ? "font-medium text-foreground" : "text-neutral-500")}>
                          {c.lastMessagePreview}
                        </p>
                        {unread && (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
                            {c.unreadCount > 9 ? "9+" : c.unreadCount}
                          </span>
                        )}
                      </div>
                      {(assignedName || c.tags.length > 0) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {assignedName && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                              <Avatar name={assignedName} src={assignedMember?.avatarUrl} size={14} />
                              {assignedName.split(" ")[0]}
                            </span>
                          )}
                          {c.tags.slice(0, 2).map((t) => (
                            <Badge key={t.id} variant={tagBadgeVariant(t.color)} className="px-2 py-0.5 text-[11px]">
                              {t.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
