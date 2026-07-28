"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { MiniAppDetail } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { updateMiniApp, regenerateApiKey, deleteMiniApp } from "@/lib/miniApps/actions";

function CopyableLine({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-border-default bg-surface-2 px-3 py-2">
      <code className="flex-1 truncate text-[13px] text-foreground">{value}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 text-neutral-500 hover:text-foreground"
      >
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      </button>
    </div>
  );
}

export function ConfiguracionTab({ miniApp, members }: { miniApp: MiniAppDetail; members: WorkspaceMemberOption[] }) {
  const router = useRouter();
  const [name, setName] = useState(miniApp.name);
  const [description, setDescription] = useState(miniApp.description ?? "");
  const [assignedAgentId, setAssignedAgentId] = useState(miniApp.assignedAgentId ?? "");
  const [externalUrl, setExternalUrl] = useState(miniApp.externalUrl ?? "");
  const [allowedOrigins, setAllowedOrigins] = useState(miniApp.allowedOrigins.join("\n"));
  const [status, setStatus] = useState(miniApp.status);
  const [isPending, startTransition] = useTransition();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const endpointUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/mini-apps/${miniApp.slug}/leads` : "";
  const curlExample = `curl -X POST "${endpointUrl}" \\\n  -H "Content-Type: application/json" \\\n  -H "X-Api-Key: <tu-api-key>" \\\n  -d '{"nombre":"Prueba","whatsapp":"5215512345678","consentimiento":true,"consentimiento_fecha":"2026-01-01T00:00:00.000Z","fecha":"2026-01-01T00:00:00.000Z"}'`;

  function handleSave() {
    startTransition(async () => {
      try {
        await updateMiniApp(miniApp.id, {
          name,
          description,
          assignedAgentId: assignedAgentId || null,
          allowedOrigins: allowedOrigins.split(/[\n,]/).map((o) => o.trim()).filter(Boolean),
          externalUrl,
          status,
        });
        toast.success("Configuración guardada.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  function handleRegenerate() {
    if (!window.confirm("¿Regenerar la API key? La anterior deja de funcionar de inmediato.")) return;
    startTransition(async () => {
      try {
        const result = await regenerateApiKey(miniApp.id);
        setRevealedKey(result.apiKey);
        toast.success("API key regenerada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo regenerar la API key.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`¿Eliminar "${miniApp.name}"? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      try {
        await deleteMiniApp(miniApp.id);
        toast.success("Mini app eliminada.");
        router.push("/mini-apps");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Datos generales" />
        <div className="flex flex-col gap-4">
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Agente asignado" value={assignedAgentId} onChange={(e) => setAssignedAgentId(e.target.value)}>
              <option value="">Sin asignar</option>
              {members.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {m.fullName}
                </option>
              ))}
            </Select>
            <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as "active" | "inactive")}>
              <option value="active">Activa</option>
              <option value="inactive">Inactiva</option>
            </Select>
          </div>
          <Input label="URL donde vive la mini app" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Dominios permitidos (CORS)</label>
            <textarea
              value={allowedOrigins}
              onChange={(e) => setAllowedOrigins(e.target.value)}
              rows={3}
              className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
            />
          </div>
          <Button onClick={handleSave} loading={isPending} className="self-start">
            Guardar cambios
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Endpoint" />
        <div className="flex flex-col gap-3">
          <CopyableLine value={endpointUrl} />
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">API Key</p>
            {revealedKey ? (
              <CopyableLine value={revealedKey} />
            ) : (
              <p className="text-sm text-foreground">•••• {miniApp.apiKeyLast4}</p>
            )}
          </div>
          <Button variant="secondary" onClick={handleRegenerate} loading={isPending} className="self-start">
            Regenerar API Key
          </Button>
          <details className="text-sm">
            <summary className="cursor-pointer text-neutral-500">Ver ejemplo de request (curl)</summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-surface-3 p-3 text-xs text-foreground">{curlExample}</pre>
          </details>
        </div>
      </Card>

      <Card>
        <CardHeader title="Zona de riesgo" />
        <Button variant="destructive" onClick={handleDelete} loading={isPending}>
          Eliminar mini app
        </Button>
      </Card>
    </div>
  );
}
