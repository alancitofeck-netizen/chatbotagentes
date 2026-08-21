"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import { createClient } from "@/lib/supabase/client";
import { startWhatsAppWebSessionAction, disconnectWhatsAppWebSessionAction } from "@/lib/whatsappWeb/actions";

type SessionStatus = "connecting" | "qr_pending" | "connected" | "disconnected" | "logged_out" | "auth_failed";

interface LiveSession {
  sessionId: string;
  status: SessionStatus;
  phoneE164: string | null;
  deviceName: string | null;
  qrData: string | null;
  disconnectReason: string | null;
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  connecting: "Conectando…",
  qr_pending: "Escaneá el código QR",
  connected: "Conectado",
  disconnected: "Desconectado",
  logged_out: "Sesión cerrada",
  auth_failed: "No se pudo vincular el dispositivo",
};

/** QR modal for one member's WhatsApp Web connection — conditionally
 * mounted by the parent (`{dialogMember && <WhatsAppWebConnectDialog .../>}`
 * in WhatsAppWebConnectionsCard.tsx, same convention as
 * WhatsAppIntegrationSheet/LeadFormSheet), so provisioning starts on mount
 * rather than being resynced via an "open" prop on every render.
 *
 * Subscribes to Realtime on `whatsapp_web_sessions` for live QR/status
 * updates — must getSession()+setAuth() before subscribing or RLS silently
 * drops every event (same gotcha already hit in Inbox/Contactos/KPIs in
 * this project). */
export function WhatsAppWebConnectDialog({
  onClose,
  memberId,
  memberName,
  onChanged,
}: {
  onClose: () => void;
  memberId: string;
  memberName: string;
  onChanged: () => void;
}) {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [isPending, startTransition] = useTransition();
  const previousStatus = useRef<SessionStatus | null>(null);

  function refetch(sessionId: string) {
    const supabase = createClient();
    supabase
      .from("whatsapp_web_sessions")
      .select("id, status, phone_e164, device_name, qr_data, disconnect_reason")
      .eq("id", sessionId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setSession({
          sessionId: data.id as string,
          status: data.status as SessionStatus,
          phoneE164: data.phone_e164 as string | null,
          deviceName: data.device_name as string | null,
          qrData: data.qr_data as string | null,
          disconnectReason: data.disconnect_reason as string | null,
        });
        onChanged();
      });
  }

  useEffect(() => {
    if (session && session.status === "connected" && previousStatus.current !== "connected") {
      toast.success("WhatsApp conectado.");
    }
    if (session && session.status === "auth_failed" && previousStatus.current !== "auth_failed") {
      toast.error("WhatsApp rechazó el vínculo del dispositivo.");
    }
    previousStatus.current = session?.status ?? null;
  }, [session]);

  // Kick off provisioning + worker start on mount.
  useEffect(() => {
    startWhatsAppWebSessionAction(memberId)
      .then(({ sessionId }) => refetch(sessionId))
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo iniciar la conexión."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  // Realtime subscription for this one session's status/QR row.
  useEffect(() => {
    if (!session?.sessionId) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      if (cancelled || !authSession) return;
      supabase.realtime.setAuth(authSession.access_token);
      channel = supabase
        .channel(`whatsapp-web-session-${session.sessionId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "whatsapp_web_sessions", filter: `id=eq.${session.sessionId}` },
          () => refetch(session.sessionId),
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId]);

  function handleReconnect() {
    startTransition(async () => {
      try {
        const { sessionId } = await startWhatsAppWebSessionAction(memberId);
        refetch(sessionId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo reconectar.");
      }
    });
  }

  function handleDisconnect() {
    if (!session) return;
    if (!window.confirm("¿Desconectar esta sesión de WhatsApp Web? Vas a tener que escanear un nuevo código QR para volver a conectarla.")) return;
    startTransition(async () => {
      try {
        await disconnectWhatsAppWebSessionAction(session.sessionId, memberId);
        toast.success("Sesión desconectada.");
        onChanged();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo desconectar.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title={`WhatsApp Web — ${memberName}`}>
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        {!session && <p className="text-sm text-neutral-500">Iniciando conexión…</p>}

        {session?.status === "qr_pending" && session.qrData && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL, not a static/remote asset */}
            <img src={session.qrData} alt="Código QR de WhatsApp Web" className="size-56 rounded-md border border-border-default" />
            <p className="text-sm text-neutral-500">
              Abrí WhatsApp en tu teléfono → Dispositivos vinculados → Vincular un dispositivo, y escaneá este código. Se renueva
              automáticamente si expira.
            </p>
          </>
        )}

        {session?.status === "connecting" && !session.qrData && <p className="text-sm text-neutral-500">Conectando…</p>}

        {session?.status === "connected" && (
          <>
            <Badge variant="success">🟢 Conectado</Badge>
            <div className="text-sm text-neutral-600">
              <p>Número: {session.phoneE164 ?? "—"}</p>
              {session.deviceName && <p>Dispositivo: {session.deviceName}</p>}
            </div>
          </>
        )}

        {(session?.status === "disconnected" || session?.status === "logged_out") && (
          <Badge variant="neutral">🔴 {STATUS_LABEL[session.status]}</Badge>
        )}

        {session?.status === "auth_failed" && (
          <>
            <Badge variant="error">⚠️ {STATUS_LABEL[session.status]}</Badge>
            <p className="max-w-xs text-sm text-neutral-500">
              {session.disconnectReason || "WhatsApp rechazó el vínculo."} Revisá en tu teléfono → WhatsApp → Dispositivos
              vinculados que no hayas llegado al máximo permitido, y probá de nuevo con un código QR nuevo.
            </p>
          </>
        )}

        <div className="mt-2 flex gap-2">
          {session && (session.status === "disconnected" || session.status === "logged_out" || session.status === "auth_failed") && (
            <Button size="sm" onClick={handleReconnect} loading={isPending}>
              Reintentar
            </Button>
          )}
          {session?.status === "connected" && (
            <Button size="sm" variant="destructive" onClick={handleDisconnect} loading={isPending}>
              Desconectar
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
