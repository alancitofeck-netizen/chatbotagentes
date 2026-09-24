"use client";

import { useCallback, useSyncExternalStore } from "react";

const FAVORITES_STORAGE_KEY = "gl-sidebar-favorites";

const EMPTY: string[] = [];
const listeners = new Set<() => void>();
// Cached snapshot reference — useSyncExternalStore requires getSnapshot to
// return the SAME reference until something actually changes (Object.is
// comparison), so re-parsing localStorage on every call would infinite-loop.
// Same rationale as useSidebarPinned.ts, just for array-shaped state instead
// of a boolean (which doesn't need caching since primitives compare by value).
let cached: string[] | null = null;

function readFromStorage(): string[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : EMPTY;
  } catch {
    return EMPTY;
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function getSnapshot(): string[] {
  if (cached === null) cached = readFromStorage();
  return cached;
}

// Favoritos no afectan el ancho del panel (a diferencia de useSidebarPinned),
// así que no hace falta un script bloqueante pre-hidratación — arrancan
// vacíos en el server/primer render y se hidratan un tick después, mismo
// criterio que `recentSearches` en GlobalSearch.tsx.
function getServerSnapshot(): string[] {
  return EMPTY;
}

function persist(next: string[]) {
  cached = next;
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private browsing, etc.) — el favorito solo no persiste
  }
  emitChange();
}

/** Items del sidebar anclados por el usuario a la sección "Fijados" —
 * array ORDENADO de ids (no un Set: el orden es justamente lo que
 * reorder() permite cambiar por drag-and-drop en Sidebar.tsx). */
export function useSidebarFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleFavorite = useCallback((id: string) => {
    const current = getSnapshot();
    const next = current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id];
    persist(next);
  }, []);

  const reorderFavorites = useCallback((fromId: string, toId: string) => {
    const current = getSnapshot();
    const fromIndex = current.indexOf(fromId);
    const toIndex = current.indexOf(toId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    const next = current.slice();
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, fromId);
    persist(next);
  }, []);

  return { favorites, toggleFavorite, reorderFavorites };
}
