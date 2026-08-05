"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { createMiniApp, updateMiniAppBranding } from "@/lib/miniApps/actions";
import { DEFAULT_PRIMARY_COLOR, DEFAULT_SECONDARY_COLOR, isValidHexColor } from "@/lib/miniApps/paletteEngine";
import { LINKED_APP_TYPE_OPTIONS, LINKED_APP_ICON_OPTIONS, DEFAULT_LINKED_APP_ICON, type LinkedAppType } from "@/lib/miniApps/linkedAppOptions";
import { MiniAppPalettePreview } from "./MiniAppPalettePreview";
import { BundleDropzone, type BundleUploadResult } from "./BundleDropzone";
import { BundlePreviewModal } from "./BundlePreviewModal";

const STEPS = ["Información", "Vincular aplicación", "Integración"] as const;

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

/** "Vincular App" — conecta una app HTML externa (ej. hecha con Claude,
 * alojada en Netlify o un dominio propio) al CRM sin recrearla como
 * plantilla propia. Fase 1: solo vincular por URL (Opción B) — subir/alojar
 * un archivo HTML/ZIP queda para una fase futura (requiere una estrategia
 * de aislamiento para que el HTML de un tercero no corra con las cookies de
 * GrowthLink). Componente dedicado (no una rama de NewMiniAppWizard.tsx) —
 * el flujo es distinto en naturaleza — pero reutiliza sus mismas piezas:
 * Sheet/Input/Select/Button, el picker de 2 colores + MiniAppPalettePreview,
 * y el mismo patrón de reveal-once de API Key. */
