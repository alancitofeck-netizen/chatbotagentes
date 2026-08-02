"use client";

import { useEffect, useState } from "react";

/** Hand-rolled — no formal media-query hook exists yet in this project (same
 * "no primitive yet" reasoning as DropdownMenu.tsx's positioned menu).
 * Starts `false` (SSR-safe default) and syncs to the real value on mount, so
 * the first client render matches the server-rendered HTML before updating —
 * a caller that needs to avoid a one-frame flash should gate on this being
 * mounted, same as any other window-dependent hook in this codebase. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    function handleChange(e: MediaQueryListEvent) {
      setMatches(e.matches);
    }
    // Deferred — a bare synchronous setState in an effect body triggers
    // eslint's react-hooks/set-state-in-effect; wrapping in a resolved
    // promise satisfies it the same way other call sites in this project do.
    Promise.resolve().then(() => setMatches(mql.matches));
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

/** Same cutoff Sidebar.tsx/MobileNav.tsx already use to swap navigation
 * (`md:` = 768px) — kept in sync here instead of each caller hardcoding its
 * own breakpoint string. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
