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
import { isValidHexColor } from "@/lib/miniApps/paletteEngine";
import { DEFAULT_ANNUAL_RETURN_RATE_PCT } from "@/lib/miniApps/financialEngine";
import { LogoCropDialog } from "../LogoCropDialog";
import { MiniAppPalettePreview } from "../MiniAppPalettePreview";
import { LINKED_APP_TYPE_OPTIONS, LINKED_APP_ICON_OPTIONS, DEFAULT_LINKED_APP_ICON, type LinkedAppType } from "@/lib/miniApps/linkedAppOptions";
import { BundleDropzone } from "../BundleDropzone";
import { BundlePreviewModal } from "../BundlePreviewModal";

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
  const [secondaryColor, setSecondaryColor] = useState(miniApp.branding.secondaryColor);
  const [primaryHexInput, setPrimaryHexInput] = useState(miniApp.branding.primaryColor);
  const [secondaryHexInput, setSecondaryHexInput] = useState(miniApp.branding.secondaryColor);
  const [logoUrl, setLogoUrl] = useState(miniApp.branding.logoUrl);
  const [showLogoDialog, setShowLogoDialog] = useState(false);

  const isSimulador = miniApp.templateKey === "simulador_retiro";
  const isCalculadora = miniApp.templateKey === "calculadora_brecha_retiro";
  const isLinkedApp = miniApp.templateKey === "app_vinculada";
  const [annualReturnRatePct, setAnnualReturnRatePct] = useState(isSimulador ? miniApp.config.annualReturnRatePct : DEFAULT_ANNUAL_RETURN_RATE_PCT);
  const [showIngresoActual, setShowIngresoActual] = useState(isSimulador ? miniApp.config.showIngresoActual : true);
  const [labelEdad, setLabelEdad] = useState(isSimulador ? (miniApp.config.fieldLabels.edad ?? "Tu edad actual") : "Tu edad actual");
  const [labelEdadRetiro, setLabelEdadRetiro] = useState(
    isSimulador ? (miniApp.config.fieldLabels.edadRetiro ?? "¿A qué edad te querés retirar?") : "¿A qué edad te querés retirar?",
  );
  const [labelAhorroMensual, setLabelAhorroMensual] = useState(
    isSimulador ? (miniApp.config.fieldLabels.ahorroMensual ?? "¿Cuánto podés ahorrar por mes? (MXN)") : "¿Cuánto podés ahorrar por mes? (MXN)",
  );
  const [labelIngresoActual, setLabelIngresoActual] = useState(
    isSimulador ? (miniApp.config.fieldLabels.ingresoActual ?? "Tu ingreso mensual actual (MXN, opcional)") : "Tu ingreso mensual actual (MXN, opcional)",
  );

  const [whatsappAsesor, setWhatsappAsesor] = useState(isCalculadora ? miniApp.config.whatsappAsesor : "");
  const [avisoPrivacidadUrl, setAvisoPrivacidadUrl] = useState(isCalculadora ? miniApp.config.avisoPrivacidadUrl : "");
  const [licenseBadge, setLicenseBadge] = useState(isCalculadora ? miniApp.config.licenseBadge : "");

  const [linkedAppType, setLinkedAppType] = useState<LinkedAppType>(isLinkedApp ? miniApp.config.linkedAppType : "otro");
  const [linkedAppIcon, setLinkedAppIcon] = useState(isLinkedApp ? miniApp.config.icon : DEFAULT_LINKED_APP_ICON);

  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const isUploadedApp = isLinkedApp && miniApp.config.hostingMode === "upload";
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const endpointUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/mini-apps/${miniApp.slug}/leads` : "";
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/apps/${miniApp.slug}` : "";
  const curlExample = `curl -X POST "${endpointUrl}" \\\n  -H "Content-Type: application/json" \\\n  -H "X-Api-Key: <tu-api-key>" \\\n  -d '{"nombre":"Prueba","whatsapp":"5215512345678","consentimiento":true,"consentimiento_fecha":"2026-01-01T00:00:00.000Z","fecha":"2026-01-01T00:00:00.000Z"}'`;
  const sdkOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const sdkSnippet = `<script src="${sdkOrigin}/api/public/sdk.js"></script>\n<script>\n  GrowthLink.init({\n    appId: "${miniApp.slug}",\n    apiKey: "<tu-api-key>",\n  });\n</script>`;
  const advancedSdkSnippet = `<!-- Uso avanzado (opcional) — por defecto cualquier <form> o botón\n     "Guardar/Continuar/Enviar/Calcular/Finalizar/..." ya sincroniza solo. -->\n<script>\n  // Capturar un formulario/contenedor puntual a mano:\n  GrowthLink.captureForm(document.querySelector("#miFormulario"));\n\n  // O enviar un lead con forma fija:\n  GrowthLink.captureLead({\n    name: "Juan Pérez",\n    phone: "5215512345678",\n    email: "juan@ejemplo.com",\n    company: "Acme",\n    notes: "Interesado en el plan premium",\n  });\n</script>`;

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
          config: isSimulador
            ? {
                annualReturnRatePct,
                showIngresoActual,
                fieldLabels: { edad: labelEdad, edadRetiro: labelEdadRetiro, ahorroMensual: labelAhorroMensual, ingresoActual: labelIngresoActual },
              }
            : isLinkedApp
              ? {
                  linkedAppType,
                  icon: linkedAppIcon,
                  // config es un reemplazo completo, no un merge (ver
                  // updateMiniApp) — hay que reenviar estos tres campos para
                  // no perder la publicación alojada al guardar Datos
                  // generales (los actualiza bundle-upload/route.ts, no este
                  // formulario).
                  hostingMode: miniApp.config.hostingMode,
                  indexPath: miniApp.config.indexPath,
                  bundleVersion: miniApp.config.bundleVersion,
                }
              : { whatsappAsesor, avisoPrivacidadUrl, licenseBadge },
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
      await updateMiniAppBranding(miniApp.id, { logoUrl: url, primaryColor, secondaryColor });
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
    updateMiniAppBranding(miniApp.id, { logoUrl, primaryColor, secondaryColor })
      .then(() => toast.success("Colores actualizados."))
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo actualizar el color."))
      .finally(() => setIsSavingBranding(false));
  }

  function handleRegenerate() {
    const confirmMessage = isUploadedApp
      ? "¿Regenerar la API key? La anterior deja de funcionar de inmediato — el archivo publicado se actualiza solo con la nueva key (también sirve para reparar una app que nunca capturó leads correctamente)."
      : "¿Regenerar la API key? La anterior deja de funcionar de inmediato.";
    if (!window.confirm(confirmMessage)) return;
    startTransition(async () => {
      try {
        const result = await regenerateApiKey(miniApp.id);
        setRevealedKey(result.apiKey);
        toast.success(isUploadedApp ? "API key regenerada y archivo publicado re-sincronizado." : "API key regenerada.");
        if (isUploadedApp) router.refresh();
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
          {!isUploadedApp && (
            <Input
              label={isLinkedApp ? "URL de la aplicación externa" : "URL donde vive la mini app"}
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
            />
          )}
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

          {/* Solo estos dos colores — el resto del sistema visual de la
           * página pública (fondos, botones, hover, texto, bordes, íconos,
           * gráficos, etiquetas, sombras, gradientes, en claro y oscuro) se
           * genera automáticamente desde acá (paletteEngine.ts), con
           * contraste WCAG verificado — el usuario no vuelve a decidir nada
           * de diseño más allá de estos dos valores. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Color principal</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value);
                    setPrimaryHexInput(e.target.value);
                  }}
                  className="h-9 w-12 shrink-0 rounded-md border border-border-default"
                />
                <Input
                  label=""
                  containerClassName="flex-1"
                  value={primaryHexInput}
                  onChange={(e) => {
                    setPrimaryHexInput(e.target.value);
                    if (isValidHexColor(e.target.value)) setPrimaryColor(e.target.value);
                  }}
                  error={primaryHexInput && !isValidHexColor(primaryHexInput) ? "Hex inválido" : undefined}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Color secundario</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => {
                    setSecondaryColor(e.target.value);
                    setSecondaryHexInput(e.target.value);
                  }}
                  className="h-9 w-12 shrink-0 rounded-md border border-border-default"
                />
                <Input
                  label=""
                  containerClassName="flex-1"
                  value={secondaryHexInput}
                  onChange={(e) => {
                    setSecondaryHexInput(e.target.value);
                    if (isValidHexColor(e.target.value)) setSecondaryColor(e.target.value);
                  }}
                  error={secondaryHexInput && !isValidHexColor(secondaryHexInput) ? "Hex inválido" : undefined}
                />
              </div>
            </div>
          </div>

          <MiniAppPalettePreview primaryColor={primaryColor} secondaryColor={secondaryColor} />

          <Button type="button" variant="secondary" size="sm" onClick={handleSaveColor} loading={isSavingBranding} className="self-start">
            Guardar colores
          </Button>

          <div className="my-1 h-px bg-border-default" />

          {isSimulador ? (
            <>
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
            </>
          ) : isLinkedApp ? (
            <>
              <Select label="Tipo de aplicación" value={linkedAppType} onChange={(e) => setLinkedAppType(e.target.value as LinkedAppType)}>
                {LINKED_APP_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Select label="Ícono" value={linkedAppIcon} onChange={(e) => setLinkedAppIcon(e.target.value)}>
                {LINKED_APP_ICON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </>
          ) : (
            <>
              <Input
                label="WhatsApp del asesor (solo dígitos, con código de país)"
                value={whatsappAsesor}
                onChange={(e) => setWhatsappAsesor(e.target.value)}
                placeholder="5215512345678"
              />
              <Input
                label="URL del Aviso de Privacidad"
                value={avisoPrivacidadUrl}
                onChange={(e) => setAvisoPrivacidadUrl(e.target.value)}
                placeholder="https://..."
              />
              <Input
                label="Cédula / credencial (opcional)"
                value={licenseBadge}
                onChange={(e) => setLicenseBadge(e.target.value)}
                placeholder="Cédula CNSF vigente"
              />
            </>
          )}
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

      {isUploadedApp && (
        <Card>
          <CardHeader title="Aplicación alojada" />
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground">
              Versión actual: <strong>v{miniApp.config.bundleVersion ?? 0}</strong> — archivo principal: {miniApp.config.indexPath}
            </p>
            <p className="text-xs text-neutral-500">
              Subí un nuevo .html o .zip para reemplazar la versión publicada — la URL pública, los leads y las estadísticas se mantienen intactos.
              Cada archivo que subís (este o el de arriba) se publica con el snippet del SDK ya insertado automáticamente y una API Key nueva — no
              hace falta que edites tu HTML a mano. Si esta app nunca capturó leads correctamente, alcanza con volver a subir el mismo archivo, o con
              &ldquo;Regenerar API Key&rdquo; más abajo, para repararla.
            </p>
            <BundleDropzone ensureMiniAppId={async () => miniApp.id} onUploaded={() => { toast.success("Nueva versión publicada."); router.refresh(); }} onPreview={setPreviewUrl} />
          </div>
        </Card>
      )}

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
            <summary className="cursor-pointer text-neutral-500">Ver snippet de integración (SDK JavaScript)</summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-surface-3 p-3 text-xs text-foreground">{sdkSnippet}</pre>
            <p className="mt-2 text-xs text-neutral-500">
              Pegá esto antes de <code>{"</body>"}</code> en el HTML de tu app — a partir de ahí, cualquier formulario (sin importar el nombre del
              botón: Guardar, Continuar, Enviar, Calcular, Finalizar...) sincroniza solo con el CRM, sin escribir código adicional. El{" "}
              <code>{"<script src>"}</code> tiene que ser una URL absoluta (no relativa) para que el SDK pueda ubicarse solo.
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-neutral-500">Uso avanzado / manual</summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-surface-3 p-3 text-xs text-foreground">{advancedSdkSnippet}</pre>
            </details>
          </details>
          <details className="text-sm">
            <summary className="cursor-pointer text-neutral-500">Ver ejemplo de request (curl)</summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-surface-3 p-3 text-xs text-foreground">{curlExample}</pre>
          </details>
        </div>
      </Card>

      {previewUrl && <BundlePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}

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
