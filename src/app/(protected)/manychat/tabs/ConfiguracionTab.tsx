"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import { ManyChatConnectionCard } from "@/app/(protected)/profile/sections/ManyChatConnectionCard";
import { saveManychatApiTokenAction, syncManychatContactsAction } from "@/lib/integrations/actions";
import type { ManychatConnectionStatus } from "@/lib/integrations/manychat";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** ManyChat → Configuración. Reusa ManyChatConnectionCard tal cual (misma
 * lógica que Perfil → Integraciones, no se duplica) para el secreto del
 * webhook, y suma acá el API Token (para "Sincronizar ahora") — dos
 * credenciales distintas, para dos direcciones distintas de la
 * integración. */
export function ConfiguracionTab({
  status,
  onStatusChange,
  canManage,
}: {
  status: ManychatConnectionStatus;
  onStatusChange: (status: ManychatConnectionStatus) => void;
  canManage: boolean;
}) {
  const [token, setToken] = useState("");
  const [isSavingToken, startSaveToken] = useTransition();
  const [isSyncing, startSync] = useTransition();

  function handleSaveToken() {
    if (!token.trim()) return;
    startSaveToken(async () => {
      try {
        await saveManychatApiTokenAction(token.trim());
        onStatusChange({ ...status, hasApiToken: true });
        setToken("");
        toast.success("API Token guardado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar el token.");
      }
    });
  }

  function handleSync() {
    startSync(async () => {
      try {
        const result = await syncManychatContactsAction();
        onStatusChange({ ...status, lastSyncedAt: new Date().toISOString() });
        toast.success(`Sincronización terminada — ${result.refreshed} actualizados${result.failed ? `, ${result.failed} fallaron` : ""}.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo sincronizar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ManyChatConnectionCard canManage={canManage} />

      <Card>
        <CardHeader
          title="Sincronizar ahora"
          action={status.lastSyncedAt && <span className="text-xs text-neutral-500">Última: {formatDateTime(status.lastSyncedAt)}</span>}
        />
        <p className="mb-3 text-sm text-neutral-500">
          <strong>Importante:</strong> la API de ManyChat no tiene forma de listar/exportar todos tus contactos — esto nunca descubre leads
          nuevos (esos solo llegan por el webhook cuando tu flujo los manda). Sincronizar ahora solo refresca los <em>tags</em> y{" "}
          <em>custom fields</em> de los leads que GrowthLink ya conoce, contra la API de ManyChat.
        </p>

        {!status.hasApiToken ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <Input label="API Token de ManyChat" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Pegá tu token acá..." type="password" disabled={!canManage} />
            </div>
            <Button size="sm" onClick={handleSaveToken} loading={isSavingToken} disabled={!canManage || !token.trim()}>
              Guardar token
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="success">Token conectado</Badge>
            <Button size="sm" variant="secondary" onClick={handleSync} loading={isSyncing} disabled={!canManage}>
              Sincronizar ahora
            </Button>
          </div>
        )}
        <p className="mt-2 text-xs text-neutral-400">
          Tu API Token está en ManyChat → Settings → API. Se guarda encriptado, nunca se expone en el navegador.
        </p>
      </Card>

      <Card>
        <CardHeader title="Cómo configurar el paso External Request en ManyChat" />
        <ol className="flex list-decimal flex-col gap-2 pl-4 text-sm text-neutral-600">
          <li>En tu flujo de ManyChat, agregá una acción &quot;External Request&quot; (Dev Tools → External Request).</li>
          <li>
            Método <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">POST</code>, URL: la de arriba (botón &quot;Copiar&quot; en la card de conexión).
          </li>
          <li>
            Header <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">Authorization: Bearer &lt;tu secreto&gt;</code> (el mismo de arriba).
          </li>
          <li>
            Body JSON, con las variables de ManyChat que necesites — solo <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">manychat_contact_id</code> es
            obligatorio:
          </li>
        </ol>
        <pre className="mt-2 overflow-x-auto rounded-md bg-surface-2 p-3 text-xs text-foreground">
          {`{
  "manychat_contact_id": "{{user_id}}",
  "instagram_username": "{{ig_username}}",
  "first_name": "{{first_name}}",
  "message": { "direction": "inbound", "body": "{{last_input_text}}" },
  "custom_fields": { "interes": "{{cf_interes}}" },
  "source": "reel",
  "content_name": "Nombre de este Reel/Story — texto fijo, vos lo elegís"
}`}
        </pre>
        <p className="mt-2 text-xs text-neutral-500">
          <code className="rounded bg-surface-2 px-1 py-0.5">source</code>/<code className="rounded bg-surface-2 px-1 py-0.5">content_name</code>/
          <code className="rounded bg-surface-2 px-1 py-0.5">entry_point</code>/<code className="rounded bg-surface-2 px-1 py-0.5">campaign</code> no son
          variables que ManyChat te dé automáticamente — no existe ese dato en su sistema. Si querés que un lead aparezca como &quot;Reel&quot; en GrowthLink,
          escribilo vos como texto fijo en esta automatización puntual (repetí este paso por cada Reel/Story que quieras poder distinguir).
        </p>
      </Card>
    </div>
  );
}
