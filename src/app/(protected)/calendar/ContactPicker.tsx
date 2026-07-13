"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { getContactListAction } from "@/lib/contacts/actions";
import type { ContactListItem } from "@/lib/contacts/queries";

export interface PickedContact {
  id: string;
  name: string;
  company?: string | null;
}

/** Lightweight search-and-pick combobox — no such primitive exists yet in
 * src/components/ui/, so this stays local to Calendar (rule of three) and
 * reuses getContactListAction from @/lib/contacts/actions rather than
 * duplicating contact search logic. */
export function ContactPicker({
  selected,
  onSelect,
}: {
  selected: PickedContact | null;
  onSelect: (contact: PickedContact | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactListItem[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) return;
    debounce.current = setTimeout(() => {
      getContactListAction({ search: query }).then((fresh) => {
        setResults(fresh);
        setOpen(true);
      });
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  const visibleResults = query.trim() ? results : [];

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">Contacto</label>
      {selected ? (
        <div className="flex items-center justify-between rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm">
          <span className="text-foreground">{selected.name}</span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-xs text-accent-600 hover:underline"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => visibleResults.length > 0 && setOpen(true)}
            placeholder="Buscar contacto por nombre, teléfono, empresa…"
            className="w-full rounded-sm border border-border-strong bg-surface-1 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
          {open && visibleResults.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border-default bg-surface-1 shadow-[var(--elevation-md)]">
              {visibleResults.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect({ id: c.id, name: c.name, company: c.company });
                      setQuery("");
                      setResults([]);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <Avatar name={c.name} src={c.avatarUrl} size={24} />
                    <span className="truncate">{c.name}</span>
                    {c.company && <span className="truncate text-xs text-neutral-500">{c.company}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
