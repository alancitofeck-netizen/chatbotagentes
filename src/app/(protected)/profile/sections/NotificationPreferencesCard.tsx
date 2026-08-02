"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import { ALL_CATEGORIES, CATEGORY_LABELS, type NotificationCategory } from "@/lib/notifications/catalog";
import {
  getNotificationPreferencesAction,
  updateNotificationPreferenceAction,
  type NotificationPreference,
} from "@/lib/notifications/actions";
import { getBrowserPushPermission, requestBrowserPushPermission, isBrowserPushSupported } from "@/lib/notifications/browserPush";

type PreferenceMap = Record<NotificationCategory, NotificationPreference>;

function TogglePill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-[12px] font-medium transition-colors duration-[var(--duration-fast)]",
        active ? "bg-accent-500 text-white" : "bg-surface-3 text-neutral-500 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/** Preferencias por categoría×medio (src/lib/notifications/, tabla
 * notification_preferences) + el permiso de push del navegador (Fase 4:
 * Notification API nativa, sin Service Worker/Web Push — solo funciona con
 * el navegador abierto, ver src/lib/notifications/browserPush.ts). El
 * permiso es una única decisión del navegador, no por categoría — por eso
 * vive como un banner aparte arriba de la lista, y el toggle "Push" de cada
 * fila queda deshabilitado hasta que ese permiso está concedido. */
export function NotificationPreferencesCard() {
  const [preferences, setPreferences] = useState<PreferenceMap | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    getNotificationPreferencesAction().then((prefs) => setPreferences(prefs as PreferenceMap));
    // Deferred (not a bare synchronous setState in the effect body) — same
    // reasoning eslint's react-hooks/set-state-in-effect flags synchronous
    // calls for, satisfied here the same way the line above already is.
    Promise.resolve().then(() => setPushPermission(getBrowserPushPermission()));
  }, []);

  function update(category: NotificationCategory, patch: Partial<NotificationPreference>) {
    setPreferences((prev) => (prev ? { ...prev, [category]: { ...prev[category], ...patch } } : prev));
    updateNotificationPreferenceAction(category, patch);
  }

  async function handleEnablePush(category: NotificationCategory, next: boolean) {
    if (!next) {
      update(category, { push: false });
      return;
    }
    if (pushPermission === "granted") {
      update(category, { push: true });
      return;
    }
    const result = await requestBrowserPushPermission();
    setPushPermission(result);
    if (result === "granted") {
      update(category, { push: true });
    } else {
      toast.error("Permiso denegado", "Activá las notificaciones para este sitio desde la configuración del navegador.");
    }
  }

  return (
    <Card>
      <CardHeader title="Notificaciones" />
      {isBrowserPushSupported() && pushPermission !== "granted" && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <BellRing size={15} className="shrink-0 text-neutral-400" aria-hidden="true" />
            <p className="text-[12.5px] text-neutral-500">
              {pushPermission === "denied"
                ? "Bloqueaste las notificaciones del navegador para este sitio — activalas desde la configuración del navegador."
                : "Activá las notificaciones del navegador para recibir avisos aunque tengas otra pestaña abierta."}
            </p>
          </div>
          {pushPermission === "default" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const result = await requestBrowserPushPermission();
                setPushPermission(result);
              }}
            >
              Activar
            </Button>
          )}
        </div>
      )}
      {!preferences ? (
        <div className="flex flex-col gap-2 py-1">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border-default">
          {ALL_CATEGORIES.map((category) => {
            const pref = preferences[category];
            return (
              <li key={category} className="flex items-center justify-between gap-3 py-2.5">
                <p className="text-sm text-foreground">{CATEGORY_LABELS[category]}</p>
                <div className="flex items-center gap-2">
                  <TogglePill active={pref.enabled} onClick={() => update(category, { enabled: !pref.enabled })} label="Activada" />
                  <TogglePill
                    active={pref.enabled && pref.email}
                    onClick={() => pref.enabled && update(category, { email: !pref.email })}
                    label="Email"
                  />
                  {isBrowserPushSupported() && (
                    <TogglePill
                      active={pref.enabled && pref.push}
                      onClick={() => pref.enabled && handleEnablePush(category, !pref.push)}
                      label="Push"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
