"use client";

import { useSyncExternalStore } from "react";

/** `true` cuando la media query coincide. En el servidor y durante la
 * hidratación devuelve `false` (mismo criterio mobile-first que las clases
 * `max-md:`/`md:`), así que nunca hay desajuste de hidratación. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
