"use client";

import { Search, BookUser } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";
import type { ContactListItem } from "@/lib/contacts/queries";
import { tagBadgeVariant } from "@/app/(protected)/inbox/tagColor";

const OPT_STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Todos" },
  { key: "subscribed", label: "Suscrito" },
  { key: "unsubscribed", label: "No suscrito" },
  { key: "unknown", label: "Desconocido" },
];

const OPT_STATUS_LABEL: Record<string, { label: string; variant: "success" | "error" | "neutral" }> = {
  subscribed: { label: "Suscrito", variant: "success" },
  unsubscribed: { label: "No suscrito", variant: "error" },
  unknown: { label: "Desconocido", variant: "neutral" },
};

export function ContactList({
  contacts,
  search,
  onSearchChange,
  optStatus,
  onOptStatusChange,
  onSelect,
}: {
  contacts: ContactListItem[];
  search: string;
  onSearchChange: (search: string) => void;
  optStatus: string;
  onOptStatusChange: (status: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 border-b border-border-default px-6 py-4">
        <div className="relative max-w-sm">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar nombre, teléfono, empresa…"
            className="w-full rounded-sm border border-border-strong bg-surface-1 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {OPT_STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onOptStatusChange(f.key)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                optStatus === f.key
                  ? "bg-accent-500 text-white"
                  : "bg-surface-2 text-neutral-600 hover:bg-surface-3",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="p-6">
          <EmptyState icon={BookUser} title="Sin contactos" description="No hay resultados para este filtro." />
        </div>
      ) : (
        <ul className="flex flex-col">
          {contacts.map((c) => {
            const opt = OPT_STATUS_LABEL[c.whatsappOptStatus] ?? OPT_STATUS_LABEL.unknown;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="flex w-full items-center gap-3 border-b border-border-default px-6 py-3 text-left transition-colors hover:bg-surface-2"
                >
                  <Avatar name={c.name} src={c.avatarUrl} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                      <Badge variant={opt.variant}>{opt.label}</Badge>
                    </div>
                    <p className="truncate text-[13px] text-neutral-500">
                      {[c.phone, c.company].filter(Boolean).join(" · ") || "Sin datos adicionales"}
                    </p>
                    {c.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {c.tags.slice(0, 3).map((t) => (
                          <Badge key={t.id} variant={tagBadgeVariant(t.color)}>
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
  );
}
