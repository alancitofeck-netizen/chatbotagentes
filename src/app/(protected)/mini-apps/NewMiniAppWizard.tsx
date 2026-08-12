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
import type {
  MiniAppTemplateKey,
  MiniAppFieldConfig,
  CalculadoraBrechaConfig,
  DiagnosticoFinancieroConfig,
  DiagnosticoRetiroConfig,
  DiagnosticoSolidezConfig,
  MetaUniversitariaConfig,
} from "@/lib/miniApps/queries";
import {
  DEFAULT_DIAGNOSTICO_AGENTE,
  DEFAULT_DIAGNOSTICO_QUESTIONS,
  DEFAULT_DIAGNOSTICO_LEVELS,
  type DiagnosticoQuestion,
  type DiagnosticoLevel,
} from "@/lib/miniApps/diagnosticoDefaults";
import {
  DEFAULT_DIAGNOSTICO_RETIRO_ASESOR,
  DEFAULT_DIAGNOSTICO_RETIRO_REFERIDO,
  DEFAULT_DIAGNOSTICO_RETIRO_PRODUCTO,
  DEFAULT_DIAGNOSTICO_RETIRO_TEXTOS,
  DEFAULT_DIAGNOSTICO_RETIRO_AREA_LABELS,
  DEFAULT_DIAGNOSTICO_RETIRO_QUESTIONS,
  DEFAULT_DIAGNOSTICO_RETIRO_UMBRAL_1,
  DEFAULT_DIAGNOSTICO_RETIRO_UMBRAL_2,
  DEFAULT_DIAGNOSTICO_RETIRO_PERFILES,
  DEFAULT_DIAGNOSTICO_RETIRO_RECO_POOL,
  DEFAULT_DIAGNOSTICO_RETIRO_THEME_POOL,
  DIAGNOSTICO_RETIRO_AREAS,
  DIAGNOSTICO_RETIRO_THEME_KEYS,
  type DiagnosticoRetiroArea,
  type DiagnosticoRetiroQuestion,
  type DiagnosticoRetiroOption,
  type DiagnosticoRetiroPerfil,
  type DiagnosticoRetiroRecoPool,
  type DiagnosticoRetiroThemePool,
  type DiagnosticoRetiroThemeKey,
} from "@/lib/miniApps/diagnosticoRetiroDefaults";
import { DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND, DIAGNOSTICO_SOLIDEZ_THEME_OPTIONS, type DiagnosticoSolidezTheme } from "@/lib/miniApps/diagnosticoSolidezDefaults";
import { DEFAULT_META_UNIVERSITARIA_BRAND } from "@/lib/miniApps/metaUniversitariaDefaults";
import { LogoCropDialog } from "./LogoCropDialog";
import { MiniAppPalettePreview } from "./MiniAppPalettePreview";

const TEMPLATES = [
  { key: "simulador_retiro", label: "Simulador de Retiro", available: true },
  { key: "calculadora_brecha_retiro", label: "Calculadora de Brecha de Retiro", available: true },
  { key: "diagnostico_financiero", label: "Diagnóstico Interactivo Financiero", available: true },
  { key: "diagnostico_financiero_retiro", label: "Diagnóstico Financiero - Retiro", available: true },
  { key: "diagnostico_solidez_financiera", label: "diagnostico financiero - Caballo de Troya", available: true },
  { key: "calculadora_meta_universitaria", label: "Calculadora de Meta Universitaria", available: true },
  { key: "formulario", label: "Formulario (Próximamente)", available: false },
  { key: "landing", label: "Landing (Próximamente)", available: false },
  { key: "personalizado", label: "Personalizado (Próximamente)", available: false },
] as const;

const RETIRO_TIERS = ["low", "mid", "high"] as const;
const RETIRO_TIER_LABELS: Record<(typeof RETIRO_TIERS)[number], string> = { low: "Puntaje bajo", mid: "Puntaje medio", high: "Puntaje alto" };

