"use client";

import { useCallback, useSyncExternalStore } from "react";
import { SIDEBAR_PINNED_STORAGE_KEY } from "./sidebarPinScript";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function getSnapshot(): boolean {
  return document.documentElement.getAttribute("data-sidebar-pinned") === "true";
}

// Same "server always reports the pre-hydration-safe default" reconciliation
// useSyncExternalStore requires — see ThemeProvider.tsx's identical comment.
// sidebarPinInitScript already set the DOM attribute before this ever runs,
// so the very first client render matches whatever that script decided.
function getServerSnapshot(): boolean {
  return false;
}

/** Sidebar-local pin state — no context/provider needed (unlike theme,
 * nothing outside Sidebar.tsx itself needs to read this), but reuses the
 * exact same useSyncExternalStore + blocking-script pattern as
 * ThemeProvider.tsx to avoid a flash of the wrong width on first paint. */
export function useSidebarPinned(): [boolean, (next: boolean) => void] {
  const isPinned = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setPinned = useCallback((next: boolean) => {
    document.documentElement.setAttribute("data-sidebar-pinned", String(next));
    try {
      localStorage.setItem(SIDEBAR_PINNED_STORAGE_KEY, String(next));
    } catch {
      // localStorage unavailable (private browsing, etc.) — pin just won't persist
    }
    emitChange();
  }, []);

  return [isPinned, setPinned];
}
