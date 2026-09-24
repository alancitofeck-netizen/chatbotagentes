"use client";

import { useCallback, useSyncExternalStore } from "react";

const COMPACT_STORAGE_KEY = "gl-profile-compact";

const listeners = new Set<() => void>();
let cached: boolean | null = null;

function readFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COMPACT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function getSnapshot(): boolean {
  if (cached === null) cached = readFromStorage();
  return cached;
}

function getServerSnapshot(): boolean {
  return false;
}

/** "Vista compacta" — pedida en el mock de Configuración (`.compact .field`/
 * `.hero`), acotada a la pantalla de Perfil (no un modo de densidad global
 * de toda la app, que sería un alcance mucho mayor al pedido). Mismo
 * patrón useSyncExternalStore+localStorage que useSidebarFavorites.ts. */
export function useCompactPreference(): [boolean, (next: boolean) => void] {
  const compact = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setCompact = useCallback((next: boolean) => {
    cached = next;
    try {
      window.localStorage.setItem(COMPACT_STORAGE_KEY, String(next));
    } catch {
      // localStorage unavailable — la preferencia solo no persiste
    }
    emitChange();
  }, []);

  return [compact, setCompact];
}
