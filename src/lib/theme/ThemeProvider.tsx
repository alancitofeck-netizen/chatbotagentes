"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { THEME_STORAGE_KEY } from "./script";

type Theme = "light" | "dark";
/** Preferencia elegida por el usuario — a diferencia de `Theme` (el tema
 * EFECTIVO ya resuelto, lo que se aplica), "system" es una tercera opción
 * real y persistida, no solo el fallback implícito de no haber elegido
 * nada. */
type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function getSnapshot(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// The server can't know the client's stored preference or OS setting, so it
// always reports "light". useSyncExternalStore is the React-sanctioned way
// to reconcile that safely: the first client render matches the server
// snapshot exactly (no hydration mismatch), then a normal client-only
// re-render picks up getSnapshot()'s real value right after mount.
function getServerSnapshot(): Theme {
  return "light";
}

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // No necesita el tratamiento anti-flash pre-hidratación de `theme` —
  // "mode" solo se usa para resaltar el botón elegido en Preferencias, no
  // para pintar nada; arranca en "system" (coincide con el server) y se
  // hidrata un tick después, mismo criterio que `recentSearches` en
  // GlobalSearch.tsx.
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    Promise.resolve().then(() => setModeState(readStoredMode()));
  }, []);

  // Modo "Sistema" en vivo: si el SO cambia de tema mientras la pestaña
  // sigue abierta, refleja el cambio sin necesitar un refresh — themeInitScript's
  // ausencia de atributo ya deja que la media query de globals.css decida el
  // primer paint; esto solo mantiene sincronizado el `theme` resuelto en
  // React mientras tanto (`getSnapshot` ya sabe leer matchMedia, pero
  // useSyncExternalStore no se entera de un cambio del SO sin que algo
  // dispare `emitChange()`).
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function handleChange() {
      emitChange();
    }
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    if (next === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", next);
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private browsing, etc.) — theme just won't persist
    }
    emitChange();
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(theme === "dark" ? "light" : "dark");
  }, [theme, setMode]);

  const value = useMemo(() => ({ theme, mode, setMode, toggleTheme }), [theme, mode, setMode, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
