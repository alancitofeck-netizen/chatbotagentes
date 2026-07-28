"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { createClient } from "@/lib/supabase/client";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { createMiniApp, updateMiniAppBranding } from "@/lib/miniApps/actions";
import { DEFAULT_ANNUAL_RETURN_RATE_PCT } from "@/lib/miniApps/financialEngine";
import { DEFAULT_PRIMARY_COLOR, DEFAULT_SECONDARY_COLOR, isValidHexColor } from "@/lib/miniApps/paletteEngine";
import { LogoCropDialog } from "./LogoCropDialog";
import { MiniAppPalettePreview } from "./MiniAppPalettePreview";

const TEMPLATES = [
  { key: "simulador_retiro", label: "Simulador de Retiro", available: true },
  { key: "calculadora", label: "Calculadora (Próximamente)", available: false },
  { key: "formulario", label: "Formulario (Próximamente)", available: false },
  { key: "landing", label: "Landing (Próximamente)", available: false },
  { key: "personalizado", label: "Personalizado (Próximamente)", available: false },
] as const;

const STEPS = ["Tipo", "Marca", "Campos y motor", "Publicar"] as const;

function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</span>
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
    </div>
  );
}

export function NewMiniAppWizard({
  members,
  onClose,
  onCreated,
}: {
  members: WorkspaceMemberOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const [created, setCreated] = useState<{ slug: string; apiKey: string } | null>(null);

  // Paso 1
  const [templateKey] = useState<"simulador_retiro">("simulador_retiro");

  // Paso 2
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignedAgentId, setAssignedAgentId] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [allowedOrigins, setAllowedOrigins] = useState("");
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY_COLOR);
  const [primaryHexInput, setPrimaryHexInput] = useState(DEFAULT_PRIMARY_COLOR);
  const [secondaryHexInput, setSecondaryHexInput] = useState(DEFAULT_SECONDARY_COLOR);
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [showLogoDialog, setShowLogoDialog] = useState(false);

  // Paso 3
  const [annualReturnRatePct, setAnnualReturnRatePct] = useState(DEFAULT_ANNUAL_RETURN_RATE_PCT);
  const [showIngresoActual, setShowIngresoActual] = useState(true);
  const [labelEdad, setLabelEdad] = useState("Tu edad actual");
  const [labelEdadRetiro, setLabelEdadRetiro] = useState("¿A qué edad te querés retirar?");
  const [labelAhorroMensual, setLabelAhorroMensual] = useState("¿Cuánto podés ahorrar por mes? (MXN)");
  const [labelIngresoActual, setLabelIngresoActual] = useState("Tu ingreso mensual actual (MXN, opcional)");

  function handleLogoCropped(blob: Blob) {
    setLogoBlob(blob);
    setLogoPreviewUrl(URL.createObjectURL(blob));
  }

  async function handlePublish() {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio.");
      setStep(1);
      return;
    }
    setIsPending(true);
    try {
      const config = {
        annualReturnRatePct,
        showIngresoActual,
        fieldLabels: { edad: labelEdad, edadRetiro: labelEdadRetiro, ahorroMensual: labelAhorroMensual, ingresoActual: labelIngresoActual },
      };
      const result = await createMiniApp({
        name,
        description,
        templateKey,
        assignedAgentId: assignedAgentId || null,
        allowedOrigins: allowedOrigins
          .split(/[\n,]/)
          .map((o) => o.trim())
          .filter(Boolean),
        externalUrl,
        config,
      });

      let logoUrl: string | null = null;
      if (logoBlob) {
        const supabase = createClient();
        const path = `${result.id}/logo.webp`;
        const { error: uploadError } = await supabase.storage
          .from("mini-app-logos")
          .upload(path, logoBlob, { upsert: true, contentType: "image/webp", cacheControl: "3600" });
        if (uploadError) {
          toast.error("La mini app se creó, pero no se pudo subir el logo. Podés reintentarlo desde Configuración.");
        } else {
          const { data: publicUrlData } = supabase.storage.from("mini-app-logos").getPublicUrl(path);
          logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
        }
      }
      await updateMiniAppBranding(result.id, { logoUrl, primaryColor, secondaryColor });

      setCreated(result);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la mini app.");
    } finally {
      setIsPending(false);
    }
  }

  if (created) {
    const publicUrl = `${window.location.origin}/apps/${created.slug}`;
    const endpointUrl = `${window.location.origin}/api/public/mini-apps/${created.slug}/leads`;
    return (
      <Sheet open onClose={onClose} title="Mini App publicada" className="max-w-2xl">
        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm text-neutral-500">Tu mini app ya está en línea — compartí este link con tus prospectos.</p>
          <CopyableField label="URL pública" value={publicUrl} />
          <details className="text-sm">
            <summary className="cursor-pointer text-neutral-500">Para integraciones externas avanzadas (endpoint + API key)</summary>
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-xs text-neutral-500">Guardá esta API key ahora — no se va a poder ver de nuevo.</p>
              <CopyableField label="Endpoint" value={endpointUrl} />
              <CopyableField label="API Key" value={created.apiKey} />
            </div>
          </details>
          <Button onClick={onClose}>Listo</Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title="Nueva Mini App" className="max-w-2xl">
      <div className="flex flex-col gap-5 p-5">
        <div role="tablist" className="flex gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className={`flex-1 rounded-full px-2 py-1.5 text-center text-[11px] font-medium ${i === step ? "bg-accent-500 text-white" : "bg-surface-2 text-neutral-500"}`}>
              {i + 1}. {label}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map((t) => (
              <div
                key={t.key}
                className={`rounded-lg border p-4 text-sm ${t.available ? "border-accent-500 bg-accent-50 font-medium text-accent-700" : "border-border-default text-neutral-400"}`}
              >
                {t.label}
              </div>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Simulador de Retiro — Diego Tinoco" />
            <Input label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Select label="Agente asignado" value={assignedAgentId} onChange={(e) => setAssignedAgentId(e.target.value)}>
              <option value="">Sin asignar</option>
              {members.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {m.fullName}
                </option>
              ))}
            </Select>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Logo</label>
              <div className="flex items-center gap-3">
                {logoPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreviewUrl} alt="Logo" className="size-12 rounded-full object-cover" />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-xs text-neutral-400">Sin logo</div>
                )}
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowLogoDialog(true)}>
                  {logoPreviewUrl ? "Cambiar" : "Subir logo"}
                </Button>
              </div>
            </div>

            {/* Solo estos dos colores — el resto del sistema visual de la
             * página pública se genera solo (paletteEngine.ts), con
             * contraste WCAG verificado automáticamente. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

            <Input
              label="URL donde vive la mini app (opcional)"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://simulador-retiro.ejemplo.com"
            />
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <Input
              label="Tasa de rendimiento anual esperada (%)"
              type="number"
              min={1}
              max={20}
              value={String(annualReturnRatePct)}
              onChange={(e) => setAnnualReturnRatePct(Number(e.target.value) || DEFAULT_ANNUAL_RETURN_RATE_PCT)}
            />
            <div className="my-1 h-px bg-border-default" />
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
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Dominios permitidos (CORS, opcional)</label>
              <textarea
                value={allowedOrigins}
                onChange={(e) => setAllowedOrigins(e.target.value)}
                placeholder={"Solo si además querés aceptar leads desde un dominio externo"}
                rows={2}
                className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3 rounded-md border border-border-default bg-surface-2 p-4 text-sm">
            <p>
              <strong>{name || "(sin nombre)"}</strong> — {description || "sin descripción"}
            </p>
            <p className="text-neutral-500">Tasa de rendimiento: {annualReturnRatePct}%</p>
            <p className="text-neutral-500">Se va a publicar en tu propia URL de Growth Link al confirmar.</p>
          </div>
        )}

        <div className="flex justify-between gap-2">
          <Button type="button" variant="secondary" onClick={() => (step === 0 ? onClose() : setStep(step - 1))} disabled={isPending}>
            {step === 0 ? "Cancelar" : "Atrás"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep(step + 1)}>
              Siguiente
            </Button>
          ) : (
            <Button type="button" onClick={handlePublish} loading={isPending}>
              Publicar
            </Button>
          )}
        </div>
      </div>

      {showLogoDialog && <LogoCropDialog open onClose={() => setShowLogoDialog(false)} onCropped={handleLogoCropped} />}
    </Sheet>
  );
}
