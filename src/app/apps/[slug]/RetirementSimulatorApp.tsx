"use client";

import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Compass,
  GraduationCap,
  Handshake,
  HeartPulse,
  Home,
  Lightbulb,
  Loader2,
  MessageCircle,
  PiggyBank,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  RECOMMENDED_INCOME_REPLACEMENT_PCT,
  recommendedMonthlyIncome,
  simulateRetirement,
  simulateRetirementSeries,
} from "@/lib/miniApps/financialEngine";
import { getPreparationLevel, getStrengthsAndOpportunities } from "@/lib/miniApps/resultDiagnostics";
import { submitMiniAppLeadFromHostedPage, submitMiniAppLeadQualificationFromHostedPage } from "@/lib/miniApps/actions";
import type { PublicMiniAppView } from "@/lib/miniApps/queries";
import { RetirementGrowthChart } from "./RetirementResultCharts";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
}

/** `color-mix` instead of Tailwind's opacity-modifier-on-arbitrary-value —
 * the palette is only known to this page as CSS custom properties (computed
 * once server-side in page.tsx, never passed down as a JS object), so a
 * "10% of --ma-button-primary-bg" tint has to happen in CSS, not JS. */
function soften(cssVar: string, percent: number): string {
  return `color-mix(in srgb, var(${cssVar}) ${percent}%, transparent)`;
}

const AHORRO_CHIPS = [2000, 4000, 6000, 10000, 15000];

const PREOCUPACION_OPTIONS = [
  { value: "no_se_cuanto", label: "No sé cuánto voy a recibir." },
  { value: "retirarme_antes", label: "Quiero retirarme antes." },
  { value: "pension_insuficiente", label: "Mi pensión será insuficiente." },
  { value: "proteger_familia", label: "Quiero proteger a mi familia." },
  { value: "solo_conocer", label: "Solo quería conocer mi situación." },
];
const HABLO_ASESOR_OPTIONS = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
];
const OBJETIVO_OPTIONS = [
  { value: "mejorar_retiro", label: "Mejorar mi retiro." },
  { value: "reducir_impuestos", label: "Reducir impuestos." },
  { value: "invertir_mejor", label: "Invertir mejor." },
  { value: "proteger_patrimonio", label: "Proteger mi patrimonio." },
  { value: "no_seguro", label: "No estoy seguro." },
];
const CUANDO_OPTIONS = [
  { value: "esta_semana", label: "Esta semana." },
  { value: "este_mes", label: "Este mes." },
  { value: "mas_adelante", label: "Más adelante." },
];

const EDUCATIONAL_TIPS = [
  "Revisar la estrategia de retiro con una mirada actualizada.",
  "Optimizar el ahorro mensual sin resignar calidad de vida hoy.",
  "Analizar alternativas de inversión acordes al plazo restante.",
  "Revisar beneficios fiscales disponibles para el ahorro de largo plazo.",
];

type WizardStepKey = "intro" | "edad" | "retiro" | "ahorro" | "ingreso" | "nombre" | "whatsapp" | "consentimiento";
type Phase = "wizard" | "calculando" | "resultado";
type ResultStepKey =
  | "pension"
  | "diagnostico"
  | "comparacion"
  | "brecha"
  | "significado"
  | "escenarios"
  | "educacion"
  | "calificacion"
  | "cierre";

/** Animated count-up for the headline fund number — mirrors the reference
 * simulator's `countTo` easing (cubic ease-out, ~700ms), disabled entirely
 * under prefers-reduced-motion. */
function useCountUp(target: number, active: boolean) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (!active) return;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const raf = requestAnimationFrame(() => {
        setDisplay(target);
        fromRef.current = target;
      });
      return () => cancelAnimationFrame(raf);
    }
    const from = fromRef.current;
    const t0 = performance.now();
    const dur = 900;
    let raf = 0;
    function tick(t: number) {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return display;
}

// ---------------------------------------------------------------------------
// Brand-aware primitives — deliberately local (not the shared
// src/components/ui/Button.tsx / ProgressBar.tsx) since those hardcode GL's
// own --color-accent-* tokens; this public page's whole point is rendering
// each mini app's OWN generated palette instead, without touching the
// shared components every authenticated screen still relies on.
// ---------------------------------------------------------------------------

function MiniAppButton({
  variant = "primary",
  loading,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; loading?: boolean }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none";
  const styleByVariant: CSSProperties =
    variant === "primary"
      ? { background: "var(--ma-button-primary-bg)", color: "var(--ma-button-primary-text)" }
      : variant === "secondary"
        ? { background: "transparent", color: "var(--ma-text-color)", border: "1px solid var(--ma-border-strong)" }
        : { background: "transparent", color: "var(--ma-text-muted)" };

  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`${base} ${className}`}
      style={styleByVariant}
      onMouseEnter={(e) => {
        if (variant === "primary") e.currentTarget.style.background = "var(--ma-button-primary-hover)";
      }}
      onMouseLeave={(e) => {
        if (variant === "primary") e.currentTarget.style.background = "var(--ma-button-primary-bg)";
      }}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