export function LinkAppWizard({
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

  // Paso 1 — Información
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignedAgentId, setAssignedAgentId] = useState("");
  const [linkedAppType, setLinkedAppType] = useState<LinkedAppType>("html");
  const [icon, setIcon] = useState<string>(DEFAULT_LINKED_APP_ICON);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY_COLOR);
  const [primaryHexInput, setPrimaryHexInput] = useState(DEFAULT_PRIMARY_COLOR);
  const [secondaryHexInput, setSecondaryHexInput] = useState(DEFAULT_SECONDARY_COLOR);

  // Paso 2 — Vincular aplicación
  const [hostingMode, setHostingMode] = useState<"url" | "upload">("url");
  const [externalUrl, setExternalUrl] = useState("");
  const [allowedOrigins, setAllowedOrigins] = useState("");
  const [uploadedApp, setUploadedApp] = useState<{ id: string; slug: string; apiKey: string } | null>(null);
  const [uploadedBundle, setUploadedBundle] = useState<BundleUploadResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function parsedAllowedOrigins() {
    return allowedOrigins
      .split(/[\n,]/)
      .map((o) => o.trim())
      .filter(Boolean);
  }

  // Se llama la primera vez que el usuario suelta un archivo válido en la
  // pestaña "Subir archivo" — crea la mini app ya mismo (en vez de esperar al
  // botón "Vincular" final) para poder subir el bundle contra un miniAppId
  // real y mostrar una "Vista previa" que es el render de producción, no una
  // maqueta. Si ya existe (reemplazo de archivo antes de terminar el
  // asistente), devuelve el mismo id.
  async function ensureUploadedMiniAppId(): Promise<string> {
    if (uploadedApp) return uploadedApp.id;
    if (!name.trim()) throw new Error("Completá el nombre en el paso 1 antes de subir un archivo.");
    const result = await createMiniApp({
      name,
      description,
      templateKey: "app_vinculada",
      assignedAgentId: assignedAgentId || null,
      allowedOrigins: parsedAllowedOrigins(),
      externalUrl: "",
      config: { linkedAppType, icon, hostingMode: "upload" },
    });
    await updateMiniAppBranding(result.id, { logoUrl: null, primaryColor, secondaryColor });
    setUploadedApp(result);
    return result.id;
  }

  async function handlePublish() {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio.");
      setStep(0);
      return;
    }
    if (hostingMode === "upload") {
      if (!uploadedApp) {
        toast.error("Subí un archivo antes de continuar.");
        setStep(1);
        return;
      }
      setIsPending(true);
      try {
        await updateMiniAppBranding(uploadedApp.id, { logoUrl: null, primaryColor, secondaryColor });
        setCreated(uploadedApp);
        onCreated();
      } finally {
        setIsPending(false);
      }
      return;
    }
    if (!externalUrl.trim()) {
      toast.error("La URL de la aplicación externa es obligatoria.");
      setStep(1);
      return;
    }
    setIsPending(true);
    try {
      const result = await createMiniApp({
        name,
        description,
        templateKey: "app_vinculada",
        assignedAgentId: assignedAgentId || null,
        allowedOrigins: parsedAllowedOrigins(),
        externalUrl,
        config: { linkedAppType, icon, hostingMode: "url" },
      });
      await updateMiniAppBranding(result.id, { logoUrl: null, primaryColor, secondaryColor });
      setCreated(result);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo vincular la app.");
    } finally {
      setIsPending(false);
    }
  }

  if (created) {
    const publicUrl = `${window.location.origin}/apps/${created.slug}`;
    const endpointUrl = `${window.location.origin}/api/public/mini-apps/${created.slug}/leads`;
    const sdkSnippet = `<script src="${window.location.origin}/api/public/sdk.js"></script>\n<script>\n  GrowthLink.init({\n    appId: "${created.slug}",\n    apiKey: "${created.apiKey}",\n  });\n</script>`;
    return (
      <Sheet open onClose={onClose} title="App vinculada" className="max-w-2xl">
        <div className="flex flex-col gap-4 p-5">
          {hostingMode === "upload" ? (
            <p className="text-sm text-neutral-500">
              Ya insertamos el snippet de integración en tu archivo automáticamente — no hace falta que edites nada. Cualquier formulario de esa
              página ya sincroniza solo con el CRM.
            </p>
          ) : (
            <p className="text-sm text-neutral-500">
              Guardá esta API key ahora — no se va a poder ver de nuevo. El desarrollador de la app externa solo necesita pegar el snippet de abajo
              antes de <code>{"</body>"}</code> — a partir de ahí, cualquier formulario de esa página sincroniza solo con el CRM, sin escribir código
              adicional.
            </p>
          )}
          <CopyableField label="App ID" value={created.slug} />
          <CopyableField label="Endpoint" value={endpointUrl} />
          <CopyableField label="API Key" value={created.apiKey} />
          {hostingMode === "url" && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">Snippet de integración (SDK)</span>
              <pre className="overflow-x-auto rounded-md border border-border-default bg-surface-2 p-3 text-xs text-foreground">{sdkSnippet}</pre>
            </div>
          )}
          <CopyableField label="Página de aterrizaje pública" value={publicUrl} />
          <Button onClick={onClose}>Listo</Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title="Vincular App" className="max-w-2xl">
      <div className="flex flex-col gap-5 p-5">
        <div role="tablist" className="flex gap-2">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`flex-1 rounded-full px-2 py-1.5 text-center text-[11px] font-medium ${i === step ? "bg-accent-500 text-white" : "bg-surface-2 text-neutral-500"}`}
            >
              {i + 1}. {label}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Calculadora de Retiro (Claude)" />
            <Input label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Select label="Agente asignado" value={assignedAgentId} onChange={(e) => setAssignedAgentId(e.target.value)}>
              <option value="">Sin asignar</option>
              {members.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {m.fullName}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Categoría / tipo de app" value={linkedAppType} onChange={(e) => setLinkedAppType(e.target.value as LinkedAppType)}>
                {LINKED_APP_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Select label="Ícono" value={icon} onChange={(e) => setIcon(e.target.value)}>
                {LINKED_APP_ICON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Mismos dos colores que el resto de las mini apps — el sistema
             * visual completo de la página de aterrizaje se genera solo. */}
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
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div role="tablist" className="flex gap-2 border-b border-border-default">
              {(["url", "upload"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setHostingMode(mode)}
                  className={`px-3 py-2 text-sm font-medium ${
                    hostingMode === mode ? "border-b-2 border-accent-500 text-foreground" : "text-neutral-500 hover:text-foreground"
                  }`}
                >
                  {mode === "url" ? "○ Desde URL" : "● Subir archivo"}
                </button>
              ))}
            </div>

            {hostingMode === "url" ? (
              <>
                <Input
                  label="URL de la aplicación externa"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://miapp.netlify.app"
                />
                <p className="text-xs text-neutral-500">
                  GrowthLink no aloja esta aplicación, solo la conecta — la página pública de esta mini app va a llevar a tus prospectos directo a
                  esta URL.
                </p>
              </>
            ) : (
              <>
                <BundleDropzone
                  ensureMiniAppId={ensureUploadedMiniAppId}
                  onUploaded={(result) => {
                    setUploadedBundle(result);
                    // El bundle recién subido ya tiene esta key embebida
                    // (bundle-upload/route.ts la regenera en cada subida) —
                    // es la única que realmente sirve contra lo que se está
                    // sirviendo, reemplaza a la de creación inicial.
                    setUploadedApp((prev) => (prev ? { ...prev, apiKey: result.apiKey } : prev));
                  }}
                  onPreview={setPreviewUrl}
                />
                <p className="text-xs text-neutral-500">
                  Subí un .html o un .zip (con index.html en la raíz) — GrowthLink lo aloja, sin depender de Netlify, Vercel ni GitHub Pages. Es el
                  mismo mecanismo si venís de descargar un ZIP generado por Claude: arrastralo acá y publicalo.
                </p>
              </>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Dominios permitidos (CORS, opcional)</label>
              <textarea
                value={allowedOrigins}
                onChange={(e) => setAllowedOrigins(e.target.value)}
                placeholder="Solo si tu app va a llamar al endpoint directamente desde el navegador del visitante"
                rows={2}
                className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3 rounded-md border border-border-default bg-surface-2 p-4 text-sm">
            <p>
              <strong>{name || "(sin nombre)"}</strong> — {description || "sin descripción"}
            </p>
            {hostingMode === "upload" ? (
              <p className="text-neutral-500">
                {uploadedBundle
                  ? `Aplicación publicada por GrowthLink — archivo principal: ${uploadedBundle.indexPath} (v${uploadedBundle.bundleVersion}).`
                  : "Todavía no subiste ningún archivo — volvé al paso anterior."}
              </p>
            ) : (
              <p className="text-neutral-500">Se conecta a: {externalUrl || "(sin URL)"}</p>
            )}
            <p className="text-neutral-500">
              {hostingMode === "upload"
                ? "GrowthLink ya generó el App ID, la API Key y activó la captura de leads — al confirmar vas a ver el resumen de integración."
                : "Al confirmar, GrowthLink genera el App ID, la API Key y el snippet de integración — los vas a ver en la pantalla siguiente."}
            </p>
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
              Vincular
            </Button>
          )}
        </div>
      </div>
      {previewUrl && <BundlePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}
    </Sheet>
  );
}
