"use client";

import { useCallback, useSyncExternalStore } from "react";

const CLOSED_SECTIONS_STORAGE_KEY = "gl-sidebar-closed-sections";

const EMPTY: string[] = [];
const listeners = new Set<() => void>();
// Same caching rationale as useSidebarFavorites.ts — getSnapshot must return
// a stable reference across calls until something actually changes.
let cached: string[] | null = null;

function readFromStorage(): string[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(CLOSED_SECTIONS_STORAGE_KEY);
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

// A diferencia de useSidebarPinned (que controla el ANCHO del panel — sí
// necesita el script bloqueante pre-hidratación para no flashear), colapsar
// una sección solo cambia el alto interno del nav dentro de un panel de
// ancho fijo — no hay reflow de la página. Arranca "todo abierto" en el
// primer render y se hidrata un tick después, mismo criterio que favoritos.
function getServerSnapshot(): string[] {
  return EMPTY;
}

function persist(next: string[]) {
  cached = next;
  try {
    window.localStorage.setItem(CLOSED_SECTIONS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — el colapso de la sección solo no persiste
  }
  emitChange();
}

/** Qué secciones del sidebar (por `category`, ver sidebarConfig.ts) están
 * colapsadas por el usuario — solo aplica en modo expandido, Sidebar.tsx
 * fuerza todas "abiertas" en modo rail colapsado (ver su propio comentario). */
export function useSidebarClosedSections() {
  const closed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleSection = useCallback((category: string) => {
    const current = getSnapshot();
    const next = current.includes(category) ? current.filter((existing) => existing !== category) : [...current, category];
    persist(next);
  }, []);

  return { closedSections: closed, toggleSection };
}