function emptyRetiroOption(): DiagnosticoRetiroOption {
  return { label: "", points: { retiro: 0, ahorro: 0, fiscal: 0, proteccion: 0 }, theme: "" };
}

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
  const [templateKey, setTemplateKey] = useState<MiniAppTemplateKey>("simulador_retiro");

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

  // Paso 3 (Simulador de Retiro)
  const [annualReturnRatePct, setAnnualReturnRatePct] = useState(DEFAULT_ANNUAL_RETURN_RATE_PCT);
  const [showIngresoActual, setShowIngresoActual] = useState(true);
  const [labelEdad, setLabelEdad] = useState("Tu edad actual");
  const [labelEdadRetiro, setLabelEdadRetiro] = useState("¿A qué edad te querés retirar?");
  const [labelAhorroMensual, setLabelAhorroMensual] = useState("¿Cuánto podés ahorrar por mes? (MXN)");
  const [labelIngresoActual, setLabelIngresoActual] = useState("Tu ingreso mensual actual (MXN, opcional)");

  // Paso 3 (Calculadora de Brecha de Retiro)
  const [whatsappAsesor, setWhatsappAsesor] = useState("");
  const [avisoPrivacidadUrl, setAvisoPrivacidadUrl] = useState("");
  const [licenseBadge, setLicenseBadge] = useState("");

  // Paso 2 (Diagnóstico Interactivo Financiero) — campos del objeto AGENTE
  // que el HTML original tenía hardcodeados; "nombre" se autocompleta al
  // elegir "Agente asignado" (ver el Select de Paso 2 más abajo) y queda
  // editable por si se quiere mostrar un nombre distinto.
  const [diagNombre, setDiagNombre] = useState("");
  const [diagMarca, setDiagMarca] = useState(DEFAULT_DIAGNOSTICO_AGENTE.marca);
  const [diagRol, setDiagRol] = useState(DEFAULT_DIAGNOSTICO_AGENTE.rol);
  const [diagBadge, setDiagBadge] = useState(DEFAULT_DIAGNOSTICO_AGENTE.badge);
  const [diagTitulo, setDiagTitulo] = useState(DEFAULT_DIAGNOSTICO_AGENTE.titulo);
  const [diagSubtitulo, setDiagSubtitulo] = useState(DEFAULT_DIAGNOSTICO_AGENTE.subtitulo);
  const [diagWhatsapp, setDiagWhatsapp] = useState(DEFAULT_DIAGNOSTICO_AGENTE.whatsapp);
  const [diagCtaUrl, setDiagCtaUrl] = useState(DEFAULT_DIAGNOSTICO_AGENTE.ctaUrl);
  const [diagWebhookUrl, setDiagWebhookUrl] = useState(DEFAULT_DIAGNOSTICO_AGENTE.webhookUrl);

  // Paso 3 (Diagnóstico Interactivo Financiero) — arranca con el dataset
  // original completo (diagnosticoDefaults.ts), editable pregunta por
  // pregunta/nivel por nivel. Los pesos de cada opción (0/1/2/3, en ese
  // orden) quedan fijos — no se exponen para editar — porque la fórmula de
  // score original (`maxRaw += 3` por pregunta) asume ese rango exacto; si
  // se permitieran pesos arbitrarios el score dejaría de coincidir con la
  // lógica del HTML original.
  const [diagQuestions, setDiagQuestions] = useState<DiagnosticoQuestion[]>(DEFAULT_DIAGNOSTICO_QUESTIONS);
  const [diagLevels, setDiagLevels] = useState<DiagnosticoLevel[]>(DEFAULT_DIAGNOSTICO_LEVELS);

  function updateDiagQuestion(i: number, patch: Partial<DiagnosticoQuestion>) {
    setDiagQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function updateDiagOption(qi: number, oi: number, text: string) {
    setDiagQuestions((qs) =>
      qs.map((q, idx) => (idx === qi ? { ...q, options: q.options.map((o, oidx) => (oidx === oi ? { ...o, t: text } : o)) } : q)),
    );
  }
  function addDiagQuestion() {
    setDiagQuestions((qs) => [
      ...qs,
      { text: "", area: "", options: [{ t: "", w: 0 }, { t: "", w: 1 }, { t: "", w: 2 }, { t: "", w: 3 }] },
    ]);
  }
  function removeDiagQuestion(i: number) {
    setDiagQuestions((qs) => qs.filter((_, idx) => idx !== i));
  }
  function updateDiagLevel(i: number, patch: Partial<DiagnosticoLevel>) {
    setDiagLevels((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  // Paso 2 (Diagnóstico Financiero - Retiro) — portada/textos/producto/referido
  const [retiroNombre, setRetiroNombre] = useState("");
  const [retiroMarca, setRetiroMarca] = useState(DEFAULT_DIAGNOSTICO_RETIRO_ASESOR.marca);
  const [retiroLema, setRetiroLema] = useState(DEFAULT_DIAGNOSTICO_RETIRO_ASESOR.lema);
  const [retiroWhatsapp, setRetiroWhatsapp] = useState(DEFAULT_DIAGNOSTICO_RETIRO_ASESOR.whatsapp);
  const [retiroWebhookUrl, setRetiroWebhookUrl] = useState(DEFAULT_DIAGNOSTICO_RETIRO_ASESOR.webhookUrl);
  const [retiroHeroPregunta, setRetiroHeroPregunta] = useState(DEFAULT_DIAGNOSTICO_RETIRO_TEXTOS.heroPregunta);
  const [retiroHeroSub, setRetiroHeroSub] = useState(DEFAULT_DIAGNOSTICO_RETIRO_TEXTOS.heroSub);
  const [retiroDisclaimer, setRetiroDisclaimer] = useState(DEFAULT_DIAGNOSTICO_RETIRO_TEXTOS.disclaimer);
  const [retiroConsentLabel, setRetiroConsentLabel] = useState(DEFAULT_DIAGNOSTICO_RETIRO_TEXTOS.consentLabel);
  const [retiroProductoNombre, setRetiroProductoNombre] = useState(DEFAULT_DIAGNOSTICO_RETIRO_PRODUCTO.nombre);
  const [retiroAseguradora, setRetiroAseguradora] = useState(DEFAULT_DIAGNOSTICO_RETIRO_PRODUCTO.aseguradora);
  const [retiroTopeDeducible, setRetiroTopeDeducible] = useState(DEFAULT_DIAGNOSTICO_RETIRO_PRODUCTO.topeDeducible);
  const [retiroPrefijoCodigo, setRetiroPrefijoCodigo] = useState(DEFAULT_DIAGNOSTICO_RETIRO_REFERIDO.prefijoCodigo);

  // Paso 3 (Diagnóstico Financiero - Retiro) — arranca con el dataset
  // original completo (diagnosticoRetiroDefaults.ts). A diferencia del otro
  // Diagnóstico, acá los puntajes por opción SÍ son editables (ver el
  // comentario de computeAreaMax): cada opción puntúa en 1+ de las 4 áreas
  // fijas a la vez, y el máximo por área se recalcula solo.
  const [retiroAreaLabels, setRetiroAreaLabels] = useState<Record<DiagnosticoRetiroArea, string>>(DEFAULT_DIAGNOSTICO_RETIRO_AREA_LABELS);
  const [retiroQuestions, setRetiroQuestions] = useState<DiagnosticoRetiroQuestion[]>(DEFAULT_DIAGNOSTICO_RETIRO_QUESTIONS);
  const [retiroUmbral1, setRetiroUmbral1] = useState(DEFAULT_DIAGNOSTICO_RETIRO_UMBRAL_1);
  const [retiroUmbral2, setRetiroUmbral2] = useState(DEFAULT_DIAGNOSTICO_RETIRO_UMBRAL_2);
  const [retiroPerfiles, setRetiroPerfiles] = useState<DiagnosticoRetiroPerfil[]>(DEFAULT_DIAGNOSTICO_RETIRO_PERFILES);
  const [retiroRecoPool, setRetiroRecoPool] = useState<DiagnosticoRetiroRecoPool>(DEFAULT_DIAGNOSTICO_RETIRO_RECO_POOL);
  const [retiroThemePool, setRetiroThemePool] = useState<DiagnosticoRetiroThemePool>(DEFAULT_DIAGNOSTICO_RETIRO_THEME_POOL);

  function updateRetiroAreaLabel(area: DiagnosticoRetiroArea, value: string) {
    setRetiroAreaLabels((labels) => ({ ...labels, [area]: value }));
  }
  function updateRetiroQuestionText(i: number, text: string) {
    setRetiroQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, text } : q)));
  }
  function updateRetiroOption(qi: number, oi: number, patch: Partial<DiagnosticoRetiroOption>) {
    setRetiroQuestions((qs) =>
      qs.map((q, idx) => (idx === qi ? { ...q, options: q.options.map((o, oidx) => (oidx === oi ? { ...o, ...patch } : o)) } : q)),
    );
  }
  function updateRetiroOptionPoints(qi: number, oi: number, area: DiagnosticoRetiroArea, value: number) {
    setRetiroQuestions((qs) =>
      qs.map((q, idx) =>
        idx === qi
          ? { ...q, options: q.options.map((o, oidx) => (oidx === oi ? { ...o, points: { ...o.points, [area]: value } } : o)) }
          : q,
      ),
    );
  }
  function addRetiroQuestion() {
    setRetiroQuestions((qs) => [...qs, { text: "", options: [emptyRetiroOption(), emptyRetiroOption(), emptyRetiroOption(), emptyRetiroOption()] }]);
  }
  function removeRetiroQuestion(i: number) {
    setRetiroQuestions((qs) => qs.filter((_, idx) => idx !== i));
  }
  function updateRetiroPerfil(i: number, patch: Partial<DiagnosticoRetiroPerfil>) {
    setRetiroPerfiles((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function updateRetiroReco(key: keyof DiagnosticoRetiroRecoPool, value: string) {
    setRetiroRecoPool((pool) => ({ ...pool, [key]: value }));
  }
  function updateRetiroTheme(key: DiagnosticoRetiroThemeKey, value: string) {
    setRetiroThemePool((pool) => ({ ...pool, [key]: value }));
  }

  // Paso 2 (Diagnóstico de Solidez Financiera) — campos de BRAND_CONFIG que
  // el HTML original tenía hardcodeados; "advisorName" se autocompleta al
  // elegir "Agente asignado" igual que en los otros dos Diagnósticos.
  // QUESTIONS/TIERS/DIM_TEXT/THEMES (los 5 tonos de color) quedan fijos —
  // solo se elige cuál de esos 5 tonos usar (Paso 3).
  const [solidezAdvisorName, setSolidezAdvisorName] = useState("");
  const [solidezCompanyName, setSolidezCompanyName] = useState(DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.companyName);
  const [solidezTitle, setSolidezTitle] = useState(DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.title);
  const [solidezBadge, setSolidezBadge] = useState(DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.badge);
  const [solidezPhotoURL, setSolidezPhotoURL] = useState(DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.photoURL);
  const [solidezWhatsapp, setSolidezWhatsapp] = useState(DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.whatsapp);
  const [solidezCalendly, setSolidezCalendly] = useState(DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.calendly);
  const [solidezPrivacyURL, setSolidezPrivacyURL] = useState(DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.privacyURL);
  const [solidezAdvisorID, setSolidezAdvisorID] = useState(DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.advisorID);
  const [solidezWebhookURL, setSolidezWebhookURL] = useState(DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.webhookURL);
  const [solidezWaGreeting, setSolidezWaGreeting] = useState(DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.waGreeting);
  const [solidezTheme, setSolidezTheme] = useState<DiagnosticoSolidezTheme>("brass");

  const [metaUniAdvisorName, setMetaUniAdvisorName] = useState(DEFAULT_META_UNIVERSITARIA_BRAND.advisorName);
  const [metaUniTitle, setMetaUniTitle] = useState(DEFAULT_META_UNIVERSITARIA_BRAND.title);
  const [metaUniWhatsapp, setMetaUniWhatsapp] = useState(DEFAULT_META_UNIVERSITARIA_BRAND.whatsapp);
  const [metaUniEmail, setMetaUniEmail] = useState(DEFAULT_META_UNIVERSITARIA_BRAND.email);
  const [metaUniCalendlyURL, setMetaUniCalendlyURL] = useState(DEFAULT_META_UNIVERSITARIA_BRAND.calendlyURL);
  const [metaUniWebhookURL, setMetaUniWebhookURL] = useState(DEFAULT_META_UNIVERSITARIA_BRAND.webhookURL);
  const [metaUniAvisoPrivacidadURL, setMetaUniAvisoPrivacidadURL] = useState(DEFAULT_META_UNIVERSITARIA_BRAND.avisoPrivacidadURL);

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
      let config:
        | MiniAppFieldConfig
        | CalculadoraBrechaConfig
        | DiagnosticoFinancieroConfig
        | DiagnosticoRetiroConfig
        | DiagnosticoSolidezConfig
        | MetaUniversitariaConfig;
      if (templateKey === "calculadora_brecha_retiro") {
        config = { whatsappAsesor, avisoPrivacidadUrl, licenseBadge };
      } else if (templateKey === "diagnostico_financiero") {
        config = {
          agente: {
            nombre: diagNombre,
            marca: diagMarca,
            rol: diagRol,
            badge: diagBadge,
            titulo: diagTitulo,
            subtitulo: diagSubtitulo,
            whatsapp: diagWhatsapp,
            ctaUrl: diagCtaUrl,
            webhookUrl: diagWebhookUrl,
            time: DEFAULT_DIAGNOSTICO_AGENTE.time,
          },
          questions: diagQuestions,
          levels: diagLevels,
        };
      } else if (templateKey === "diagnostico_financiero_retiro") {
        config = {
          asesor: { nombre: retiroNombre, marca: retiroMarca, lema: retiroLema, whatsapp: retiroWhatsapp, webhookUrl: retiroWebhookUrl },
          referido: { prefijoCodigo: retiroPrefijoCodigo },
          producto: { nombre: retiroProductoNombre, aseguradora: retiroAseguradora, topeDeducible: retiroTopeDeducible },
          textos: { heroPregunta: retiroHeroPregunta, heroSub: retiroHeroSub, disclaimer: retiroDisclaimer, consentLabel: retiroConsentLabel },
          areaLabels: retiroAreaLabels,
          questions: retiroQuestions,
          umbral1: retiroUmbral1,
          umbral2: retiroUmbral2,
          perfiles: retiroPerfiles,
          recoPool: retiroRecoPool,
          themePool: retiroThemePool,
        };
      } else if (templateKey === "diagnostico_solidez_financiera") {
        config = {
          brand: {
            advisorName: solidezAdvisorName,
            companyName: solidezCompanyName,
            title: solidezTitle,
            badge: solidezBadge,
            photoURL: solidezPhotoURL,
            logoURL: DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.logoURL,
            whatsapp: solidezWhatsapp,
            calendly: solidezCalendly,
            privacyURL: solidezPrivacyURL,
            advisorID: solidezAdvisorID,
            webhookURL: solidezWebhookURL,
            waGreeting: solidezWaGreeting,
          },
          themeActive: solidezTheme,
        };
      } else if (templateKey === "calculadora_meta_universitaria") {
        config = {
          brand: {
            advisorName: metaUniAdvisorName,
            title: metaUniTitle,
            whatsapp: metaUniWhatsapp,
            email: metaUniEmail,
            photoURL: DEFAULT_META_UNIVERSITARIA_BRAND.photoURL,
            logoURL: DEFAULT_META_UNIVERSITARIA_BRAND.logoURL,
            calendlyURL: metaUniCalendlyURL,
            webhookURL: metaUniWebhookURL,
            avisoPrivacidadURL: metaUniAvisoPrivacidadURL,
            colorMarca: DEFAULT_META_UNIVERSITARIA_BRAND.colorMarca,
            monedaDefault: DEFAULT_META_UNIVERSITARIA_BRAND.monedaDefault,
            inflacionEducativaDefault: DEFAULT_META_UNIVERSITARIA_BRAND.inflacionEducativaDefault,
            rendimientoAnualDefault: DEFAULT_META_UNIVERSITARIA_BRAND.rendimientoAnualDefault,
          },
        };
      } else {
        config = {
          annualReturnRatePct,
          showIngresoActual,
          fieldLabels: { edad: labelEdad, edadRetiro: labelEdadRetiro, ahorroMensual: labelAhorroMensual, ingresoActual: labelIngresoActual },
        };
      }
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
              <button
                key={t.key}
                type="button"
                disabled={!t.available}
                onClick={() => t.available && setTemplateKey(t.key as MiniAppTemplateKey)}
                className={`rounded-lg border p-4 text-left text-sm ${
                  !t.available
                    ? "border-border-default text-neutral-400"
                    : templateKey === t.key
                      ? "border-accent-500 bg-accent-50 font-medium text-accent-700"
                      : "border-border-default hover:border-accent-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Simulador de Retiro — Diego Tinoco" />
            <Input label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Select
              label="Agente asignado"
              value={assignedAgentId}
              onChange={(e) => {
                setAssignedAgentId(e.target.value);
                // Autocompleta el "nombre a mostrar" del Diagnóstico al elegir
                // agente — solo si el usuario todavía no lo escribió a mano.
                if (templateKey === "diagnostico_financiero" && !diagNombre.trim()) {
                  const m = members.find((x) => x.memberId === e.target.value);
                  if (m) setDiagNombre(m.fullName);
                }
                if (templateKey === "diagnostico_financiero_retiro" && !retiroNombre.trim()) {
                  const m = members.find((x) => x.memberId === e.target.value);
                  if (m) setRetiroNombre(m.fullName);
                }
                if (templateKey === "diagnostico_solidez_financiera" && !solidezAdvisorName.trim()) {
                  const m = members.find((x) => x.memberId === e.target.value);
                  if (m) setSolidezAdvisorName(m.fullName);
                }
                if (templateKey === "calculadora_meta_universitaria" && !metaUniAdvisorName.trim()) {
                  const m = members.find((x) => x.memberId === e.target.value);
                  if (m) setMetaUniAdvisorName(m.fullName);
                }
              }}
            >
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

            {templateKey === "diagnostico_financiero" && (
              <div className="flex flex-col gap-4">
                <div className="my-1 h-px bg-border-default" />
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Portada del Diagnóstico</p>
                <Input label="Nombre a mostrar" value={diagNombre} onChange={(e) => setDiagNombre(e.target.value)} placeholder="Ej. Elvira Sánchez" />
                <Input label="Marca (opcional)" value={diagMarca} onChange={(e) => setDiagMarca(e.target.value)} placeholder="Ej. Patrimonio Seguro" />
                <Input label="Rol / subtítulo del agente" value={diagRol} onChange={(e) => setDiagRol(e.target.value)} />
                <Input label="Etiqueta superior (badge)" value={diagBadge} onChange={(e) => setDiagBadge(e.target.value)} />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Título (hook)</label>
                  <textarea
                    value={diagTitulo}
                    onChange={(e) => setDiagTitulo(e.target.value)}
                    rows={2}
                    className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Subtítulo</label>
                  <textarea
                    value={diagSubtitulo}
                    onChange={(e) => setDiagSubtitulo(e.target.value)}
                    rows={2}
                    className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
                  />
                </div>
                <Input
                  label="WhatsApp (solo dígitos, con código de país — vacío oculta el botón)"
                  value={diagWhatsapp}
                  onChange={(e) => setDiagWhatsapp(e.target.value)}
                  placeholder="5215500000000"
                />
                <Input label="URL de agenda (Calendly u otro)" value={diagCtaUrl} onChange={(e) => setDiagCtaUrl(e.target.value)} placeholder="https://calendly.com/tu-agenda" />
                <Input label="Webhook opcional (copia del lead)" value={diagWebhookUrl} onChange={(e) => setDiagWebhookUrl(e.target.value)} placeholder="https://..." />
              </div>
            )}

            {templateKey === "diagnostico_financiero_retiro" && (
              <div className="flex flex-col gap-4">
                <div className="my-1 h-px bg-border-default" />
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Portada del Diagnóstico</p>
                <Input label="Nombre a mostrar" value={retiroNombre} onChange={(e) => setRetiroNombre(e.target.value)} placeholder="Ej. Josué Hernández" />
                <Input label="Marca (opcional)" value={retiroMarca} onChange={(e) => setRetiroMarca(e.target.value)} placeholder="Ej. HC Patrimoniales" />
                <Input label="Lema" value={retiroLema} onChange={(e) => setRetiroLema(e.target.value)} />
                <Input
                  label="WhatsApp (solo dígitos, con código de país)"
                  value={retiroWhatsapp}
                  onChange={(e) => setRetiroWhatsapp(e.target.value)}
                  placeholder="5215500000000"
                />
                <Input label="Webhook opcional (copia del lead)" value={retiroWebhookUrl} onChange={(e) => setRetiroWebhookUrl(e.target.value)} placeholder="https://..." />

                <div className="my-1 h-px bg-border-default" />
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Textos</p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Pregunta principal (hero)</label>
                  <textarea
                    value={retiroHeroPregunta}
                    onChange={(e) => setRetiroHeroPregunta(e.target.value)}
                    rows={2}
                    className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Subtítulo</label>
                  <textarea
                    value={retiroHeroSub}
                    onChange={(e) => setRetiroHeroSub(e.target.value)}
                    rows={2}
                    className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
                  />
                </div>
                <Input label="Disclaimer" value={retiroDisclaimer} onChange={(e) => setRetiroDisclaimer(e.target.value)} />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Texto legal (consentimiento LFPDPPP)</label>
                  <textarea
                    value={retiroConsentLabel}
                    onChange={(e) => setRetiroConsentLabel(e.target.value)}
                    rows={2}
                    className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
                  />
                </div>

                <div className="my-1 h-px bg-border-default" />
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Producto y referidos</p>
                <Input label="Producto (opcional)" value={retiroProductoNombre} onChange={(e) => setRetiroProductoNombre(e.target.value)} placeholder="Ej. PPR OptiMaxx Plus" />
                <Input label="Aseguradora (opcional)" value={retiroAseguradora} onChange={(e) => setRetiroAseguradora(e.target.value)} placeholder="Ej. Allianz" />
                <Input
                  label="Tope deducible (opcional)"
                  value={retiroTopeDeducible}
                  onChange={(e) => setRetiroTopeDeducible(e.target.value)}
                  placeholder="Ej. $172,800 MXN"
                />
                <Input label="Prefijo del código de referido" value={retiroPrefijoCodigo} onChange={(e) => setRetiroPrefijoCodigo(e.target.value)} placeholder="Ej. HC" />
              </div>
            )}

            {templateKey === "diagnostico_solidez_financiera" && (
              <div className="flex flex-col gap-4">
                <div className="my-1 h-px bg-border-default" />
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Identidad del asesor</p>
                <Input label="Nombre a mostrar" value={solidezAdvisorName} onChange={(e) => setSolidezAdvisorName(e.target.value)} placeholder="Ej. Patricio Jaik" />
                <Input label="Despacho / empresa (opcional)" value={solidezCompanyName} onChange={(e) => setSolidezCompanyName(e.target.value)} />
                <Input label="Título / rol" value={solidezTitle} onChange={(e) => setSolidezTitle(e.target.value)} />
                <Input label="Etiqueta superior (badge, opcional)" value={solidezBadge} onChange={(e) => setSolidezBadge(e.target.value)} />
                <Input label="Foto/logo (URL, opcional)" value={solidezPhotoURL} onChange={(e) => setSolidezPhotoURL(e.target.value)} placeholder="https://..." />
                <Input
                  label="WhatsApp (solo dígitos, con código de país)"
                  value={solidezWhatsapp}
                  onChange={(e) => setSolidezWhatsapp(e.target.value)}
                  placeholder="5215500000000"
                />
                <Input label="URL de agenda (Calendly u otro)" value={solidezCalendly} onChange={(e) => setSolidezCalendly(e.target.value)} placeholder="https://calendly.com/tu-agenda" />
                <Input label="URL del Aviso de Privacidad" value={solidezPrivacyURL} onChange={(e) => setSolidezPrivacyURL(e.target.value)} placeholder="https://..." />
                <Input label="ID interno del asesor (opcional)" value={solidezAdvisorID} onChange={(e) => setSolidezAdvisorID(e.target.value)} />
                <Input
                  label="Webhook externo opcional (copia del lead a tu propia herramienta)"
                  value={solidezWebhookURL}
                  onChange={(e) => setSolidezWebhookURL(e.target.value)}
                  placeholder="https://..."
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Mensaje de WhatsApp sugerido</label>
                  <textarea
                    value={solidezWaGreeting}
                    onChange={(e) => setSolidezWaGreeting(e.target.value)}
                    rows={2}
                    className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
                  />
                </div>
              </div>
            )}

            {templateKey === "calculadora_meta_universitaria" && (
              <div className="flex flex-col gap-4">
                <div className="my-1 h-px bg-border-default" />
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Identidad del asesor</p>
                <Input label="Nombre a mostrar" value={metaUniAdvisorName} onChange={(e) => setMetaUniAdvisorName(e.target.value)} placeholder="Ej. Patricio Jaik" />
                <Input label="Título / rol" value={metaUniTitle} onChange={(e) => setMetaUniTitle(e.target.value)} />
                <Input
                  label="WhatsApp (solo dígitos, con código de país)"
                  value={metaUniWhatsapp}
                  onChange={(e) => setMetaUniWhatsapp(e.target.value)}
                  placeholder="5215500000000"
                />
                <Input label="Correo (opcional)" value={metaUniEmail} onChange={(e) => setMetaUniEmail(e.target.value)} placeholder="tu@correo.com" />
                <Input label="URL de agenda (Calendly u otro)" value={metaUniCalendlyURL} onChange={(e) => setMetaUniCalendlyURL(e.target.value)} placeholder="https://calendly.com/tu-agenda" />
                <Input label="URL del Aviso de Privacidad" value={metaUniAvisoPrivacidadURL} onChange={(e) => setMetaUniAvisoPrivacidadURL(e.target.value)} placeholder="https://..." />
                <Input
                  label="Webhook externo opcional (copia del lead a tu propia herramienta)"
                  value={metaUniWebhookURL}
                  onChange={(e) => setMetaUniWebhookURL(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}

            {/* Solo estos dos colores — el resto del sistema visual de la
             * página pública se genera solo (paletteEngine.ts), con
             * contraste WCAG verificado automáticamente. No aplica a los
             * Diagnósticos: tienen su propio CSS autocontenido, sin ningún
             * efecto de estos selectores. */}
            {templateKey !== "diagnostico_financiero" &&
              templateKey !== "diagnostico_financiero_retiro" &&
              templateKey !== "diagnostico_solidez_financiera" &&
              templateKey !== "calculadora_meta_universitaria" && (
            <>
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
            </>
            )}

            <Input
              label="URL donde vive la mini app (opcional)"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://simulador-retiro.ejemplo.com"
            />
          </div>
        )}

        {step === 2 && templateKey === "simulador_retiro" && (
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

        {step === 2 && templateKey === "calculadora_brecha_retiro" && (
          <div className="flex flex-col gap-4">
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

        {step === 2 && templateKey === "diagnostico_financiero" && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Preguntas ({diagQuestions.length})</p>
              <Button type="button" variant="secondary" size="sm" onClick={addDiagQuestion}>
                + Agregar pregunta
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              {diagQuestions.map((q, qi) => (
                <div key={qi} className="flex flex-col gap-2.5 rounded-md border border-border-default bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="mt-2 shrink-0 text-xs font-semibold text-neutral-400">#{qi + 1}</span>
                    <div className="flex flex-1 flex-col gap-2">
                      <Input label="Pregunta" value={q.text} onChange={(e) => updateDiagQuestion(qi, { text: e.target.value })} />
                      <Input label="Área (agrupa el desglose final)" value={q.area} onChange={(e) => updateDiagQuestion(qi, { area: e.target.value })} />
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={() => removeDiagQuestion(qi)} disabled={diagQuestions.length <= 1}>
                      Quitar
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {q.options.map((o, oi) => (
                      <Input
                        key={oi}
                        label={`Opción ${"ABCD"[oi]}`}
                        value={o.t}
                        onChange={(e) => updateDiagOption(qi, oi, e.target.value)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="my-1 h-px bg-border-default" />
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Niveles de resultado</p>
            <div className="flex flex-col gap-3">
              {diagLevels.map((lv, li) => (
                <div key={li} className="flex flex-col gap-2.5 rounded-md border border-border-default bg-surface-2 p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Input label="Nombre" value={lv.name} onChange={(e) => updateDiagLevel(li, { name: e.target.value })} />
                    <Input label="Desde %" type="number" min={0} max={100} value={String(lv.min)} onChange={(e) => updateDiagLevel(li, { min: Number(e.target.value) })} />
                    <Input label="Hasta %" type="number" min={0} max={100} value={String(lv.max)} onChange={(e) => updateDiagLevel(li, { max: Number(e.target.value) })} />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">Color</label>
                      <input type="color" value={lv.color} onChange={(e) => updateDiagLevel(li, { color: e.target.value })} className="h-9 w-full rounded-md border border-border-default" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Diagnóstico (texto principal)</label>
                    <textarea
                      value={lv.lead}
                      onChange={(e) => updateDiagLevel(li, { lead: e.target.value })}
                      rows={2}
                      className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Recomendación</label>
                    <textarea
                      value={lv.reco}
                      onChange={(e) => updateDiagLevel(li, { reco: e.target.value })}
                      rows={2}
                      className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && templateKey === "diagnostico_financiero_retiro" && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Preguntas y puntajes ({retiroQuestions.length})</p>
              <Button type="button" variant="secondary" size="sm" onClick={addRetiroQuestion}>
                + Agregar pregunta
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              {retiroQuestions.map((q, qi) => (
                <div key={qi} className="flex flex-col gap-2.5 rounded-md border border-border-default bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="mt-2 shrink-0 text-xs font-semibold text-neutral-400">#{qi + 1}</span>
                    <Input label="Pregunta" value={q.text} onChange={(e) => updateRetiroQuestionText(qi, e.target.value)} containerClassName="flex-1" />
                    <Button type="button" variant="secondary" size="sm" onClick={() => removeRetiroQuestion(qi)} disabled={retiroQuestions.length <= 1}>
                      Quitar
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {q.options.map((o, oi) => (
                      <div key={oi} className="flex flex-col gap-1.5 rounded-md border border-border-default bg-surface-1 p-2.5">
                        <Input label={`Opción ${"ABCD"[oi]}`} value={o.label} onChange={(e) => updateRetiroOption(qi, oi, { label: e.target.value })} />
                        <div className="grid grid-cols-4 gap-1.5">
                          {DIAGNOSTICO_RETIRO_AREAS.map((area) => (
                            <Input
                              key={area}
                              label={retiroAreaLabels[area]}
                              type="number"
                              value={String(o.points[area])}
                              onChange={(e) => updateRetiroOptionPoints(qi, oi, area, Number(e.target.value) || 0)}
                            />
                          ))}
                        </div>
                        <Input
                          label="Tema (solo para la pregunta de objetivo)"
                          value={o.theme}
                          onChange={(e) => updateRetiroOption(qi, oi, { theme: e.target.value })}
                          placeholder="mantener / patrimonio / fiscal / liquidez"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="my-1 h-px bg-border-default" />
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Etiquetas de las áreas</p>
            <div className="grid grid-cols-2 gap-3">
              {DIAGNOSTICO_RETIRO_AREAS.map((area) => (
                <Input key={area} label={area} value={retiroAreaLabels[area]} onChange={(e) => updateRetiroAreaLabel(area, e.target.value)} />
              ))}
            </div>

            <div className="my-1 h-px bg-border-default" />
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Perfil de resultado</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Umbral 1 (bajo el cual es el primer perfil)"
                type="number"
                min={0}
                max={100}
                value={String(retiroUmbral1)}
                onChange={(e) => setRetiroUmbral1(Number(e.target.value) || 0)}
              />
              <Input
                label="Umbral 2 (bajo el cual es el segundo perfil)"
                type="number"
                min={0}
                max={100}
                value={String(retiroUmbral2)}
                onChange={(e) => setRetiroUmbral2(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex flex-col gap-3">
              {retiroPerfiles.map((p, pi) => (
                <div key={pi} className="flex flex-col gap-2.5 rounded-md border border-border-default bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-neutral-400">
                    {pi === 0 ? `Score < ${retiroUmbral1}` : pi === 1 ? `${retiroUmbral1} ≤ Score < ${retiroUmbral2}` : `Score ≥ ${retiroUmbral2}`}
                  </p>
                  <Input label="Nombre del perfil" value={p.name} onChange={(e) => updateRetiroPerfil(pi, { name: e.target.value })} />
                  <Input label="Titular" value={p.headline} onChange={(e) => updateRetiroPerfil(pi, { headline: e.target.value })} />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Descripción</label>
                    <textarea
                      value={p.desc}
                      onChange={(e) => updateRetiroPerfil(pi, { desc: e.target.value })}
                      rows={2}
                      className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="my-1 h-px bg-border-default" />
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Recomendaciones por área</p>
            <div className="flex flex-col gap-3">
              {DIAGNOSTICO_RETIRO_AREAS.map((area) => (
                <div key={area} className="flex flex-col gap-2 rounded-md border border-border-default bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-neutral-400">{retiroAreaLabels[area]}</p>
                  {RETIRO_TIERS.map((t) => {
                    const key = `${area}_${t}` as keyof DiagnosticoRetiroRecoPool;
                    return (
                      <div key={t} className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">{RETIRO_TIER_LABELS[t]}</label>
                        <textarea
                          value={retiroRecoPool[key]}
                          onChange={(e) => updateRetiroReco(key, e.target.value)}
                          rows={2}
                          className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="my-1 h-px bg-border-default" />
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Mensajes por objetivo (pregunta de tema)</p>
            <div className="flex flex-col gap-2.5">
              {DIAGNOSTICO_RETIRO_THEME_KEYS.map((key) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{key}</label>
                  <textarea
                    value={retiroThemePool[key]}
                    onChange={(e) => updateRetiroTheme(key, e.target.value)}
                    rows={2}
                    className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && templateKey === "diagnostico_solidez_financiera" && (
          <div className="flex flex-col gap-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Paleta de color</p>
            <p className="text-sm text-neutral-500">
              El diseño, las preguntas y la lógica de puntaje son fijos — lo único que elegís acá es cuál de estos 5 tonos usar.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {DIAGNOSTICO_SOLIDEZ_THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSolidezTheme(opt.key)}
                  className={`flex flex-col items-center gap-1.5 rounded-md border p-2.5 text-xs font-medium transition-colors ${
                    solidezTheme === opt.key ? "border-accent-500 bg-accent-50" : "border-border-default hover:border-border-strong"
                  }`}
                >
                  <span className="size-6 rounded-full border border-black/10" style={{ backgroundColor: opt.swatch }} />
                  {opt.label}
                </button>
              ))}
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

        {step === 2 && templateKey === "calculadora_meta_universitaria" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-500">
              El diseño y la fórmula de proyección son fijos — la persona que usa la calculadora completa la edad, la universidad, la duración de la carrera y sus propios supuestos de inflación y
              ahorro actual.
            </p>
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
            {templateKey === "simulador_retiro" && <p className="text-neutral-500">Tasa de rendimiento: {annualReturnRatePct}%</p>}
            {templateKey === "diagnostico_financiero" && (
              <p className="text-neutral-500">
                {diagQuestions.length} preguntas · {diagLevels.length} niveles de resultado
              </p>
            )}
            {templateKey === "diagnostico_financiero_retiro" && (
              <p className="text-neutral-500">
                {retiroQuestions.length} preguntas · {retiroPerfiles.length} perfiles de resultado
              </p>
            )}
            {templateKey === "diagnostico_solidez_financiera" && (
              <p className="text-neutral-500">
                {solidezAdvisorName || "(sin nombre de asesor)"} · paleta {DIAGNOSTICO_SOLIDEZ_THEME_OPTIONS.find((o) => o.key === solidezTheme)?.label}
              </p>
            )}
            {templateKey === "calculadora_meta_universitaria" && <p className="text-neutral-500">{metaUniAdvisorName || "(sin nombre de asesor)"}</p>}
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
