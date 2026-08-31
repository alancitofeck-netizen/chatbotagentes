"use client";

import { useEffect, useState, useTransition } from "react";
import { Bot, Copy, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { getManychatStatusAction, generateManychatWebhookSecretAction, disconnectManychatAction } from "@/lib/integrations/actions";
import type { ManychatConnectionStatus } from "@/lib/integrations/manychat";

// Duplicado a propósito (no importado desde manychat.ts, que es
// "server-only") — es un literal estático, no un secreto, seguro de
// repetir acá.
const MANYCHAT_WEBHOOK_PATH = "/api/integrations/manychat/webhook";

/** Card de Integraciones para ManyChat — mismo patrón que
 * InstagramConnectionCard.tsx, pero sin OAuth: acá GrowthLink emite un
 * secreto propio que el usuario pega en un paso "External Request" de su
 * flujo de ManyChat. GrowthLink nunca inicia esa conexión ni controla el
 * flujo — solo recibe. */
export function ManyChatConnectionCard({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = useState<ManychatConnectionStatus | null>(null);
  const [isPending, startTransition] = useTransition();
  // Lazy initializer (no efecto/setState) — se lee una sola vez, en el
  // cliente, sin el ida-y-vuelta de un render extra.
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));

  useEffect(() => {
    getManychatStatusAction().then(setStatus);
  }, []);

  function handleGenerate() {
    const confirmMsg = status?.webhookSecret
      ? "¿Regenerar el secreto? El anterior deja de funcionar — vas a tener que actualizarlo en tu flujo de ManyChat."
      : null;
    if (confirmMsg && !window.confirm(confirmMsg)) return;

    startTransition(async () => {
      try {
        const secret = await generateManychatWebhookSecretAction();
        setStatus((prev) => ({ connected: true, webhookPath: prev?.webhookPath ?? MANYCHAT_WEBHOOK_PATH, webhookSecret: secret }));
        toast.success("Secreto generado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo generar el secreto.");
      }
    });
  }

  function handleDisconnect() {
    if (!window.confirm("¿Desconectar ManyChat? Los próximos eventos que mande van a ser rechazados hasta que generes un secreto nuevo.")) return;
    startTransition(async () => {
      try {
        await disconnectManychatAction();
        setStatus((prev) => ({ connected: false, webhookPath: prev?.webhookPath ?? MANYCHAT_WEBHOOK_PATH, webhookSecret: null }));
        toast.success("ManyChat desconectado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo desconectar.");
      }
    });
  }

  function copy(value: string, label: string) {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado.`);
  }

  const webhookUrl = origin ? `${origin}${status?.webhookPath ?? MANYCHAT_WEBHOOK_PATH}` : "";

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Bot className="size-4" aria-hidden="true" />
          </span>
          <h3 className="text-[15px] font-medium text-foreground">ManyChat</h3>
        </div>
        <Badge variant={status?.connected ? "success" : "neutral"}>{status?.connected ? "🟢 Conectado" : "🔴 No conectado"}</Badge>
      </div>

      <p className="mb-3 text-sm text-neutral-500">
        GrowthLink recibe y guarda la actividad de los leads que ManyChat gestiona en Instagram — nunca controla el flujo ni responde por vos.
      </p>

      {status?.webhookSecret && (
        <div className="mb-3 flex flex-col gap-2 rounded-md border border-border-default bg-surface-2 p-3">
          <div>
            <p className="text-xs font-medium text-neutral-500">URL del webhook</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate text-xs text-foreground">{webhookUrl}</code>
              <button type="button" onClick={() => copy(webhookUrl, "URL")} className="text-neutral-400 hover:text-foreground">
                <Copy className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Secreto (header Authorization: Bearer …)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate text-xs text-foreground">{status.webhookSecret}</code>
              <button type="button" onClick={() => copy(status.webhookSecret as string, "Secreto")} className="text-neutral-400 hover:text-foreground">
                <Copy className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant={status?.webhookSecret ? "secondary" : "primary"} disabled={!canManage || isPending} onClick={handleGenerate}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
          {status?.webhookSecret ? "Regenerar secreto" : "Generar secreto"}
        </Button>
        {status?.connected && (
          <Button size="sm" variant="destructive" disabled={!canManage || isPending} onClick={handleDisconnect}>
            Desconectar
          </Button>
        )}
      </div>
    </Card>
  );
}