function MiniAppProgressBar({ value, colorVar = "--ma-button-primary-bg" }: { value: number; colorVar?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--ma-background-surface-alt)" }}>
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%`, background: `var(${colorVar})` }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

/** Progress indicator for the paginated results reveal — dots instead of the
 * wizard's linear bar, so the two phases read as distinct experiences: one
 * "filling in a form", the other "unwrapping a story". */
function RevealStepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            width: i === current ? 22 : 6,
            background: i <= current ? "var(--ma-button-primary-bg)" : "var(--ma-background-surface-alt)",
          }}
        />
      ))}
    </div>
  );
}

function DecorativeBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ background: "var(--ma-background-page)" }} aria-hidden="true">
      <div
        className="absolute inset-0 bg-[length:220%_220%] opacity-[0.10] motion-safe:animate-[gradient-pan_22s_ease_infinite]"
        style={{ backgroundImage: "var(--ma-gradient-decorative)" }}
      />
      <div className="absolute -top-24 -left-20 size-72 rounded-full blur-3xl motion-safe:animate-[float-slow_7s_ease-in-out_infinite]" style={{ background: soften("--ma-button-primary-bg", 14) }} />
      <div className="absolute top-1/3 -right-16 size-80 rounded-full blur-3xl motion-safe:animate-[float-slow_9s_ease-in-out_infinite]" style={{ background: soften("--ma-button-secondary-bg", 14) }} />
      <div className="absolute -bottom-24 left-1/4 size-72 rounded-full blur-3xl motion-safe:animate-[float-slow_8s_ease-in-out_infinite]" style={{ background: soften("--ma-chart-series-secondary", 10) }} />
    </div>
  );
}

function AgentBar({ app }: { app: PublicMiniAppView }) {
  const { branding, config } = app;
  const agentName = config.assignedAgentName ?? "Growth Link";
  const initials = agentName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-3 backdrop-blur-sm"
      style={{ background: soften("--ma-background-surface", 92), border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-sm)" }}
    >
      {branding.logoUrl ? (
        <Image src={branding.logoUrl} alt={agentName} width={44} height={44} className="size-11 shrink-0 rounded-xl object-cover" unoptimized />
      ) : (
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[15px] font-semibold tracking-wide"
          style={{ background: "var(--ma-gradient-hero)", color: "var(--ma-gradient-hero-text)" }}
        >
          {initials || "GL"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold" style={{ color: "var(--ma-title-color)" }}>
          {agentName}
        </p>
        <p className="truncate text-xs" style={{ color: "var(--ma-text-muted)" }}>
          {app.description || "Asesor en protección y retiro"}
        </p>
      </div>
      <span
        className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-[0.08em] uppercase"
        style={{ background: "var(--ma-tag-bg)", color: "var(--ma-tag-text)" }}
      >
        Simulador
      </span>
    </div>
  );
}

function SliderQuestion({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-medium" style={{ color: "var(--ma-title-color)" }}>
          {label}
        </span>
        <span className="font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--ma-button-primary-bg)" }}>
          {format(value)}
        </span>
      </div>
      {hint && (
        <p className="mb-3 text-[13px]" style={{ color: "var(--ma-text-muted)" }}>
          {hint}
        </p>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{ background: "var(--ma-background-surface-alt)", accentColor: "var(--ma-button-primary-bg)" }}
      />
      <div className="mt-1.5 flex justify-between font-mono text-[11px]" style={{ color: "var(--ma-text-muted)" }}>
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

/** One optional single-select question for the lead-qualification step —
 * same selectable-pill visual language as the AHORRO_CHIPS quick-picks
 * already used in the wizard, just wrapped with its own label. */
function SingleChoiceQuestion({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[13.5px] font-medium" style={{ color: "var(--ma-text-color)" }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="rounded-full border px-3.5 py-1.5 text-left text-[13px] font-medium transition-colors duration-150"
              style={
                selected
                  ? { borderColor: "var(--ma-button-primary-bg)", background: "var(--ma-button-primary-bg)", color: "var(--ma-button-primary-text)" }
                  : { borderColor: "var(--ma-border-strong)", background: "var(--ma-background-surface-alt)", color: "var(--ma-text-color)" }
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepShell({ icon: Icon, title, subtitle, children }: { icon: typeof Sparkles; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 motion-safe:animate-[fade-in-up_0.35s_ease]">
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--ma-tag-bg)", color: "var(--ma-icon-color)" }}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ma-title-color)" }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-[13px]" style={{ color: "var(--ma-text-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export function RetirementSimulatorApp({ app }: { app: PublicMiniAppView }) {
  const { config } = app;
  // Set inside an effect (post-render), not inline in useRef's initializer —
  // Date.now() is impure and React flags calling it during render itself.
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
    fetch(`/api/public/mini-apps/${app.slug}/visit`, { method: "POST", keepalive: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps = useMemo<WizardStepKey[]>(() => {
    const list: WizardStepKey[] = ["intro", "edad", "retiro", "ahorro"];
    if (config.showIngresoActual) list.push("ingreso");
    list.push("nombre", "whatsapp", "consentimiento");
    return list;
  }, [config.showIngresoActual]);

  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("wizard");
  const [resultStepIndex, setResultStepIndex] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [edad, setEdad] = useState(35);
  const [edadRetiro, setEdadRetiro] = useState(65);
  const [ahorroMensual, setAhorroMensual] = useState(4000);
  const [ingresoActual, setIngresoActual] = useState(0);
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const leadIdRef = useRef<string | null>(null);
  const [preocupacion, setPreocupacion] = useState<string | null>(null);
  const [habloAsesor, setHabloAsesor] = useState<string | null>(null);
  const [objetivo, setObjetivo] = useState<string | null>(null);
  const [cuandoEmpezar, setCuandoEmpezar] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const currentStep = steps[stepIndex];
  const progressPct = phase === "wizard" ? Math.round((stepIndex / steps.length) * 100) : 100;

  const clampedRetiro = Math.max(edadRetiro, edad + 1);

  const result = useMemo(
    () => simulateRetirement({ edad, edadRetiro: clampedRetiro, ahorroMensual, annualReturnRatePct: config.annualReturnRatePct }),
    [edad, clampedRetiro, ahorroMensual, config.annualReturnRatePct],
  );
  const series = useMemo(
    () => simulateRetirementSeries({ edad, edadRetiro: clampedRetiro, ahorroMensual, annualReturnRatePct: config.annualReturnRatePct }),
    [edad, clampedRetiro, ahorroMensual, config.annualReturnRatePct],
  );
  const capitalAportado = ahorroMensual * (clampedRetiro - edad) * 12;

  const ingresoRecomendado = ingresoActual > 0 ? recommendedMonthlyIncome(ingresoActual) : null;
  const brecha = ingresoRecomendado !== null ? Math.max(0, ingresoRecomendado - result.rentaMensualEstimada) : null;
  const sinBrecha = brecha === 0;

  // Coverage relative to the RECOMMENDED income (not the raw current income) —
  // this is what the "comparación" reveal step visualizes as two bars.
  const replacementPct =
    ingresoRecomendado !== null && ingresoRecomendado > 0 ? Math.min(200, Math.round((result.rentaMensualEstimada / ingresoRecomendado) * 100)) : null;

  const resultSteps = useMemo<ResultStepKey[]>(
    () =>
      brecha !== null
        ? ["pension", "diagnostico", "comparacion", "brecha", "significado", "escenarios", "educacion", "calificacion", "cierre"]
        : ["pension", "diagnostico", "significado", "escenarios", "educacion", "calificacion", "cierre"],
    [brecha],
  );
  const currentResultStep = resultSteps[resultStepIndex];

  const fundDisplay = useCountUp(result.fondoEstimado, phase === "resultado" && currentResultStep === "pension");
  const incomeDisplay = useCountUp(result.rentaMensualEstimada, phase === "resultado" && currentResultStep === "comparacion");
  const brechaDisplay = useCountUp(brecha ?? 0, phase === "resultado" && currentResultStep === "brecha");

  const aniosParaRetiro = clampedRetiro - edad;
  const preparation = getPreparationLevel({ aniosParaRetiro, ahorroMensual, replacementPct });
  const { strengths, opportunities } = getStrengthsAndOpportunities({ aniosParaRetiro, ahorroMensual, replacementPct });

  // "Qué pasaría si" — orientative what-ifs, same simulateRetirement engine
  // with tweaked inputs, never a new calculation method.
  const ahorroBump = Math.max(1000, Math.round((ahorroMensual * 0.2) / 500) * 500);
  const scenarioMasAhorro = useMemo(
    () => simulateRetirement({ edad, edadRetiro: clampedRetiro, ahorroMensual: ahorroMensual + ahorroBump, annualReturnRatePct: config.annualReturnRatePct }),
    [edad, clampedRetiro, ahorroMensual, ahorroBump, config.annualReturnRatePct],
  );
  const scenarioRetiroTardio = useMemo(
    () => simulateRetirement({ edad, edadRetiro: clampedRetiro + 1, ahorroMensual, annualReturnRatePct: config.annualReturnRatePct }),
    [edad, clampedRetiro, ahorroMensual, config.annualReturnRatePct],
  );

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function goNext() {
    setError(null);
    if (currentStep === "nombre" && !nombre.trim()) {
      setError("Contame tu nombre para continuar.");
      return;
    }
    if (currentStep === "whatsapp" && whatsapp.replace(/\D/g, "").length < 8) {
      setError("Ingresá un WhatsApp válido.");
      return;
    }
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  }

  function goResultBack() {
    setResultStepIndex((i) => Math.max(0, i - 1));
  }

  function goResultNext() {
    if (currentResultStep === "calificacion") saveQualification();
    setResultStepIndex((i) => Math.min(resultSteps.length - 1, i + 1));
  }

  function saveQualification() {
    if (!leadIdRef.current) return;
    const answers: Record<string, unknown> = {};
    if (preocupacion) answers.preocupacion_principal = preocupacion;
    if (habloAsesor) answers.hablo_con_asesor_antes = habloAsesor;
    if (objetivo) answers.objetivo_principal = objetivo;
    if (cuandoEmpezar) answers.cuando_quiere_empezar = cuandoEmpezar;
    if (Object.keys(answers).length === 0) return;
    submitMiniAppLeadQualificationFromHostedPage(leadIdRef.current, answers).catch(() => {});
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: app.name, url });
      } catch {
        // El usuario canceló el share nativo — no es un error a mostrar.
      }
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  }

  async function handleFinish() {
    if (!consentimiento) {
      setError("Necesitamos tu consentimiento para poder contactarte.");
      return;
    }
    setError(null);
    setSubmitting(true);
    setPhase("calculando");
    try {
      const nowIso = new Date().toISOString();
      const outcome = await submitMiniAppLeadFromHostedPage(app.slug, {
        fecha: nowIso,
        origen_app: app.name,
        nombre,
        whatsapp,
        consentimiento: true,
        consentimiento_fecha: nowIso,
        edad,
        edad_retiro: clampedRetiro,
        ahorro_mensual: ahorroMensual,
        ingreso_actual: ingresoActual || undefined,
        duration_seconds: Math.round((Date.now() - (startedAtRef.current ?? Date.now())) / 1000),
      });
      if (!outcome.ok) {
        setError("No pudimos guardar tus datos. Intentá de nuevo en unos minutos.");
        setPhase("wizard");
        return;
      }
      leadIdRef.current = outcome.leadId ?? null;
      // Deliberate short pause — "loading antes del resultado" per spec,
      // and it gives the count-up entrance somewhere natural to start from.
      await new Promise((r) => setTimeout(r, 1300));
      setResultStepIndex(0);
      setPhase("resultado");
    } catch {
      setError("No pudimos guardar tus datos. Intentá de nuevo en unos minutos.");
      setPhase("wizard");
    } finally {
      setSubmitting(false);
    }
  }

  const genericWhyPlanEarly = [
    "El interés compuesto hace la mayor parte del trabajo — cuanto antes empezás, menos tenés que poner vos.",
    "Un plan de retiro formal ordena tus aportes y te protege de imprevistos en el camino.",
    "Revisar tu plan cada año te permite ajustarlo a cambios reales en tu ingreso o tus metas.",
  ];

  return (
    <div
      data-mini-app-theme="true"
      className={`relative flex min-h-screen justify-center px-4 py-8 sm:py-12 ${phase === "resultado" ? "items-start" : "items-center"}`}
    >
      <DecorativeBackground />
      <div className={`flex w-full flex-col gap-4 transition-[max-width] duration-300 ${phase === "resultado" ? "max-w-2xl" : "max-w-md"}`}>
        <AgentBar app={app} />

        {phase !== "resultado" && (
          <div className="px-1">
            <MiniAppProgressBar value={progressPct} />
          </div>
        )}

        {phase === "calculando" && (
          <div
            className="flex flex-col items-center gap-4 rounded-2xl px-6 py-16 text-center motion-safe:animate-[fade-in-up_0.3s_ease]"
            style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-lg)" }}
          >
            <Loader2 className="size-9 animate-spin" style={{ color: "var(--ma-button-primary-bg)" }} aria-hidden="true" />
            <div>
              <p className="text-[15px] font-semibold" style={{ color: "var(--ma-title-color)" }}>
                Calculando tu proyección…
              </p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--ma-text-muted)" }}>
                Estamos armando tu resultado personalizado.
              </p>
            </div>
          </div>
        )}

        {phase === "wizard" && (
          <div
            className="rounded-2xl p-6 sm:p-7"
            style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-lg)" }}
          >
            {currentStep === "intro" && (
              <div className="flex flex-col items-center gap-5 py-4 text-center motion-safe:animate-[fade-in-up_0.35s_ease]">
                <span
                  className="flex size-16 items-center justify-center rounded-2xl"
                  style={{ background: "var(--ma-gradient-hero)", color: "var(--ma-gradient-hero-text)" }}
                >
                  <Compass className="size-7" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-[21px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ma-title-color)" }}>
                    Conozcamos tu situación
                  </h2>
                  <p className="mx-auto mt-2.5 max-w-xs text-[14px] leading-relaxed" style={{ color: "var(--ma-text-muted)" }}>
                    En menos de 2 minutos vas a ver cuánto podrías recibir al retirarte, qué tan cerca estás de lo que necesitás, y cómo cerrar esa
                    diferencia.
                  </p>
                </div>
              </div>
            )}

            {currentStep === "edad" && (
              <StepShell icon={CalendarClock} title="¿Cuántos años tenés hoy?" subtitle="Es el punto de partida de tu proyección.">
                <SliderQuestion label="Tu edad hoy" value={edad} min={18} max={65} format={(v) => `${v} años`} onChange={setEdad} />
              </StepShell>
            )}

            {currentStep === "retiro" && (
              <StepShell icon={Target} title="¿A qué edad querés retirarte?" subtitle="Mientras más tiempo, más trabaja el interés compuesto para vos.">
                <SliderQuestion
                  label="Edad de retiro"
                  value={clampedRetiro}
                  min={edad + 1}
                  max={80}
                  format={(v) => `${v} años`}
                  onChange={setEdadRetiro}
                />
              </StepShell>
            )}

            {currentStep === "ahorro" && (
              <StepShell icon={PiggyBank} title="¿Cuánto podés guardar cada mes?" subtitle="Empezá con lo que puedas — después lo ajustamos juntos.">
                <SliderQuestion
                  label="Ahorro mensual"
                  value={ahorroMensual}
                  min={500}
                  max={30000}
                  step={500}
                  format={(v) => formatCurrency(v)}
                  onChange={setAhorroMensual}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {AHORRO_CHIPS.map((v) => {
                    const selected = ahorroMensual === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAhorroMensual(v)}
                        className="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold tabular-nums transition-colors duration-150"
                        style={
                          selected
                            ? { borderColor: "var(--ma-button-primary-bg)", background: "var(--ma-button-primary-bg)", color: "var(--ma-button-primary-text)" }
                            : { borderColor: "var(--ma-border-strong)", background: "var(--ma-background-surface-alt)", color: "var(--ma-text-color)" }
                        }
                      >
                        {formatCurrency(v)}
                      </button>
                    );
                  })}
                </div>
              </StepShell>
            )}

            {currentStep === "ingreso" && (
              <StepShell icon={Wallet} title="¿Cuál es tu ingreso mensual hoy?" subtitle="Opcional — nos sirve para ver cuánto de tu ritmo de vida actual cubrirías.">
                <SliderQuestion
                  label="Ingreso mensual"
                  value={ingresoActual}
                  min={0}
                  max={150000}
                  step={1000}
                  format={(v) => (v > 0 ? formatCurrency(v) : "Prefiero no decir")}
                  onChange={setIngresoActual}
                />
              </StepShell>
            )}

            {currentStep === "nombre" && (
              <StepShell icon={Sparkles} title="¿Cómo te llamás?" subtitle="Así personalizamos tu resultado.">
                <input
                  type="text"
                  autoFocus
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre y apellido"
                  className="w-full rounded-xl px-4 py-3 text-[15px] outline-none transition-colors duration-150"
                  style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border-strong)", color: "var(--ma-text-color)" }}
                />
              </StepShell>
            )}

            {currentStep === "whatsapp" && (
              <StepShell icon={MessageCircle} title="¿Cuál es tu WhatsApp?" subtitle="Ahí te vamos a compartir tu resultado y coordinar tu cita.">
                <input
                  type="tel"
                  autoFocus
                  inputMode="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="55 1234 5678"
                  className="w-full rounded-xl px-4 py-3 text-[15px] outline-none transition-colors duration-150"
                  style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border-strong)", color: "var(--ma-text-color)" }}
                />
              </StepShell>
            )}

            {currentStep === "consentimiento" && (
              <StepShell icon={ShieldCheck} title="Último paso" subtitle="Confirmá que podemos contactarte con tu resultado.">
                <label
                  className="flex cursor-pointer items-start gap-3 rounded-xl p-4"
                  style={{ background: "var(--ma-background-surface-alt)", border: "1px solid var(--ma-border)" }}
                >
                  <input
                    type="checkbox"
                    checked={consentimiento}
                    onChange={(e) => setConsentimiento(e.target.checked)}
                    className="mt-0.5 size-5 shrink-0"
                    style={{ accentColor: "var(--ma-button-primary-bg)" }}
                  />
                  <span className="text-[13.5px] leading-relaxed" style={{ color: "var(--ma-text-muted)" }}>
                    Acepto que{" "}
                    <strong style={{ color: "var(--ma-text-color)" }}>{config.assignedAgentName ?? "Growth Link"}</strong> me contacte por WhatsApp
                    para orientarme sobre mi plan de retiro, conforme a la LFPDPPP.{" "}
                    <button
                      type="button"
                      onClick={() => setPrivacyOpen(true)}
                      className="underline underline-offset-2"
                      style={{ color: "var(--ma-button-primary-bg)" }}
                    >
                      Ver aviso de privacidad
                    </button>
                    .
                  </span>
                </label>
              </StepShell>
            )}

            {error && (
              <p className="mt-4 text-[13px]" style={{ color: "var(--color-error-strong)" }}>
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              <MiniAppButton type="button" variant="ghost" onClick={goBack} disabled={stepIndex === 0}>
                <ArrowLeft className="size-4" aria-hidden="true" /> Atrás
              </MiniAppButton>
              {currentStep === "consentimiento" ? (
                <MiniAppButton type="button" onClick={handleFinish} loading={submitting} disabled={!consentimiento}>
                  Ver mi resultado <ArrowRight className="size-4" aria-hidden="true" />
                </MiniAppButton>
              ) : (
                <MiniAppButton type="button" onClick={goNext}>
                  {currentStep === "intro" ? "Comenzar" : "Continuar"} <ArrowRight className="size-4" aria-hidden="true" />
                </MiniAppButton>
              )}
            </div>
          </div>
        )}

        {phase === "resultado" && (
          <div className="flex flex-col gap-5">
            <RevealStepDots total={resultSteps.length} current={resultStepIndex} />

            <div key={resultStepIndex} className="flex flex-col gap-5 motion-safe:animate-[fade-in-up_0.4s_ease]">
              {currentResultStep === "pension" && (
                <>
                  <div
                    className="overflow-hidden rounded-2xl p-7 text-center sm:p-9"
                    style={{ background: "var(--ma-gradient-hero)", color: "var(--ma-gradient-hero-text)", boxShadow: "var(--ma-shadow-lg)" }}
                  >
                    <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-[0.16em] uppercase opacity-70">
                      <Sparkles className="size-3.5" aria-hidden="true" /> Tu pensión estimada al retirarte
                    </p>
                    <p className="mt-3 font-mono text-5xl font-bold tabular-nums sm:text-6xl">{formatCurrency(fundDisplay)}</p>
                    <p className="mt-3 text-[13.5px] opacity-80">
                      Rango estimado: <span className="font-mono font-medium">{formatCurrency(result.fondoRangoBajo)}</span> —{" "}
                      <span className="font-mono font-medium">{formatCurrency(result.fondoRangoAlto)}</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard emoji="🎯" label="Edad de retiro" value={`${clampedRetiro} años`} />
                    <StatCard emoji="📈" label="Rendimiento esperado" value={`${config.annualReturnRatePct}% anual`} />
                  </div>
                </>
              )}

              {currentResultStep === "diagnostico" && (
                <div
                  className="rounded-2xl p-6 sm:p-7"
                  style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-lg)" }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl leading-none">{preparation.emoji}</span>
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: "var(--ma-text-muted)" }}>
                        Tu diagnóstico
                      </p>
                      <h3 className="text-[18px] font-semibold" style={{ color: "var(--ma-title-color)" }}>
                        {preparation.label}
                      </h3>
                    </div>
                  </div>
                  <p className="mt-3 text-[13.5px]" style={{ color: "var(--ma-text-muted)" }}>
                    {preparation.reason}
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--ma-text-muted)" }}>
                        Lo que hoy juega a tu favor
                      </p>
                      <ul className="flex flex-col gap-2">
                        {strengths.map((text) => (
                          <li key={text} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--ma-text-color)" }}>
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0" style={{ color: "var(--ma-chart-series-secondary)" }} aria-hidden="true" />
                            {text}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--ma-text-muted)" }}>
                        Aspectos que sería conveniente revisar
                      </p>
                      <ul className="flex flex-col gap-2">
                        {opportunities.map((text) => (
                          <li key={text} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--ma-text-color)" }}>
                            <AlertCircle className="mt-0.5 size-4 shrink-0" style={{ color: "var(--ma-icon-color)" }} aria-hidden="true" />
                            {text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {currentResultStep === "comparacion" && ingresoRecomendado !== null && (
                <div
                  className="rounded-2xl p-6 sm:p-7"
                  style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-lg)" }}
                >
                  <h3 className="text-[17px] font-semibold" style={{ color: "var(--ma-title-color)" }}>
                    Comparemos con lo que realmente necesitás
                  </h3>
                  <p className="mt-1.5 text-[13px]" style={{ color: "var(--ma-text-muted)" }}>
                    La guía estándar de planificación recomienda cubrir un {RECOMMENDED_INCOME_REPLACEMENT_PCT}% de tu ingreso actual durante el
                    retiro.
                  </p>
                  <div className="mt-5 flex flex-col gap-4">
                    <div>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="text-[13.5px] font-medium" style={{ color: "var(--ma-text-color)" }}>
                          Tu pensión estimada
                        </span>
                        <span className="font-mono text-lg font-semibold tabular-nums" style={{ color: "var(--ma-button-primary-bg)" }}>
                          {formatCurrency(incomeDisplay)}
                        </span>
                      </div>
                      <MiniAppProgressBar value={replacementPct !== null ? Math.min(100, replacementPct) : 0} colorVar="--ma-button-primary-bg" />
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="text-[13.5px] font-medium" style={{ color: "var(--ma-text-color)" }}>
                          Ingreso recomendado
                        </span>
                        <span className="font-mono text-lg font-semibold tabular-nums" style={{ color: "var(--ma-chart-series-secondary)" }}>
                          {formatCurrency(ingresoRecomendado)}
                        </span>
                      </div>
                      <MiniAppProgressBar value={100} colorVar="--ma-chart-series-secondary" />
                    </div>
                  </div>
                  {replacementPct !== null && (
                    <p className="mt-4 text-[13px]" style={{ color: "var(--ma-text-muted)" }}>
                      Hoy estarías cubriendo el <strong style={{ color: "var(--ma-text-color)" }}>{replacementPct}%</strong> de lo recomendado.
                    </p>
                  )}
                  <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: "var(--ma-text-muted)" }}>
                    En palabras simples: tu <strong style={{ color: "var(--ma-text-color)" }}>pensión estimada</strong> es lo que tu ahorro
                    proyectaría como ingreso mensual al retirarte; el <strong style={{ color: "var(--ma-text-color)" }}>ingreso recomendado</strong>{" "}
                    es lo que sueles necesitar para mantener tu ritmo de vida actual.
                  </p>
                </div>
              )}

              {currentResultStep === "brecha" && brecha !== null && (
                <div
                  className="overflow-hidden rounded-2xl p-7 text-center sm:p-9"
                  style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border-strong)", boxShadow: "var(--ma-shadow-lg)" }}
                >
                  {sinBrecha ? (
                    <>
                      <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: "var(--ma-text-muted)" }}>
                        <CheckCircle2 className="size-3.5" aria-hidden="true" /> Tu brecha
                      </p>
                      <p className="mt-3 font-mono text-4xl font-bold tabular-nums sm:text-5xl" style={{ color: "var(--ma-chart-series-secondary)" }}>
                        {formatCurrency(0)}
                      </p>
                      <p className="mx-auto mt-3 max-w-sm text-[13.5px]" style={{ color: "var(--ma-text-muted)" }}>
                        Vas por muy buen camino — tu proyección ya cubre lo recomendado para mantener tu ritmo de vida.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: "var(--ma-text-muted)" }}>
                        Tu brecha mensual
                      </p>
                      <p className="mt-3 font-mono text-5xl font-bold tabular-nums sm:text-6xl" style={{ color: "var(--ma-button-primary-bg)" }}>
                        {formatCurrency(brechaDisplay)}
                      </p>
                      <p className="mx-auto mt-3 max-w-sm text-[13.5px]" style={{ color: "var(--ma-text-muted)" }}>
                        Es la diferencia entre lo que recibirías y lo que realmente necesitarías cada mes para mantener tu ritmo de vida.
                      </p>
                      <p className="mx-auto mt-3 max-w-sm text-[12px] leading-relaxed" style={{ color: "var(--ma-text-muted)" }}>
                        Existe porque tu ahorro actual, proyectado a tu edad de retiro, todavía no alcanza a cubrir el ingreso recomendado — es
                        exactamente lo que se puede trabajar con una estrategia adecuada.
                      </p>
                    </>
                  )}
                </div>
              )}

              {currentResultStep === "significado" && (
                <div
                  className="rounded-2xl p-6 sm:p-7"
                  style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-lg)" }}
                >
                  {brecha !== null && !sinBrecha ? (
                    <>
                      <div className="mb-1 flex items-center gap-2">
                        <Lightbulb className="size-4" style={{ color: "var(--ma-icon-color)" }} aria-hidden="true" />
                        <h3 className="text-[16px] font-semibold" style={{ color: "var(--ma-title-color)" }}>
                          ¿Qué significan realmente esos {formatCurrency(brecha)} de diferencia?
                        </h3>
                      </div>
                      <ul className="mt-4 flex flex-col gap-3">
                        {[
                          { Icon: Home, text: "Podría ser el costo de tu vivienda cada mes." },
                          { Icon: HeartPulse, text: "O lo que necesitás para medicamentos y atención médica." },
                          { Icon: Compass, text: "O la diferencia entre mantener tu estilo de vida... o tener que resignarlo." },
                        ].map(({ Icon, text }) => (
                          <li key={text} className="flex items-start gap-3 text-[13.5px]" style={{ color: "var(--ma-text-muted)" }}>
                            <span
                              className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                              style={{ background: "var(--ma-tag-bg)", color: "var(--ma-icon-color)" }}
                            >
                              <Icon className="size-4" aria-hidden="true" />
                            </span>
                            <span className="pt-1.5">{text}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-5 text-[13.5px] font-medium" style={{ color: "var(--ma-title-color)" }}>
                        La buena noticia es que todavía estás a tiempo de planificarlo.
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="mb-3 text-[16px] font-semibold" style={{ color: "var(--ma-title-color)" }}>
                        Por qué planificar temprano importa
                      </h3>
                      <ul className="flex flex-col gap-2.5">
                        {genericWhyPlanEarly.map((text) => (
                          <li key={text} className="flex items-start gap-2.5 text-[13.5px]" style={{ color: "var(--ma-text-muted)" }}>
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0" style={{ color: "var(--ma-chart-series-secondary)" }} aria-hidden="true" />
                            {text}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              {currentResultStep === "escenarios" && (
                <div
                  className="rounded-2xl p-6 sm:p-7"
                  style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-lg)" }}
                >
                  <h3 className="text-[17px] font-semibold" style={{ color: "var(--ma-title-color)" }}>
                    Tu resultado puede cambiar
                  </h3>
                  <p className="mt-1.5 text-[13px]" style={{ color: "var(--ma-text-muted)" }}>
                    Estos son ejemplos orientativos de cómo pequeños ajustes moverían tu proyección.
                  </p>
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="rounded-xl p-4" style={{ background: "var(--ma-background-surface-alt)", border: "1px solid var(--ma-border)" }}>
                      <p className="text-[13.5px] font-medium" style={{ color: "var(--ma-text-color)" }}>
                        ¿Qué pasaría si aumentás tu ahorro mensual en {formatCurrency(ahorroBump)}?
                      </p>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-[12px]" style={{ color: "var(--ma-text-muted)" }}>
                          Hoy: {formatCurrency(result.fondoEstimado)}
                        </span>
                        <span className="font-mono text-[15px] font-semibold" style={{ color: "var(--ma-button-primary-bg)" }}>
                          {formatCurrency(scenarioMasAhorro.fondoEstimado)}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: "var(--ma-background-surface-alt)", border: "1px solid var(--ma-border)" }}>
                      <p className="text-[13.5px] font-medium" style={{ color: "var(--ma-text-color)" }}>
                        ¿Qué pasaría si retrasás tu retiro un año, a los {clampedRetiro + 1}?
                      </p>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-[12px]" style={{ color: "var(--ma-text-muted)" }}>
                          Hoy: {formatCurrency(result.fondoEstimado)}
                        </span>
                        <span className="font-mono text-[15px] font-semibold" style={{ color: "var(--ma-button-primary-bg)" }}>
                          {formatCurrency(scenarioRetiroTardio.fondoEstimado)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-[11.5px] leading-relaxed" style={{ color: "var(--ma-text-muted)" }}>
                    Son ejemplos ilustrativos con la misma proyección de tu simulación — un análisis personalizado puede mostrarte más alternativas.
                  </p>
                </div>
              )}

              {currentResultStep === "educacion" && (
                <div
                  className="rounded-2xl p-6 sm:p-7"
                  style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-lg)" }}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <GraduationCap className="size-4" style={{ color: "var(--ma-icon-color)" }} aria-hidden="true" />
                    <h3 className="text-[16px] font-semibold" style={{ color: "var(--ma-title-color)" }}>
                      ¿Qué suelen hacer las personas con un resultado similar?
                    </h3>
                  </div>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {EDUCATIONAL_TIPS.map((text) => (
                      <li key={text} className="flex items-start gap-2.5 text-[13.5px]" style={{ color: "var(--ma-text-muted)" }}>
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0" style={{ color: "var(--ma-chart-series-secondary)" }} aria-hidden="true" />
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {currentResultStep === "calificacion" && (
                <div
                  className="rounded-2xl p-6 sm:p-7"
                  style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-lg)" }}
                >
                  <h3 className="text-[17px] font-semibold" style={{ color: "var(--ma-title-color)" }}>
                    Antes de continuar, contanos un poco más
                  </h3>
                  <p className="mt-1.5 text-[13px]" style={{ color: "var(--ma-text-muted)" }}>
                    Es opcional, pero ayuda a que tu asesor llegue mejor preparado a la conversación.
                  </p>
                  <div className="mt-5 flex flex-col gap-5">
                    <SingleChoiceQuestion
                      label="¿Cuál es hoy tu mayor preocupación?"
                      options={PREOCUPACION_OPTIONS}
                      value={preocupacion}
                      onChange={setPreocupacion}
                    />
                    <SingleChoiceQuestion
                      label="¿Ya hablaste antes con un asesor financiero?"
                      options={HABLO_ASESOR_OPTIONS}
                      value={habloAsesor}
                      onChange={setHabloAsesor}
                    />
                    <SingleChoiceQuestion label="¿Qué te gustaría lograr?" options={OBJETIVO_OPTIONS} value={objetivo} onChange={setObjetivo} />
                    <SingleChoiceQuestion
                      label="¿Cuándo te gustaría comenzar?"
                      options={CUANDO_OPTIONS}
                      value={cuandoEmpezar}
                      onChange={setCuandoEmpezar}
                    />
                  </div>
                </div>
              )}

              {currentResultStep === "cierre" && (
                <>
                  {!confirmed ? (
                    <div
                      className="flex flex-col items-center gap-4 rounded-2xl p-7 text-center sm:p-9"
                      style={{ background: "var(--ma-gradient-hero)", color: "var(--ma-gradient-hero-text)", boxShadow: "var(--ma-shadow-lg)" }}
                    >
                      <span className="flex size-14 items-center justify-center rounded-2xl" style={{ background: soften("--ma-gradient-hero-text", 16) }}>
                        <Handshake className="size-6" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-[19px] font-semibold">Tu simulación ya está lista.</h3>
                        <p className="mx-auto mt-2 max-w-sm text-[13.5px] opacity-80">
                          Este simulador ofrece una estimación basada en la información que ingresaste. Existen muchos factores personales que
                          pueden modificar el resultado y que requieren un análisis individual.
                        </p>
                        <p className="mx-auto mt-2 max-w-sm text-[13.5px] opacity-80">
                          Una revisión personalizada con {config.assignedAgentName ?? "un asesor"} puede ayudarte a entender qué alternativas
                          existen para mejorar tu planificación para el retiro.
                        </p>
                      </div>
                      <div className="mt-1 flex flex-col items-center gap-2.5">
                        <MiniAppButton type="button" onClick={() => setConfirmed(true)}>
                          Quiero una revisión personalizada <ArrowRight className="size-4" aria-hidden="true" />
                        </MiniAppButton>
                        <button
                          type="button"
                          onClick={handleShare}
                          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium opacity-80 transition-opacity duration-150 hover:opacity-100"
                        >
                          {shareCopied ? (
                            <>
                              <CheckCircle2 className="size-3.5" aria-hidden="true" /> ¡Enlace copiado!
                            </>
                          ) : (
                            <>
                              <Share2 className="size-3.5" aria-hidden="true" /> Compartir este simulador
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="rounded-2xl p-6 text-center motion-safe:animate-[fade-in-up_0.35s_ease]"
                      style={{ background: "var(--ma-title-color)", color: "var(--ma-background-page)", boxShadow: "var(--ma-shadow-lg)" }}
                    >
                      <p className="text-[16px] font-semibold">¡Gracias, {nombre.split(" ")[0]}!</p>
                      <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] opacity-70">
                        {config.assignedAgentName ?? "Tu asesor"} te va a contactar por WhatsApp para armar tu plan real.
                      </p>
                    </div>
                  )}

                  <div className="mt-5 flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-3">
                      <StatCard emoji="💰" label="Capital aportado" value={formatCurrency(capitalAportado)} />
                      <StatCard emoji="📈" label="Rendimiento esperado" value={`${config.annualReturnRatePct}% anual`} />
                      <StatCard emoji="🎯" label="Edad de retiro" value={`${clampedRetiro} años`} />
                      <StatCard emoji="💵" label="Ingreso mensual estimado" value={formatCurrency(result.rentaMensualEstimada)} />
                    </div>

                    <div
                      className="rounded-2xl p-5 sm:p-6"
                      style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-md)" }}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <TrendingUp className="size-4" style={{ color: "var(--ma-icon-color)" }} aria-hidden="true" />
                        <h3 className="text-[15px] font-semibold" style={{ color: "var(--ma-title-color)" }}>
                          Cómo crece tu fondo, año a año
                        </h3>
                      </div>
                      <p className="mb-4 text-[13px]" style={{ color: "var(--ma-text-muted)" }}>
                        Lo que vos aportás vs. lo que te da el interés compuesto.
                      </p>
                      <RetirementGrowthChart series={series} />
                      <div className="mt-2 flex flex-wrap justify-center gap-5 text-[12.5px]" style={{ color: "var(--ma-text-muted)" }}>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-full" style={{ background: "var(--ma-chart-series-primary)" }} /> Aportado
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-full" style={{ background: "var(--ma-chart-series-secondary)" }} /> Interés compuesto
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <ScenarioChip label="Conservador" value={formatCurrency(result.fondoRangoBajo)} />
                      <ScenarioChip label="Moderado" value={formatCurrency(result.fondoEstimado)} highlighted />
                      <ScenarioChip label="Optimista" value={formatCurrency(result.fondoRangoAlto)} />
                    </div>

                    <p className="px-2 text-center text-[11px] leading-relaxed" style={{ color: "var(--ma-text-muted)" }}>
                      Simulación con fines ilustrativos. Las cifras son estimaciones y no constituyen asesoría financiera certificada — los
                      resultados reales dependen del plan que contrates y de las condiciones de mercado.
                    </p>
                  </div>
                </>
              )}
            </div>

            {currentResultStep !== "cierre" && (
              <div className="flex items-center justify-between gap-3 px-1">
                <MiniAppButton type="button" variant="ghost" onClick={goResultBack} disabled={resultStepIndex === 0}>
                  <ArrowLeft className="size-4" aria-hidden="true" /> Atrás
                </MiniAppButton>
                <MiniAppButton type="button" onClick={goResultNext}>
                  Seguir <ArrowRight className="size-4" aria-hidden="true" />
                </MiniAppButton>
              </div>
            )}
          </div>
        )}
      </div>

      {privacyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
          onClick={(e) => e.target === e.currentTarget && setPrivacyOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl p-6"
            style={{ background: "var(--ma-background-surface)", boxShadow: "var(--ma-shadow-lg)" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-[17px] font-semibold" style={{ color: "var(--ma-title-color)" }}>
                Aviso de privacidad
              </h4>
              <button
                type="button"
                onClick={() => setPrivacyOpen(false)}
                aria-label="Cerrar"
                style={{ color: "var(--ma-text-muted)" }}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mb-2.5 text-[13px] leading-relaxed" style={{ color: "var(--ma-text-muted)" }}>
              <strong style={{ color: "var(--ma-text-color)" }}>Responsable:</strong> {config.assignedAgentName ?? "el asesor asignado"}. Los datos
              que compartís (nombre y WhatsApp) se usan únicamente para contactarte y darte orientación sobre tu plan de retiro.
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--ma-text-muted)" }}>
              No se comparten con terceros ajenos a esta finalidad. Podés solicitar acceder, rectificar, cancelar tu información u oponerte a su uso
              en cualquier momento escribiendo por el mismo WhatsApp.
            </p>
            <MiniAppButton type="button" variant="secondary" className="mt-4 w-full" onClick={() => setPrivacyOpen(false)}>
              Entendido
            </MiniAppButton>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div
      className="rounded-2xl p-4 transition-transform duration-150 hover:-translate-y-0.5"
      style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-sm)" }}
    >
      <p className="text-2xl">{emoji}</p>
      <p className="mt-1.5 font-mono text-[17px] font-semibold tabular-nums" style={{ color: "var(--ma-title-color)" }}>
        {value}
      </p>
      <p className="text-[12px]" style={{ color: "var(--ma-text-muted)" }}>
        {label}
      </p>
    </div>
  );
}

function ScenarioChip({ label, value, highlighted }: { label: string; value: string; highlighted?: boolean }) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={
        highlighted
          ? { border: "1px solid var(--ma-button-primary-bg)", background: soften("--ma-button-primary-bg", 10) }
          : { border: "1px solid var(--ma-border)", background: "var(--ma-background-surface)" }
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: highlighted ? "var(--ma-button-primary-bg)" : "var(--ma-text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 font-mono text-[13px] font-semibold tabular-nums" style={{ color: "var(--ma-title-color)" }}>
        {value}
      </p>
    </div>
  );
}
