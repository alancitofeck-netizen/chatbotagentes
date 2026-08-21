"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "@/components/toast/toast";
import { getInstagramStatusAction, disconnectInstagramAction } from "@/lib/integrations/actions";
import type { InstagramStatus } from "@/lib/integrations/instagram";

/** Card de Integraciones para Instagram — mismo patrón visual/estructural
 * que las cards de Google (IntegrationsSection.tsx), pero como componente
 * propio (mismo criterio que WhatsAppWebConnectionsCard) para no seguir
 * agrandando ese archivo ya grande. Auto-fetch al montar + maneja sus
 * propios query params de retorno del callback OAuth
 * (instagram_connected/instagram_error) de forma independiente. */
export function InstagramConnectionCard({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [isPending, startTransition] = useTransition();

  function refetch() {
    getInstagramStatusAction().then(setStatus);
  }

  useEffect(() => {
    refetch();
  }, []);

  useEffect(() => {
    if (searchParams.get("instagram_connected")) {
      toast.success("Instagram conectado.");
      refetch();
      router.replace("/profile?tab=integrations", { scroll: false });
    } else if (searchParams.get("instagram_error")) {
      toast.error("No se pudo conectar Instagram.");
      router.replace("/profile?tab=integrations", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDisconnect() {
    if (!window.confirm("¿Desconectar Instagram de este workspace? Vas a dejar de recibir y poder responder mensajes de Instagram desde el Inbox.")) return;
    startTransition(async () => {
      try {
        await disconnectInstagramAction();
        setStatus({ connected: false, username: null, name: null, profilePictureUrl: null, needsReauth: false });
        toast.success("Instagram desconectado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo desconectar.");
      }
    });
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-700">
            <Camera className="size-4" aria-hidden="true" />
          </span>
          <h3 className="text-[15px] font-medium text-foreground">Instagram</h3>
        </div>
        {status?.needsReauth ? (
          <Badge variant="warning">🟡 Reautorización requerida</Badge>
        ) : (
          <Badge variant={status?.connected ? "success" : "neutral"}>{status?.connected ? "🟢 Conectado" : "🔴 No conectado"}</Badge>
        )}
      </div>

      {status?.connected ? (
        <div className="flex items-center gap-2.5 text-sm text-neutral-600">
          <Avatar name={status.name ?? status.username ?? "Instagram"} src={status.profilePictureUrl} size={32} />
          <div>
            {status.username && <p className="font-medium text-foreground">@{status.username}</p>}
            {status.name && <p className="text-xs text-neutral-500">{status.name}</p>}
          </div>
        </div>
      ) : status?.needsReauth ? (
        <p className="flex items-center gap-1.5 text-sm text-amber-700">
          <AlertTriangle size={14} aria-hidden="true" />
          Es necesario volver a conectar Instagram.
        </p>
      ) : (
        <p className="text-sm text-neutral-500">
          Conectá tu cuenta profesional de Instagram para recibir y gestionar tus mensajes directamente desde el Inbox.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {status?.connected ? (
          <Button size="sm" variant="destructive" disabled={!canManage || isPending} onClick={handleDisconnect}>
            Desconectar
          </Button>
        ) : (
          <Button size="sm" disabled={!canManage} onClick={() => (window.location.href = "/api/integrations/instagram/connect")}>
            {status?.needsReauth ? "Reconectar" : "Conectar Instagram"}
          </Button>
        )}
      </div>
    </Card>
  );
}
