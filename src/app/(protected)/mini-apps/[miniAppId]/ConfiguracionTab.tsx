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
} from "@/lib/miniApps/diagnosticoRetiroDefaults";
import { DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND, DIAGNOSTICO_SOLIDEZ_THEME_OPTIONS, type DiagnosticoSolidezTheme } from "@/lib/miniApps/diagnosticoSolidezDefaults";
import { DEFAULT_META_UNIVERSITARIA_BRAND } from "@/lib/miniApps/metaUniversitariaDefaults";
import { DEFAULT_KIT_EMERGENCIA_BRAND } from "@/lib/miniApps/kitEmergenciaDefaults";
import { DEFAULT_TEST_EMERGENCIA_BRAND } from "@/lib/miniApps/testEmergenciaDefaults";
import { BundleDropzone } from "../BundleDropzone";
import { BundlePreviewModal } from "../BundlePreviewModal";

const RETIRO_TIERS = ["low", "mid", "high"] as const;
const RETIRO_TIER_LABELS: Record<(typeof RETIRO_TIERS)[number], string> = { low: "Puntaje bajo", mid: "Puntaje medio", high: "Puntaje alto" };

function emptyRetiroOption(): DiagnosticoRetiroOption {
  return { label: "", points: { retiro: 0, ahorro: 0, fiscal: 0, proteccion: 0 }, theme: "" };
}

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
  const isDiagnostico = miniApp.templateKey === "diagnostico_financiero";
  const isRetiro = miniApp.templateKey === "diagnostico_financiero_retiro";
  const isSolidez = miniApp.templateKey === "diagnostico_solidez_financiera";
  const isMetaUniversitaria = miniApp.templateKey === "calculadora_meta_universitaria";
  const isKitEmergencia = miniApp.templateKey === "kit_emergencia_financiera_familiar";
  const isTestEmergencia = miniApp.templateKey === "test_preparacion_emergencia_financiera";
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

  const [diagNombre, setDiagNombre] = useState(isDiagnostico ? miniApp.config.agente.nombre : "");
  const [diagMarca, setDiagMarca] = useState(isDiagnostico ? miniApp.config.agente.marca : DEFAULT_DIAGNOSTICO_AGENTE.marca);
  const [diagRol, setDiagRol] = useState(isDiagnostico ? miniApp.config.agente.rol : DEFAULT_DIAGNOSTICO_AGENTE.rol);
  const [diagBadge, setDiagBadge] = useState(isDiagnostico ? miniApp.config.agente.badge : DEFAULT_DIAGNOSTICO_AGENTE.badge);
  const [diagTitulo, setDiagTitulo] = useState(isDiagnostico ? miniApp.config.agente.titulo : DEFAULT_DIAGNOSTICO_AGENTE.titulo);
  const [diagSubtitulo, setDiagSubtitulo] = useState(isDiagnostico ? miniApp.config.agente.subtitulo : DEFAULT_DIAGNOSTICO_AGENTE.subtitulo);
  const [diagWhatsapp, setDiagWhatsapp] = useState(isDiagnostico ? miniApp.config.agente.whatsapp : DEFAULT_DIAGNOSTICO_AGENTE.whatsapp);
  const [diagCtaUrl, setDiagCtaUrl] = useState(isDiagnostico ? miniApp.config.agente.ctaUrl : DEFAULT_DIAGNOSTICO_AGENTE.ctaUrl);
  const [diagWebhookUrl, setDiagWebhookUrl] = useState(isDiagnostico ? miniApp.config.agente.webhookUrl : DEFAULT_DIAGNOSTICO_AGENTE.webhookUrl);
  const [diagQuestions, setDiagQuestions] = useState<DiagnosticoQuestion[]>(isDiagnostico ? miniApp.config.questions : DEFAULT_DIAGNOSTICO_QUESTIONS);
  const [diagLevels, setDiagLevels] = useState<DiagnosticoLevel[]>(isDiagnostico ? miniApp.config.levels : DEFAULT_DIAGNOSTICO_LEVELS);

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

  const [retiroNombre, setRetiroNombre] = useState(isRetiro ? miniApp.config.asesor.nombre : "");
  const [retiroMarca, setRetiroMarca] = useState(isRetiro ? miniApp.config.asesor.marca : DEFAULT_DIAGNOSTICO_RETIRO_ASESOR.marca);
  const [retiroLema, setRetiroLema] = useState(isRetiro ? miniApp.config.asesor.lema : DEFAULT_DIAGNOSTICO_RETIRO_ASESOR.lema);
  const [retiroWhatsapp, setRetiroWhatsapp] = useState(isRetiro ? miniApp.config.asesor.whatsapp : DEFAULT_DIAGNOSTICO_RETIRO_ASESOR.whatsapp);
  const [retiroWebhookUrl, setRetiroWebhookUrl] = useState(isRetiro ? miniApp.config.asesor.webhookUrl : DEFAULT_DIAGNOSTICO_RETIRO_ASESOR.webhookUrl);
  const [retiroHeroPregunta, setRetiroHeroPregunta] = useState(isRetiro ? miniApp.config.textos.heroPregunta : DEFAULT_DIAGNOSTICO_RETIRO_TEXTOS.heroPregunta);
  const [retiroHeroSub, setRetiroHeroSub] = useState(isRetiro ? miniApp.config.textos.heroSub : DEFAULT_DIAGNOSTICO_RETIRO_TEXTOS.heroSub);
  const [retiroDisclaimer, setRetiroDisclaimer] = useState(isRetiro ? miniApp.config.textos.disclaimer : DEFAULT_DIAGNOSTICO_RETIRO_TEXTOS.disclaimer);
  const [retiroConsentLabel, setRetiroConsentLabel] = useState(isRetiro ? miniApp.config.textos.consentLabel : DEFAULT_DIAGNOSTICO_RETIRO_TEXTOS.consentLabel);
  const [retiroProductoNombre, setRetiroProductoNombre] = useState(isRetiro ? miniApp.config.producto.nombre : DEFAULT_DIAGNOSTICO_RETIRO_PRODUCTO.nombre);
  const [retiroAseguradora, setRetiroAseguradora] = useState(isRetiro ? miniApp.config.producto.aseguradora : DEFAULT_DIAGNOSTICO_RETIRO_PRODUCTO.aseguradora);
  const [retiroTopeDeducible, setRetiroTopeDeducible] = useState(isRetiro ? miniApp.config.producto.topeDeducible : DEFAULT_DIAGNOSTICO_RETIRO_PRODUCTO.topeDeducible);
  const [retiroPrefijoCodigo, setRetiroPrefijoCodigo] = useState(isRetiro ? miniApp.config.referido.prefijoCodigo : DEFAULT_DIAGNOSTICO_RETIRO_REFERIDO.prefijoCodigo);
  const [retiroAreaLabels, setRetiroAreaLabels] = useState<Record<DiagnosticoRetiroArea, string>>(
    isRetiro ? miniApp.config.areaLabels : DEFAULT_DIAGNOSTICO_RETIRO_AREA_LABELS,
  );
  const [retiroQuestions, setRetiroQuestions] = useState<DiagnosticoRetiroQuestion[]>(
    isRetiro ? miniApp.config.questions : DEFAULT_DIAGNOSTICO_RETIRO_QUESTIONS,
  );
  const [retiroUmbral1, setRetiroUmbral1] = useState(isRetiro ? miniApp.config.umbral1 : DEFAULT_DIAGNOSTICO_RETIRO_UMBRAL_1);
  const [retiroUmbral2, setRetiroUmbral2] = useState(isRetiro ? miniApp.config.umbral2 : DEFAULT_DIAGNOSTICO_RETIRO_UMBRAL_2);
  const [retiroPerfiles, setRetiroPerfiles] = useState<DiagnosticoRetiroPerfil[]>(isRetiro ? miniApp.config.perfiles : DEFAULT_DIAGNOSTICO_RETIRO_PERFILES);
  const [retiroRecoPool, setRetiroRecoPool] = useState<DiagnosticoRetiroRecoPool>(isRetiro ? miniApp.config.recoPool : DEFAULT_DIAGNOSTICO_RETIRO_RECO_POOL);
  const [retiroThemePool, setRetiroThemePool] = useState<DiagnosticoRetiroThemePool>(
    isRetiro ? miniApp.config.themePool : DEFAULT_DIAGNOSTICO_RETIRO_THEME_POOL,
  );

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
  function updateRetiroTheme(key: (typeof DIAGNOSTICO_RETIRO_THEME_KEYS)[number], value: string) {
    setRetiroThemePool((pool) => ({ ...pool, [key]: value }));
  }

  const [solidezAdvisorName, setSolidezAdvisorName] = useState(isSolidez ? miniApp.config.brand.advisorName : DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.advisorName);
  const [solidezCompanyName, setSolidezCompanyName] = useState(isSolidez ? miniApp.config.brand.companyName : DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.companyName);
  const [solidezTitle, setSolidezTitle] = useState(isSolidez ? miniApp.config.brand.title : DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.title);
  const [solidezBadge, setSolidezBadge] = useState(isSolidez ? miniApp.config.brand.badge : DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.badge);
  const [solidezPhotoURL, setSolidezPhotoURL] = useState(isSolidez ? miniApp.config.brand.photoURL : DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.photoURL);
  const [solidezWhatsapp, setSolidezWhatsapp] = useState(isSolidez ? miniApp.config.brand.whatsapp : DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.whatsapp);
  const [solidezCalendly, setSolidezCalendly] = useState(isSolidez ? miniApp.config.brand.calendly : DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.calendly);
  const [solidezPrivacyURL, setSolidezPrivacyURL] = useState(isSolidez ? miniApp.config.brand.privacyURL : DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.privacyURL);
  const [solidezAdvisorID, setSolidezAdvisorID] = useState(isSolidez ? miniApp.config.brand.advisorID : DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.advisorID);
  const [solidezWebhookURL, setSolidezWebhookURL] = useState(isSolidez ? miniApp.config.brand.webhookURL : DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.webhookURL);
  const [solidezWaGreeting, setSolidezWaGreeting] = useState(isSolidez ? miniApp.config.brand.waGreeting : DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND.waGreeting);
  const [solidezTheme, setSolidezTheme] = useState<DiagnosticoSolidezTheme>(isSolidez ? miniApp.config.themeActive : "brass");

  const [metaUniAdvisorName, setMetaUniAdvisorName] = useState(isMetaUniversitaria ? miniApp.config.brand.advisorName : DEFAULT_META_UNIVERSITARIA_BRAND.advisorName);
  const [metaUniTitle, setMetaUniTitle] = useState(isMetaUniversitaria ? miniApp.config.brand.title : DEFAULT_META_UNIVERSITARIA_BRAND.title);
  const [metaUniWhatsapp, setMetaUniWhatsapp] = useState(isMetaUniversitaria ? miniApp.config.brand.whatsapp : DEFAULT_META_UNIVERSITARIA_BRAND.whatsapp);
  const [metaUniEmail, setMetaUniEmail] = useState(isMetaUniversitaria ? miniApp.config.brand.email : DEFAULT_META_UNIVERSITARIA_BRAND.email);
  const [metaUniCalendlyURL, setMetaUniCalendlyURL] = useState(isMetaUniversitaria ? miniApp.config.brand.calendlyURL : DEFAULT_META_UNIVERSITARIA_BRAND.calendlyURL);
  const [metaUniWebhookURL, setMetaUniWebhookURL] = useState(isMetaUniversitaria ? miniApp.config.brand.webhookURL : DEFAULT_META_UNIVERSITARIA_BRAND.webhookURL);
  const [metaUniAvisoPrivacidadURL, setMetaUniAvisoPrivacidadURL] = useState(
    isMetaUniversitaria ? miniApp.config.brand.avisoPrivacidadURL : DEFAULT_META_UNIVERSITARIA_BRAND.avisoPrivacidadURL,
  );

  const [kitAdvisorName, setKitAdvisorName] = useState(isKitEmergencia ? miniApp.config.brand.advisorName : DEFAULT_KIT_EMERGENCIA_BRAND.advisorName);
  const [kitTitle, setKitTitle] = useState(isKitEmergencia ? miniApp.config.brand.title : DEFAULT_KIT_EMERGENCIA_BRAND.title);
  const [kitWhatsapp, setKitWhatsapp] = useState(isKitEmergencia ? miniApp.config.brand.whatsapp : DEFAULT_KIT_EMERGENCIA_BRAND.whatsapp);
  const [kitEmail, setKitEmail] = useState(isKitEmergencia ? miniApp.config.brand.email : DEFAULT_KIT_EMERGENCIA_BRAND.email);
  const [kitCalendlyURL, setKitCalendlyURL] = useState(isKitEmergencia ? miniApp.config.brand.calendlyURL : DEFAULT_KIT_EMERGENCIA_BRAND.calendlyURL);
  const [kitPrivacyURL, setKitPrivacyURL] = useState(isKitEmergencia ? miniApp.config.brand.privacyURL : DEFAULT_KIT_EMERGENCIA_BRAND.privacyURL);
  const [kitWebhookURL, setKitWebhookURL] = useState(isKitEmergencia ? miniApp.config.brand.webhookURL : DEFAULT_KIT_EMERGENCIA_BRAND.webhookURL);

  const [testAdvisorName, setTestAdvisorName] = useState(isTestEmergencia ? miniApp.config.brand.advisorName : DEFAULT_TEST_EMERGENCIA_BRAND.advisorName);
  const [testTitle, setTestTitle] = useState(isTestEmergencia ? miniApp.config.brand.title : DEFAULT_TEST_EMERGENCIA_BRAND.title);
  const [testWhatsapp, setTestWhatsapp] = useState(isTestEmergencia ? miniApp.config.brand.whatsapp : DEFAULT_TEST_EMERGENCIA_BRAND.whatsapp);
  const [testEmail, setTestEmail] = useState(isTestEmergencia ? miniApp.config.brand.email : DEFAULT_TEST_EMERGENCIA_BRAND.email);
  const [testCalendlyURL, setTestCalendlyURL] = useState(isTestEmergencia ? miniApp.config.brand.calendlyURL : DEFAULT_TEST_EMERGENCIA_BRAND.calendlyURL);
  const [testPrivacyURL, setTestPrivacyURL] = useState(isTestEmergencia ? miniApp.config.brand.privacyURL : DEFAULT_TEST_EMERGENCIA_BRAND.privacyURL);
  const [testWebhookURL, setTestWebhookURL] = useState(isTestEmergencia ? miniApp.config.brand.webhookURL : DEFAULT_TEST_EMERGENCIA_BRAND.webhookURL);
  const [testKitEmergenciaURL, setTestKitEmergenciaURL] = useState(
    isTestEmergencia ? miniApp.config.brand.kitEmergenciaURL : DEFAULT_TEST_EMERGENCIA_BRAND.kitEmergenciaURL,
  );
  const [testFondoEmergenciaURL, setTestFondoEmergenciaURL] = useState(
    isTestEmergencia ? miniApp.config.brand.fondoEmergenciaURL : DEFAULT_TEST_EMERGENCIA_BRAND.fondoEmergenciaURL,
  );
  const [testSeguroSaludNombre, setTestSeguroSaludNombre] = useState(
    isTestEmergencia ? miniApp.config.brand.seguroSaludNombre : DEFAULT_TEST_EMERGENCIA_BRAND.seguroSaludNombre,
  );

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
              : isDiagnostico
                ? {
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
                  }
                : isRetiro
                  ? {
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
                    }
                  : isSolidez
                    ? {
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
                      }
                    : isMetaUniversitaria
                      ? {
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
                        }
                      : isKitEmergencia
                        ? {
                            brand: {
                              advisorName: kitAdvisorName,
                              title: kitTitle,
                              whatsapp: kitWhatsapp,
                              email: kitEmail,
                              photoURL: DEFAULT_KIT_EMERGENCIA_BRAND.photoURL,
                              logoURL: DEFAULT_KIT_EMERGENCIA_BRAND.logoURL,
                              colorMarca: DEFAULT_KIT_EMERGENCIA_BRAND.colorMarca,
                              calendlyURL: kitCalendlyURL,
                              privacyURL: kitPrivacyURL,
                              webhookURL: kitWebhookURL,
                            },
                          }
                        : isTestEmergencia
                          ? {
                              brand: {
                                advisorName: testAdvisorName,
                                title: testTitle,
                                whatsapp: testWhatsapp,
                                email: testEmail,
                                photoURL: DEFAULT_TEST_EMERGENCIA_BRAND.photoURL,
                                logoURL: DEFAULT_TEST_EMERGENCIA_BRAND.logoURL,
                                colorMarca: DEFAULT_TEST_EMERGENCIA_BRAND.colorMarca,
                                calendlyURL: testCalendlyURL,
                                privacyURL: testPrivacyURL,
                                webhookURL: testWebhookURL,
                                kitEmergenciaURL: testKitEmergenciaURL,
                                fondoEmergenciaURL: testFondoEmergenciaURL,
                                seguroSaludNombre: testSeguroSaludNombre,
                              },
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
           * de diseño más allá de estos dos valores. No aplica a los
           * Diagnósticos: tienen su propio CSS autocontenido. */}
          {!isDiagnostico && !isRetiro && !isSolidez && !isMetaUniversitaria && !isKitEmergencia && !isTestEmergencia && (
          <>
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
          </>
          )}

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
          ) : isDiagnostico ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Portada del Diagnóstico</p>
              <Input label="Nombre a mostrar" value={diagNombre} onChange={(e) => setDiagNombre(e.target.value)} />
              <Input label="Marca (opcional)" value={diagMarca} onChange={(e) => setDiagMarca(e.target.value)} />
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

              <div className="my-1 h-px bg-border-default" />
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
                        <Input key={oi} label={`Opción ${"ABCD"[oi]}`} value={o.t} onChange={(e) => updateDiagOption(qi, oi, e.target.value)} />
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
            </>
          ) : isRetiro ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Portada del Diagnóstico</p>
              <Input label="Nombre a mostrar" value={retiroNombre} onChange={(e) => setRetiroNombre(e.target.value)} />
              <Input label="Marca (opcional)" value={retiroMarca} onChange={(e) => setRetiroMarca(e.target.value)} />
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
              <Input label="Producto (opcional)" value={retiroProductoNombre} onChange={(e) => setRetiroProductoNombre(e.target.value)} />
              <Input label="Aseguradora (opcional)" value={retiroAseguradora} onChange={(e) => setRetiroAseguradora(e.target.value)} />
              <Input label="Tope deducible (opcional)" value={retiroTopeDeducible} onChange={(e) => setRetiroTopeDeducible(e.target.value)} />
              <Input label="Prefijo del código de referido" value={retiroPrefijoCodigo} onChange={(e) => setRetiroPrefijoCodigo(e.target.value)} />

              <div className="my-1 h-px bg-border-default" />
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
                  label="Umbral 1"
                  type="number"
                  min={0}
                  max={100}
                  value={String(retiroUmbral1)}
                  onChange={(e) => setRetiroUmbral1(Number(e.target.value) || 0)}
                />
                <Input
                  label="Umbral 2"
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
            </>
          ) : isSolidez ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Identidad del asesor</p>
              <Input label="Nombre a mostrar" value={solidezAdvisorName} onChange={(e) => setSolidezAdvisorName(e.target.value)} />
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
              <Input label="ID interno del asesor (opcional, para tus propios reportes)" value={solidezAdvisorID} onChange={(e) => setSolidezAdvisorID(e.target.value)} />
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

              <div className="my-1 h-px bg-border-default" />
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Paleta de color</p>
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
            </>
          ) : isMetaUniversitaria ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Identidad del asesor</p>
              <Input label="Nombre a mostrar" value={metaUniAdvisorName} onChange={(e) => setMetaUniAdvisorName(e.target.value)} />
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
            </>
          ) : isKitEmergencia ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Identidad del asesor</p>
              <Input label="Nombre a mostrar" value={kitAdvisorName} onChange={(e) => setKitAdvisorName(e.target.value)} />
              <Input label="Título / rol" value={kitTitle} onChange={(e) => setKitTitle(e.target.value)} />
              <Input
                label="WhatsApp (solo dígitos, con código de país)"
                value={kitWhatsapp}
                onChange={(e) => setKitWhatsapp(e.target.value)}
                placeholder="5215500000000"
              />
              <Input label="Correo (opcional)" value={kitEmail} onChange={(e) => setKitEmail(e.target.value)} placeholder="tu@correo.com" />
              <Input label="URL de agenda (Calendly u otro)" value={kitCalendlyURL} onChange={(e) => setKitCalendlyURL(e.target.value)} placeholder="https://calendly.com/tu-agenda" />
              <Input label="URL del Aviso de Privacidad" value={kitPrivacyURL} onChange={(e) => setKitPrivacyURL(e.target.value)} placeholder="https://..." />
              <Input
                label="Webhook externo opcional (copia del lead a tu propia herramienta)"
                value={kitWebhookURL}
                onChange={(e) => setKitWebhookURL(e.target.value)}
                placeholder="https://..."
              />
            </>
          ) : isTestEmergencia ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Identidad del asesor</p>
              <Input label="Nombre a mostrar" value={testAdvisorName} onChange={(e) => setTestAdvisorName(e.target.value)} />
              <Input label="Título / rol" value={testTitle} onChange={(e) => setTestTitle(e.target.value)} />
              <Input
                label="WhatsApp (solo dígitos, con código de país)"
                value={testWhatsapp}
                onChange={(e) => setTestWhatsapp(e.target.value)}
                placeholder="5215500000000"
              />
              <Input label="Correo (opcional)" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="tu@correo.com" />
              <Input label="URL de agenda (Calendly u otro)" value={testCalendlyURL} onChange={(e) => setTestCalendlyURL(e.target.value)} placeholder="https://calendly.com/tu-agenda" />
              <Input label="URL del Aviso de Privacidad" value={testPrivacyURL} onChange={(e) => setTestPrivacyURL(e.target.value)} placeholder="https://..." />
              <Input
                label="Webhook externo opcional (copia del lead a tu propia herramienta)"
                value={testWebhookURL}
                onChange={(e) => setTestWebhookURL(e.target.value)}
                placeholder="https://..."
              />
              <Input label="Nombre del seguro de salud (pregunta 7)" value={testSeguroSaludNombre} onChange={(e) => setTestSeguroSaludNombre(e.target.value)} />
              <Input
                label="URL del Kit de Emergencia Financiera Familiar (opcional, recurso recomendado al final)"
                value={testKitEmergenciaURL}
                onChange={(e) => setTestKitEmergenciaURL(e.target.value)}
                placeholder="https://..."
              />
              <Input
                label="URL de la Calculadora de Fondo de Emergencia (opcional, aún no existe en Growth Link)"
                value={testFondoEmergenciaURL}
                onChange={(e) => setTestFondoEmergenciaURL(e.target.value)}
                placeholder="https://..."
              />
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
