"use client";

import { useEffect } from "react";
import { toast } from "@/components/toast/toast";

/** Registers public/sw.js once, site-wide (mounted in the root layout, not
 * just (protected)/ — the caching benefit and "installable PWA" status
 * apply to /login and the public /apps/[slug] Mini Apps too). The SW itself
 * calls skipWaiting()/clients.claim() so a new version takes over fetch
 * handling immediately, but the currently-loaded page's own JS is still the
 * old bundle until an actual reload — this listens for that transition and
 * nudges the user via the existing toast system instead of silently doing
 * nothing until their next visit. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          // `controller` already existing means this isn't the very first
          // install on this device — an older SW was actively running, so
          // this really is a fresh deploy, not a first-time setup.
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            toast.info("Hay una versión nueva de Growth Link", "Recargá la página para actualizar.");
          }
        });
      });
    });
  }, []);

  return null;
}
