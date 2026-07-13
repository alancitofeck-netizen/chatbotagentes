"use client";

import { useEffect, useState, useTransition } from "react";
import { Laptop, LogOut, ShieldAlert } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { createClient } from "@/lib/supabase/client";
import type { MySession } from "@/lib/profile/queries";
import { signOutOtherSessions } from "@/lib/profile/actions";
import { ChangePasswordCard } from "./ChangePasswordCard";

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Short device/browser label from the raw user_agent — simple keyword
 * matching, not a full UA-parsing library (not worth a new dependency for a
 * one-line hint). */
function deviceLabelFor(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconocido";
  const ua = userAgent.toLowerCase();
  const os = ua.includes("windows") ? "Windows" : ua.includes("mac") ? "macOS" : ua.includes("android") ? "Android" : ua.includes("iphone") || ua.includes("ipad") ? "iOS" : ua.includes("linux") ? "Linux" : "Dispositivo";
  const browser = ua.includes("edg/") ? "Edge" : ua.includes("chrome/") ? "Chrome" : ua.includes("firefox/") ? "Firefox" : ua.includes("safari/") ? "Safari" : "navegador";
  return `${browser} en ${os}`;
}

/** Decodes the `session_id` claim from the current access token (base64url
 * JSON, no signature verification needed client-side — this is only used to
 * highlight "este dispositivo" in the list, not for any authorization
 * decision) so the current session can be identified for real instead of
 * guessed by comparing user_agent strings. */
function decodeSessionId(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { session_id?: string };
    return claims.session_id ?? null;
  } catch {
    return null;
  }
}

export function SecuritySection({
  sessions,
  onSessionsChanged,
}: {
  sessions: MySession[];
  onSessionsChanged: () => void;
}) {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) setCurrentSessionId(decodeSessionId(data.session.access_token));
    });
  }, []);

  function handleSignOutOthers() {
    if (!window.confirm("¿Cerrar sesión en todos los demás dispositivos?")) return;
    startTransition(async () => {
      try {
        await signOutOtherSessions();
        onSessionsChanged();
        toast.success("Se cerraron las otras sesiones.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudieron cerrar las otras sesiones.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ChangePasswordCard />

      <Card>
        <CardHeader title="Verificación en dos pasos (2FA)" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-neutral-500">
              <ShieldAlert className="size-[18px]" aria-hidden="true" />
            </span>
            <p className="text-sm text-neutral-500">Próximamente — capa extra de seguridad al iniciar sesión.</p>
          </div>
          <button
            type="button"
            disabled
            title="Próximamente"
            role="switch"
            aria-checked={false}
            className="flex h-6 w-11 shrink-0 items-center rounded-full bg-surface-3 p-0.5 disabled:cursor-not-allowed"
          >
            <span className="size-5 rounded-full bg-surface-1 shadow-sm" />
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Sesiones activas"
          action={
            sessions.length > 1 && (
              <Button size="sm" variant="destructive" onClick={handleSignOutOthers} loading={isPending}>
                <LogOut size={14} aria-hidden="true" />
                Cerrar sesión en otros dispositivos
              </Button>
            )
          }
        />
        <ul className="flex flex-col divide-y divide-border-default">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <Laptop className="size-4 shrink-0 text-neutral-400" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm text-foreground">
                  {deviceLabelFor(s.userAgent)}
                  {s.id === currentSessionId && <Badge variant="success">Este dispositivo</Badge>}
                </p>
                <p className="truncate text-[12px] text-neutral-500">
                  {s.ip ?? "IP desconocida"} · última actividad {formatDateTime(s.updatedAt ?? s.createdAt)}
                </p>
              </div>
            </li>
          ))}
          {sessions.length === 0 && <p className="py-2 text-sm text-neutral-500">Sin sesiones registradas.</p>}
        </ul>
      </Card>
    </div>
  );
}
