"use client";

import { useEffect, useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "@/components/toast/toast";
import { getWhatsAppWebSessionsAction, disconnectWhatsAppWebSessionAction } from "@/lib/whatsappWeb/actions";
import type { WhatsAppWebSession } from "@/lib/whatsappWeb/queries";
import { WhatsAppWebConnectDialog } from "./WhatsAppWebConnectDialog";

/** Estados con algo "vivo" para tirar abajo — una sesión trabada en
 * qr_pending/connecting (ej. el worker se reinició y perdió el estado en
 * memoria, dejando un QR viejo que ya no sirve) necesita poder
 * desconectarse SIN tener que abrir el diálogo, que antes solo ofrecía
 * "Desconectar" para status==='connected' (bug reportado: la tarjeta
 * mostraba "Esperando QR" con nada real del otro lado para escanear, y no
 * había forma de resetear la fila sin ir a la base a mano). */
const DISCONNECTABLE_STATUSES: WhatsAppWebSession["status"][] = ["connecting", "qr_pending", "connected"];

const STATUS_BADGE: Record<WhatsAppWebSession["status"], { label: string; variant: BadgeVariant }> = {
  connecting: { label: "Conectando…", variant: "warning" },
  qr_pending: { label: "Esperando QR", variant: "warning" },
  connected: { label: "🟢 Conectado", variant: "success" },
  disconnected: { label: "🔴 Desconectado", variant: "neutral" },
  logged_out: { label: "🔴 Sesión cerrada", variant: "neutral" },
  auth_failed: { label: "⚠️ No se pudo vincular", variant: "error" },
};

/** New "Integraciones" card for the WhatsApp Web (QR/Baileys) channel — a
 * second, independent WhatsApp channel alongside YCloud (see the sibling
 * card above this one), where each member connects their OWN personal
 * number. Unlike every other integration card here, this one can show
 * MULTIPLE rows for the same workspace (one per connected member) — RLS on
 * `whatsapp_web_sessions` (0050_whatsapp_web_sessions.sql) already scopes
 * what comes back: a plain Agent only ever sees their own row, Owner/Admin
 * see every member's. */
export function WhatsAppWebConnectionsCard({
  currentRole,
  currentMemberId,
}: {
  currentRole: string;
  currentMemberId: string | null;
}) {
  const [sessions, setSessions] = useState<WhatsAppWebSession[] | null>(null);
  const [dialogMember, setDialogMember] = useState<{ id: string; name: string } | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function refetch() {
    getWhatsAppWebSessionsAction().then(setSessions);
  }

  function handleDisconnect(session: WhatsAppWebSession) {
    if (!window.confirm("¿Desconectar esta sesión de WhatsApp Web? Vas a tener que escanear un nuevo código QR para volver a conectarla.")) return;
    setDisconnectingId(session.sessionId);
    startTransition(async () => {
      try {
        await disconnectWhatsAppWebSessionAction(session.sessionId, session.memberId);
        toast.success("Sesión desconectada.");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo desconectar.");
      } finally {
        setDisconnectingId(null);
      }
    });
  }

  useEffect(() => {
    refetch();
  }, []);

  /** Mirrors the RPC's own rule (0050_whatsapp_web_sessions.sql): Owner
   * manages any connection; Admin manages any connection except the
   * Owner's own; Agent (or anyone) manages only their own. */
  function canManage(session: WhatsAppWebSession): boolean {
    if (session.memberId === currentMemberId) return true;
    if (currentRole === "owner") return true;
    if (currentRole === "admin") return session.role !== "owner";
    return false;
  }

  const hasOwnSession = (sessions ?? []).some((s) => s.memberId === currentMemberId);

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-success-bg text-success-strong">
            <MessageCircle className="size-4" aria-hidden="true" />
          </span>
          <h3 className="text-[15px] font-medium text-foreground">WhatsApp Web (QR)</h3>
        </div>
      </div>

      <p className="mb-4 text-sm text-neutral-500">
        Conectá tu WhatsApp personal escaneando un código QR — un canal independiente de YCloud, con tu propio número.
      </p>

      {sessions === null ? (
        <p className="text-sm text-neutral-500">Cargando…</p>
      ) : (
        <>
          {sessions.length > 0 && (
            <div className="flex flex-col divide-y divide-border-default">
              {sessions.map((s) => (
                <div key={s.sessionId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={s.fullName} src={s.avatarUrl} size={28} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.memberId === currentMemberId ? "Vos" : s.fullName}</p>
                      <p className="text-xs text-neutral-500">
                        {s.phoneE164 ?? "Sin número"}
                        {s.deviceName ? ` · ${s.deviceName}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_BADGE[s.status].variant}>{STATUS_BADGE[s.status].label}</Badge>
                    {canManage(s) && (
                      <>
                        {DISCONNECTABLE_STATUSES.includes(s.status) && (
                          <Button
                            size="sm"
                            variant="destructive"
                            loading={isPending && disconnectingId === s.sessionId}
                            onClick={() => handleDisconnect(s)}
                          >
                            Desconectar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setDialogMember({ id: s.memberId, name: s.fullName })}
                        >
                          {s.status === "connected" ? "Ver" : "Mostrar QR"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!hasOwnSession && currentMemberId && (
            <Button
              size="sm"
              className={sessions.length > 0 ? "mt-4" : undefined}
              onClick={() => setDialogMember({ id: currentMemberId, name: "Tu WhatsApp" })}
            >
              Conectar
            </Button>
          )}
        </>
      )}

      {dialogMember && (
        <WhatsAppWebConnectDialog
          onClose={() => setDialogMember(null)}
          memberId={dialogMember.id}
          memberName={dialogMember.name}
          onChanged={refetch}
        />
      )}
    </Card>
  );
}
