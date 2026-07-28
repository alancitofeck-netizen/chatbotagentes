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
import { updateMiniApp, updateMiniAppBranding, regenerateApiKey, deleteMiniApp } from "@/lib/miniApps/actions";
import { createClient } from "@/lib/supabase/client";
import { LogoCropDialog } from "../LogoCropDialog";

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

export function ConfiguracionTab({
  miniApp,
  members,
  canManage,
}: {
  miniApp: MiniAppDetail;
  members: WorkspaceMemberOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(miniApp.name);
  const [description, setDescription] = useState(miniApp.description ?? "");
  const [assignedAgentId, setAssignedAgentId] = useState(miniApp.assignedAgentId ?? "");
  const [externalUrl, setExternalUrl] = useState(miniApp.externalUrl ?? "");
  const [allowedOrigins, setAllowedOrigins] = useState(miniApp.allowedOrigins.join("\n"));
  const [status, setStatus] = useState(miniApp.status);
  const [isPending, startTransition] = useTransition();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const [primaryColor, setPrimaryColor] = useState(miniApp.branding.primaryColor);
  const [logoUrl, setLogoUrl] = useState(miniApp.branding.logoUrl);
  const [showLogoDialog, setShowLogoDialog] = useState(false);
  const [annualReturnRatePct, setAnnualReturnRatePct] = useState(miniApp.config.annualReturnRatePct);
  const [showIngresoActual, setShowIngresoActual] = useState(miniApp.config.showIngresoActual);
  const [labelEdad, setLabelEdad] = useState(miniApp.config.fieldLabels.edad ?? "Tu edad actual");
  const [labelEdadRetiro, setLabelEdadRetiro] = useState(miniApp.config.fieldLabels.edadRetiro ?? "¿A qué edad te querés retirar?");
  const [labelAhorroMensual, setLabelAhorroMensual] = useState(
    miniApp.config.fieldLabels.ahorroMensual ?? "¿Cuánto podés ahorrar por mes? (MXN)",
  );
  const [labelIngresoActual, setLabelIngresoActual] = useState(
    miniApp.config.fieldLabels.ingresoActual ?? "Tu ingreso mensual actual (MXN, opcional)",
  );
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  const endpointUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/mini-apps/${miniApp.slug}/leads` : "";
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/apps/${miniApp.slug}` : "";
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
          config: {
            annualReturnRatePct,
            showIngresoActual,
            fieldLabels: { edad: labelEdad, edadRetiro: labelEdadRetiro, ahorroMensual: labelAhorroMensual, ingresoActual: labelIngresoActual },
          },
        });
        toast.success("Configuración guardada.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  async function handleLogoCropped(blob: Blob) {
    setIsSavingBranding(true);
    try {
      const supabase = createClient();
      const path = `${miniApp.id}/logo.webp`;
      const { error: uploadError } = await supabase.storage
        .from("mini-app-logos")
        .upload(path, blob, { upsert: true, contentType: "image/webp", cacheControl: "3600" });
      if (uploadError) throw new Error("No se pudo subir el logo.");
      const { data: publicUrlData } = supabase.storage.from("mini-app-logos").getPublicUrl(path);
      const url = `${publicUrlData.publicUrl}?v=${Date.now()}`;
      await updateMiniAppBranding(miniApp.id, { logoUrl: url, primaryColor });
      setLogoUrl(url);
      toast.success("Logo actualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el logo.");
    } finally {
      setIsSavingBranding(false);
    }
  }

  function handleSaveColor() {
    setIsSavingBranding(true);
    updateMiniAppBranding(miniApp.id, { logoUrl, primaryColor })
      .then(() => toast.success("Color actualizado."))
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo actualizar el color."))
      .finally(() => setIsSavingBranding(false));
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
        <CardHeader title="Marca y motor financiero" />
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Logo</label>
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={miniApp.name} className="size-12 rounded-full object-cover" />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-xs text-neutral-400">Sin logo</div>
                )}
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowLogoDialog(true)} loading={isSavingBranding}>
                  {logoUrl ? "Cambiar" : "Subir logo"}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Color principal</label>
              <div className="flex items-center gap-2">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-16 rounded-md border border-border-default" />
                <Button type="button" variant="secondary" size="sm" onClick={handleSaveColor} loading={isSavingBranding}>
                  Guardar
                </Button>
              </div>
            </div>
          </div>

          <div className="my-1 h-px bg-border-default" />

          <Input
            label="Tasa de rendimiento anual esperada (%)"
            type="number"
            min={1}
            max={20}
            value={String(annualReturnRatePct)}
            onChange={(e) => setAnnualReturnRatePct(Number(e.target.value) || annualReturnRatePct)}
          />
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Campos del simulador</p>
          <Input label="Etiqueta — Edad" value={labelEdad} onChange={(e) => setLabelEdad(e.target.value)} />
          <Input label="Etiqueta — Edad de retiro" value={labelEdadRetiro} onChange={(e) => setLabelEdadRetiro(e.target.value)} />
          <Input label="Etiqueta — Ahorro mensual" value={labelAhorroMensual} onChange={(e) => setLabelAhorroMensual(e.target.value)} />
          <div className="flex items-center justify-between gap-3">
            <Input
              label="Etiqueta — Ingreso actual"
              value={labelIngresoActual}
              onChange={(e) => setLabelIngresoActual(e.target.value)}
              disabled={!showIngresoActual}
              containerClassName="flex-1"
            />
            <label className="mt-6 flex items-center gap-1.5 text-xs text-neutral-500">
              <input type="checkbox" checked={showIngresoActual} onChange={(e) => setShowIngresoActual(e.target.checked)} />
              Mostrar
            </label>
          </div>
          <p className="text-xs text-neutral-500">
            Los cambios de esta sección (excepto logo y color, que se guardan al instante) se aplican al tocar &quot;Guardar cambios&quot; en Datos generales.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Página pública" />
        <div className="flex flex-col gap-3">
          <CopyableLine value={publicUrl} />
          <p className="text-xs text-neutral-500">Esta es la URL que le compartís a tus prospectos.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Endpoint (integraciones externas avanzadas)" />
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
          {canManage && (
            <Button variant="secondary" onClick={handleRegenerate} loading={isPending} className="self-start">
              Regenerar API Key
            </Button>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer text-neutral-500">Ver ejemplo de request (curl)</summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-surface-3 p-3 text-xs text-foreground">{curlExample}</pre>
          </details>
        </div>
      </Card>

      {showLogoDialog && (
        <LogoCropDialog
          open
          onClose={() => setShowLogoDialog(false)}
          onCropped={(blob) => {
            setShowLogoDialog(false);
            handleLogoCropped(blob);
          }}
        />
      )}

      {/* Owner/admin only — mirrors the sitewide "el botón ni siquiera debe
       * renderizarse" rule for manager-gated actions (same pattern
       * CrmAtsTabStrip.tsx uses for "Agentes"/ATS), rather than letting an
       * agent hit requireManagerRole's thrown error, which reaches the
       * client redacted in production (see the memory note on Server Action
       * error redaction). */}
      {canManage && (
        <Card>
          <CardHeader title="Zona de riesgo" />
          <Button variant="destructive" onClick={handleDelete} loading={isPending}>
            Eliminar mini app
          </Button>
        </Card>
      )}
    </div>
  );
}
