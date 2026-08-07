"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Loader2,
  SearchX,
  User,
  MessageCircle,
  FileCheck2,
  CheckSquare,
  CalendarDays,
  Building2,
  Zap,
  File,
  UserPlus,
  ListTodo,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { globalSearchAction } from "@/lib/search/actions";
import { SEARCH_TYPE_LABEL, SEARCH_TYPE_ORDER, QUICK_ACTIONS, type SearchResult } from "@/lib/search/types";
import { cn } from "@/lib/utils/cn";

const ICON_MAP: Record<string, LucideIcon> = {
  User,
  MessageCircle,
  FileCheck2,
  CheckSquare,
  CalendarDays,
  Building2,
  Zap,
  File,
  UserPlus,
  ListTodo,
};

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const RECENT_SEARCHES_KEY = "growthlink:recent-searches";
const MAX_RECENT_SEARCHES = 5;

function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === "undefined") return;
  const trimmed = query.trim();
  if (!trimmed) return;
  const next = [trimmed, ...loadRecentSearches().filter((q) => q.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
  window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
}

/** Entrada navegable genérica — resultados, acciones rápidas y búsquedas
 * recientes conviven en una sola lista plana para que ↑/↓/Enter funcionen
 * igual sin importar de qué sección vino la fila resaltada. */
interface NavigableEntry {
  key: string;
  onSelect: () => void;
}

/** Buscador Global — reemplaza el input decorativo del Header (Navbar.tsx)
 * por uno funcional en tiempo real, respaldado por GlobalSearchService
 * (src/lib/search/service.ts). Mismo markup/clases del input original —
 * "no modificar el diseño" — solo se le agregó comportamiento. */
export function GlobalSearch() {
  const listboxId = useId();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // Lazy initializer instead of an effect — runs once on mount (client-only:
  // loadRecentSearches() itself guards on `typeof window`, so it's a no-op
  // during SSR), no separate render pass needed to populate it.
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const [hasSearchedOnce, setHasSearchedOnce] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      // Deferred a microtask, same convention used elsewhere in this app
      // (PoliciesBoardShell/ContactsShell's deep-link effects) to avoid a
      // synchronous setState directly in the effect body.
      Promise.resolve().then(() => {
        setResults([]);
        setIsLoading(false);
        setHasSearchedOnce(false);
      });
      return;
    }
    Promise.resolve().then(() => setIsLoading(true));
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(() => {
      globalSearchAction(trimmed).then((fresh) => {
        if (requestIdRef.current !== requestId) return; // respuesta vieja — ya hay una búsqueda más nueva en curso
        setResults(fresh);
        setIsLoading(false);
        setHasSearchedOnce(true);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const trimmedQuery = query.trim();
  const showingResults = trimmedQuery.length >= MIN_QUERY_LENGTH;

  const matchingQuickActions = useMemo(() => {
    if (!trimmedQuery) return QUICK_ACTIONS;
    const q = trimmedQuery.toLowerCase();
    return QUICK_ACTIONS.filter((a) => a.label.toLowerCase().includes(q));
  }, [trimmedQuery]);

  const groupedResults = useMemo(() => {
    const byType = new Map<string, SearchResult[]>();
    for (const r of results) {
      if (!byType.has(r.type)) byType.set(r.type, []);
      byType.get(r.type)!.push(r);
    }
    return SEARCH_TYPE_ORDER.filter((t) => byType.has(t)).map((type) => ({ type, label: SEARCH_TYPE_LABEL[type], items: byType.get(type)! }));
  }, [results]);

  function goTo(route: string) {
    if (trimmedQuery) {
      saveRecentSearch(trimmedQuery);
      setRecentSearches(loadRecentSearches());
    }
    setIsOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(route);
  }

  // Lista plana en el mismo orden visual que se renderiza abajo — así
  // activeIndex siempre apunta a la fila realmente resaltada.
  const entries: NavigableEntry[] = useMemo(() => {
    if (!showingResults) {
      return [
        ...recentSearches.map((q) => ({ key: `recent-${q}`, onSelect: () => setQuery(q) })),
        ...QUICK_ACTIONS.map((a) => ({ key: `qa-${a.id}`, onSelect: () => goTo(a.route) })),
      ];
    }
    return [
      ...matchingQuickActions.map((a) => ({ key: `qa-${a.id}`, onSelect: () => goTo(a.route) })),
      ...results.map((r) => ({ key: `res-${r.type}-${r.id}`, onSelect: () => goTo(r.route) })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showingResults, recentSearches, matchingQuickActions, results]);

  useEffect(() => {
    Promise.resolve().then(() => setActiveIndex(0));
  }, [entries.length, isOpen]);

  // Deriva la fila resaltada desde `entries` (mismo orden que el render de
  // abajo) en vez de un contador mutable incrementado durante el JSX — un
  // `let` reasignado en cada fila renderizada rompe con concurrent
  // rendering (react-hooks/immutability).
  const entryIndexByKey = useMemo(() => new Map(entries.map((e, i) => [e.key, i])), [entries]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, entries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      entries[activeIndex]?.onSelect();
    }
  }

  return (
    <div ref={containerRef} className="relative hidden w-full max-w-xs md:block">
      <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar…"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={listboxId}
        className="w-full rounded-full border border-border-default bg-surface-2 py-2 pl-9 pr-4 text-sm outline-none transition-colors duration-[var(--duration-fast)] focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
      />
      {isLoading && <Loader2 size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-neutral-400" />}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 top-full z-50 mt-2 w-[26rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border-default bg-surface-1 shadow-[var(--elevation-lg)]"
          >
            <div id={listboxId} role="listbox" className="max-h-[26rem] overflow-y-auto p-2">
              {!showingResults && (
                <>
                  {recentSearches.length > 0 && (
                    <div className="mb-1">
                      <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Búsquedas recientes</p>
                      {recentSearches.map((q) => {
                        const rowIndex = entryIndexByKey.get(`recent-${q}`) ?? -1;
                        return (
                          <ResultRow key={q} active={rowIndex === activeIndex} icon={Clock} title={q} subtitle={null} onClick={() => setQuery(q)} onHover={() => setActiveIndex(rowIndex)} />
                        );
                      })}
                    </div>
                  )}
                  <div>
                    <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Acciones rápidas</p>
                    {QUICK_ACTIONS.map((a) => {
                      const rowIndex = entryIndexByKey.get(`qa-${a.id}`) ?? -1;
                      const Icon = ICON_MAP[a.icon] ?? Zap;
                      return (
                        <ResultRow key={a.id} active={rowIndex === activeIndex} icon={Icon} title={a.label} subtitle={null} onClick={() => goTo(a.route)} onHover={() => setActiveIndex(rowIndex)} />
                      );
                    })}
                  </div>
                </>
              )}

              {showingResults && (
                <>
                  {matchingQuickActions.length > 0 && (
                    <div className="mb-1">
                      <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Acciones rápidas</p>
                      {matchingQuickActions.map((a) => {
                        const rowIndex = entryIndexByKey.get(`qa-${a.id}`) ?? -1;
                        const Icon = ICON_MAP[a.icon] ?? Zap;
                        return (
                          <ResultRow key={a.id} active={rowIndex === activeIndex} icon={Icon} title={a.label} subtitle={null} onClick={() => goTo(a.route)} onHover={() => setActiveIndex(rowIndex)} />
                        );
                      })}
                    </div>
                  )}

                  {isLoading && results.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-neutral-400">
                      <Loader2 size={14} className="animate-spin" />
                      Buscando…
                    </div>
                  ) : hasSearchedOnce && results.length === 0 && matchingQuickActions.length === 0 ? (
                    <div className="flex flex-col items-center gap-1.5 py-10 text-center">
                      <SearchX className="size-6 text-neutral-300" aria-hidden="true" />
                      <p className="text-sm text-neutral-500">No encontramos resultados.</p>
                    </div>
                  ) : (
                    groupedResults.map((group) => (
                      <div key={group.type} className="mb-1">
                        <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{group.label}</p>
                        {group.items.map((item) => {
                          const rowIndex = entryIndexByKey.get(`res-${item.type}-${item.id}`) ?? -1;
                          const Icon = ICON_MAP[item.icon] ?? File;
                          return (
                            <ResultRow
                              key={`${item.type}-${item.id}`}
                              active={rowIndex === activeIndex}
                              icon={Icon}
                              title={item.title}
                              subtitle={item.subtitle}
                              onClick={() => goTo(item.route)}
                              onHover={() => setActiveIndex(rowIndex)}
                            />
                          );
                        })}
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultRow({
  active,
  icon: Icon,
  title,
  subtitle,
  onClick,
  onHover,
}: {
  active: boolean;
  icon: LucideIcon;
  title: string;
  subtitle: string | null;
  onClick: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      onMouseEnter={onHover}
      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-100", active ? "bg-accent-500/12" : "hover:bg-surface-2")}
    >
      <Icon className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{title}</p>
        {subtitle && <p className="truncate text-xs text-neutral-500">{subtitle}</p>}
      </div>
    </button>
  );
}
