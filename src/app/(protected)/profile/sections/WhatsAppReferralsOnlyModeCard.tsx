"use client";

import { useEffect, useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/toast/toast";
import { getWhatsAppReferralsOnlyModeAction, updateWhatsAppReferralsOnlyModeAction } from "@/lib/integrations/actions";

/** "Modo de WhatsApp" — pedido explícito: cuando está activo, el CRM solo
 * procesa mensajes de números que ya están cargados como referido
 * (asesoria_referrals) en este workspace; cualquier otro número que
 * escriba se descarta en el webhook, antes de crear contacto/conversación.
 * Aplica a los dos canales de WhatsApp (YCloud e WhatsApp Web) por igual —
 * por eso vive como su propia card, no adentro de ninguna de esas dos. Card
 * auto-fetch en vez de prop-drilling desde profile/page.tsx, mismo patrón
 * ya usado por InstagramConnectionCard/WhatsAppWebConnectionsCard. */
export function WhatsAppReferralsOnlyModeCard({ canManage }: { canManage: boolean }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getWhatsAppReferralsOnlyModeAction().then(setEnabled);
  }, []);

  function handleToggle(next: boolean) {
    const confirmMsg = next
      ? "¿Activar \"Solo Referidos CRM\"? A partir de ahora, cualquier número que NO esté cargado como referido va a ser ignorado por completo en WhatsApp (no se va a guardar ni responder)."
      : "¿Desactivar \"Solo Referidos CRM\"? WhatsApp vuelve a procesar mensajes de cualquier número, como antes de este modo.";
    if (!window.confirm(confirmMsg)) return;
    const previous = enabled;
    setEnabled(next);
    startTransition(async () => {
      try {
        await updateWhatsAppReferralsOnlyModeAction(next);
        toast.success(next ? "Modo \"Solo Referidos CRM\" activado." : "Modo \"Solo Referidos CRM\" desactivado.");
      } catch (err) {
        setEnabled(previous);
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el modo de WhatsApp.");
      }
    });
  }

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <ShieldCheck className="size-4" aria-hidden="true" />
          </span>
          <h3 className="text-[15px] font-medium text-foreground">Modo de WhatsApp</h3>
        </div>
        {enabled !== null && <Badge variant={enabled ? "success" : "neutral"}>{enabled ? "🟢 Solo Referidos CRM" : "Todos los mensajes"}</Badge>}
      </div>

      <p className="mb-4 text-sm text-neutral-500">
        Con &quot;Solo Referidos CRM&quot; activo, WhatsApp (YCloud y WhatsApp Web) solo procesa mensajes de números ya
        cargados como referido en este workspace. Cualquier otro mensaje se descarta antes de guardarse — no crea
        contacto ni conversación.
      </p>

      <div className="flex items-center justify-between gap-3 rounded-md border border-border-default p-3">
        <span className="text-sm font-medium text-foreground">Solo Referidos CRM</span>
        {enabled === null ? (
          <span className="text-xs text-neutral-500">Cargando…</span>
        ) : (
          <Switch checked={enabled} onChange={handleToggle} disabled={!canManage || isPending} label="Solo Referidos CRM" />
        )}
      </div>
    </Card>
  );
}
