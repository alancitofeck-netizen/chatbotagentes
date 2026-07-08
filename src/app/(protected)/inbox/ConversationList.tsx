"use client";

import { Search, Inbox as InboxIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";
import type { ConversationListItem } from "@/lib/inbox/queries";
import { tagBadgeVariant } from "./tagColor";

const STATUS_LABEL: Record<string, { label: string; variant: "accent" | "warning" | "neutral" }> = {
  open: { label: "Abierta", variant: "accent" },
  pending_human: { label: "Esperando", variant: "warning" },
  closed: { label: "Cerrada", variant: "neutral" },
};

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Todas" },
  { key: "open", label: "Abiertas" },
  { key: "pending_human", label: "Esperando" },
  { key: "closed", label: "Cerradas" },
];

function formatRelative(iso: string | null) {
  if (!iso) return "";
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  return `hace ${Math.round(diffH / 24)} d`;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  status,
  onStatusChange,
  search,
  onSearchChange,
  className,
}: {
  conversations: ConversationListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("h-full flex-col border-border-default", className)}>
      <div className="flex flex-col gap-3 border-b border-border-default p-4">
        <h1 className="text-[17px] font-semibold text-foreground">Inbox</h1>
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar contacto, empresa…"
            className="w-full rounded-sm border border-border-strong bg-surface-1 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onStatusChange(f.key)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                status === f.key
                  ? "bg-accent-500 text-white"
                  : "bg-surface-2 text-neutral-600 hover:bg-surface-3",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={InboxIcon}
              title="Sin conversaciones"
              description="No hay resultados para este filtro."
            />
          </div>
        ) : (
          <ul className="flex flex-col">
            {conversations.map((c) => {
              const statusInfo = STATUS_LABEL[c.status] ?? STATUS_LABEL.open;
              const active = c.id === selectedId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-border-default px-4 py-3 text-left transition-colors",
                      active ? "bg-accent-50" : "hover:bg-surface-2",
                    )}
                  >
                    <Avatar name={c.contactName} src={c.avatarUrl} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{c.contactName}</span>
                        <span className="shrink-0 text-[11px] text-neutral-500">
                          {formatRelative(c.lastMessageAt)}
                        </span>
                      </div>
                      <p className="truncate text-[13px] text-neutral-500">{c.lastMessagePreview}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        {c.tags.slice(0, 2).map((t) => (
                          <Badge key={t.id} variant={tagBadgeVariant(t.color)}>
                            {t.name}
                          </Badge>
                        ))}
                      </div>
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
