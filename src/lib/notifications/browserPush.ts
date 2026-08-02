"use client";

/** Fase 4: Notification API nativa del navegador — deliberadamente NO Web
 * Push (sin Service Worker/VAPID/suscripciones), decisión de alcance ya
 * confirmada con el usuario. Solo funciona mientras el navegador esté
 * abierto (en cualquier pestaña), no con el navegador cerrado. */

export function isBrowserPushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getBrowserPushPermission(): NotificationPermission | "unsupported" {
  if (!isBrowserPushSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestBrowserPushPermission(): Promise<NotificationPermission> {
  if (!isBrowserPushSupported()) return "denied";
  return Notification.requestPermission();
}

/** Only fires while the tab is hidden/unfocused — a focused tab already
 * shows the update via the bell's badge/panel, so a native popup on top of
 * that would just be a redundant second alert for the same event. */
export function showBrowserNotification(title: string, body: string, actionUrl: string | null) {
  if (!isBrowserPushSupported() || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible" && document.hasFocus()) return;

  const n = new Notification(title, { body, icon: "/favicon.ico" });
  n.onclick = () => {
    window.focus();
    if (actionUrl) window.location.href = actionUrl;
    n.close();
  };
}
