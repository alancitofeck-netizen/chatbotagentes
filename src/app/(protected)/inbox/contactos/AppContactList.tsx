"use client";

import { Search, Smartphone } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils/cn";
import type { ContactListItem } from "@/lib/contacts/queries";
import type { MiniAppListItem } from "@/lib/miniApps/queries";
import { TEMPLATE_CATEGORIES, TEMPLATE_KEY_META, type MiniAppTemplateCategory } from "@/lib/miniApps/templateCatalog";
import { tagBadgeVariant } from "@/app/(protected)/inbox/tagColor";
import { MiniAppContactBadge } from "./MiniAppContactBadge";

/** "Contactos de Apps" — same row layout/search as ContactList.tsx, but the
 * filter row is category + specific-mini-app instead of opt-status (every
 * row here is by definition mini-app-sourced, so the badge is unconditional
 * rather than per-row). Kept as its own sibling file rather than threading
 * render-prop slots through ContactList — same precedent CompanyList.tsx
 * already set for a one-off tab. */
export function AppContactList({
  contacts,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  miniAppId,
  onMiniAppIdChange,
  miniApps,
  onSelect,
}: {
  contacts: ContactListItem[];
  search: string;
  onSearchChange: (search: string) => void;
  category: MiniAppTemplateCategory | "";
  onCategoryChange: (category: MiniAppTemplateCategory | "") => void;
  miniAppId: string;
  onMiniAppIdChange: (id: string) => void;
  miniApps: MiniAppListItem[];
  onSelect: (id: string) => void;
}) {
  const appsInCategory = category ? miniApps.filter((a) => TEMPLATE_KEY_META[a.templateKey]?.category === category) : miniApps;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 border-b border-border-default px-6 py-4">
        <div className="relative max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar nombre, teléfono…"
            className="w-full rounded-sm border border-border-strong bg-surface-1 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                onCategoryChange("");
                onMiniAppIdChange("");
              }}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                category === "" ? "bg-accent-500 text-white" : "bg-surface-2 text-neutral-600 hover:bg-surface-3",
              )}
            >
              Todas las Apps
            </button>
            {TEMPLATE_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  onCategoryChange(c.key);
                  onMiniAppIdChange("");
                }}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  category === c.key ? "bg-accent-500 text-white" : "bg-surface-2 text-neutral-600 hover:bg-surface-3",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          {miniApps.length > 0 && (
            <Select
              label=""
              containerClassName="w-52"
              value={miniAppId}
              onChange={(e) => onMiniAppIdChange(e.target.value)}
            >
              <option value="">Todas las mini apps</option>
              {appsInCategory.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="p-6">
          <EmptyState icon={Smartphone} title="Sin contactos de Apps" description="Todavía no llegó ningún lead de tus mini apps para este filtro." />
        </div>
      ) : (
        <ul className="flex flex-col">
          {contacts.map((c) => (
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
                    <MiniAppContactBadge />
                  </div>
                  <p className="truncate text-[13px] text-neutral-500">{c.phone || "Sin teléfono"}</p>
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
          ))}
        </ul>
      )}
    </div>
  );
}
