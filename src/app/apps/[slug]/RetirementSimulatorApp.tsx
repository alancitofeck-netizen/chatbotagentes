"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Loader2,
  MessageCircle,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { simulateRetirement, simulateRetirementSeries } from "@/lib/miniApps/financialEngine";
import { submitMiniAppLeadFromHostedPage } from "@/lib/miniApps/actions";
import type { PublicMiniAppView } from "@/lib/miniApps/queries";
import { RetirementGrowthChart } from "./RetirementResultCharts";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
}

const AHORRO_CHIPS = [2000, 4000, 6000, 10000, 15000];

type WizardStepKey = "edad" | "retiro" | "ahorro" | "ingreso" | "nombre" | "whatsapp" | "consentimiento";
type Phase = "wizard" | "calculando" | "resultado";

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

function DecorativeBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background" aria-hidden="true">
      <div
        className="absolute inset-0 bg-[length:220%_220%] opacity-[0.07] motion-safe:animate-[gradient-pan_22s_ease_infinite] dark:opacity-[0.14]"
        style={{ backgroundImage: "linear-gradient(120deg, var(--color-primary-900) 0%, var(--color-accent-700) 50%, var(--color-primary-900) 100%)" }}
      />
      <div className="absolute -top-24 -left-20 size-72 rounded-full bg-accent-500/10 blur-3xl motion-safe:animate-[float-slow_7s_ease-in-out_infinite]" />
      <div className="absolute top-1/3 -right-16 size-80 rounded-full bg-primary-500/10 blur-3xl motion-safe:animate-[float-slow_9s_ease-in-out_infinite]" />
      <div className="absolute -bottom-24 left-1/4 size-72 rounded-full bg-success-strong/8 blur-3xl motion-safe:animate-[float-slow_8s_ease-in-out_infinite]" />
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
    <div className="flex items-center gap-3 rounded-2xl border border-border-default bg-surface-1/90 p-3 shadow-[var(--elevation-sm)] backdrop-blur-sm">
      {branding.logoUrl ? (
        <Image src={branding.logoUrl} alt={agentName} width={44} height={44} className="size-11 shrink-0 rounded-xl object-cover" unoptimized />
      ) : (
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[15px] font-semibold tracking-wide text-white"
          style={{ background: "linear-gradient(135deg, var(--color-accent-500), var(--color-primary-700))" }}
        >
          {initials || "GL"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-foreground">{agentName}</p>
        <p className="truncate text-xs text-neutral-500">{app.description || "Asesor en protección y retiro"}</p>
      </div>
      <span className="shrink-0 rounded-full border border-accent-200 bg-accent-50 px-2.5 py-1 text-[10.5px] font-bold tracking-[0.08em] text-accent-700 uppercase">
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
        <span className="text-[15px] font-medium text-foreground">{label}</span>
        <span className="font-mono text-2xl font-semibold text-accent-600 tabular-nums">{format(value)}</span>
      </div>
      {hint && <p className="mb-3 text-[13px] text-neutral-500">{hint}</p>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-accent-500"
      />
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-neutral-400">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

function StepShell({ icon: Icon, title, subtitle, children }: { icon: typeof Sparkles; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 motion-safe:animate-[fade-in-up_0.35s_ease]">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
          {subtitle && <p className="text-[13px] text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function RetirementSimulatorApp({ app }: { app: PublicMiniAppView }) {
  const { config } = app;

  useEffect(() => {
    fetch(`/api/public/mini-apps/${app.slug}/visit`, { method: "POST", keepalive: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps = useMemo<WizardStepKey[]>(() => {
    const list: WizardStepKey[] = ["edad", "retiro", "ahorro"];
    if (config.showIngresoActual) list.push("ingreso");
    list.push("nombre", "whatsapp", "consentimiento");
    return list;
  }, [config.showIngresoActual]);

  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("wizard");
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

  const fundDisplay = useCountUp(result.fondoEstimado, phase === "resultado");
  const incomeDisplay = useCountUp(result.rentaMensualEstimada, phase === "resultado");

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
      });
      if (!outcome.ok) {
        setError("No pudimos guardar tus datos. Intentá de nuevo en unos minutos.");
        setPhase("wizard");
        return;
      }
      // Deliberate short pause — "loading antes del resultado" per spec,
      // and it gives the count-up entrance somewhere natural to start from.
      await new Promise((r) => setTimeout(r, 1300));
      setPhase("resultado");
    } catch {
      setError("No pudimos guardar tus datos. Intentá de nuevo en unos minutos.");
      setPhase("wizard");
    } finally {
      setSubmitting(false);
    }
  }

  const replacementPct = ingresoActual > 0 ? Math.min(200, Math.round((result.rentaMensualEstimada / ingresoActual) * 100)) : null;

  return (
    <div className={`relative flex min-h-screen justify-center px-4 py-8 sm:py-12 ${phase === "resultado" ? "items-start" : "items-center"}`}>
      <DecorativeBackground />
      <div className={`flex w-full flex-col gap-4 transition-[max-width] duration-300 ${phase === "resultado" ? "max-w-2xl" : "max-w-md"}`}>
        <AgentBar app={app} />

        {phase !== "resultado" && (
          <div className="px-1">
            <ProgressBar value={progressPct} />
          </div>
        )}

        {phase === "calculando" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border-default bg-surface-1 px-6 py-16 text-center shadow-[var(--elevation-lg)] motion-safe:animate-[fade-in-up_0.3s_ease]">
            <Loader2 className="size-9 animate-spin text-accent-500" aria-hidden="true" />
            <div>
              <p className="text-[15px] font-semibold text-foreground">Calculando tu proyección…</p>
              <p className="mt-1 text-[13px] text-neutral-500">Estamos armando tu resultado personalizado.</p>
            </div>
          </div>
        )}

        {phase === "wizard" && (
          <div className="rounded-2xl border border-border-default bg-surface-1 p-6 shadow-[var(--elevation-lg)] sm:p-7">
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
                  {AHORRO_CHIPS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAhorroMensual(v)}
                      className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold tabular-nums transition-colors duration-[var(--duration-fast)] ${
                        ahorroMensual === v
                          ? "border-accent-500 bg-accent-500 text-white"
                          : "border-border-strong bg-surface-2 text-neutral-600 hover:border-accent-400"
                      }`}
                    >
                      {formatCurrency(v)}
                    </button>
                  ))}
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
                  className="w-full rounded-xl border border-border-strong bg-surface-1 px-4 py-3 text-[15px] text-foreground outline-none transition-colors duration-[var(--duration-fast)] placeholder:text-neutral-400 focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
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
                  className="w-full rounded-xl border border-border-strong bg-surface-1 px-4 py-3 text-[15px] text-foreground outline-none transition-colors duration-[var(--duration-fast)] placeholder:text-neutral-400 focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
                />
              </StepShell>
            )}

            {currentStep === "consentimiento" && (
              <StepShell icon={ShieldCheck} title="Último paso" subtitle="Confirmá que podemos contactarte con tu resultado.">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-default bg-surface-2 p-4">
                  <input
                    type="checkbox"
                    checked={consentimiento}
                    onChange={(e) => setConsentimiento(e.target.checked)}
                    className="mt-0.5 size-5 shrink-0 accent-accent-500"
                  />
                  <span className="text-[13.5px] leading-relaxed text-neutral-600">
                    Acepto que <strong className="text-foreground">{config.assignedAgentName ?? "Growth Link"}</strong> me contacte por WhatsApp para
                    orientarme sobre mi plan de retiro, conforme a la LFPDPPP.{" "}
                    <button type="button" onClick={() => setPrivacyOpen(true)} className="underline underline-offset-2 hover:text-accent-600">
                      Ver aviso de privacidad
                    </button>
                    .
                  </span>
                </label>
              </StepShell>
            )}

            {error && <p className="mt-4 text-[13px] text-error-strong">{error}</p>}

            <div className="mt-6 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={goBack} disabled={stepIndex === 0}>
                <ArrowLeft className="size-4" aria-hidden="true" /> Atrás
              </Button>
              {currentStep === "consentimiento" ? (
                <Button onClick={handleFinish} loading={submitting} disabled={!consentimiento}>
                  Ver mi resultado <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button onClick={goNext}>
                  Continuar <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        )}

        {phase === "resultado" && (
          <div className="flex flex-col gap-5 motion-safe:animate-[fade-in-up_0.4s_ease]">
            <div
              className="overflow-hidden rounded-2xl p-7 text-center text-white shadow-[var(--elevation-lg)] sm:p-9"
              style={{ background: "linear-gradient(160deg, var(--color-primary-800), var(--color-primary-950))" }}
            >
              <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-[0.16em] text-white/60 uppercase">
                <Sparkles className="size-3.5" aria-hidden="true" /> Tu fondo estimado al retirarte
              </p>
              <p className="mt-3 font-mono text-5xl font-bold tabular-nums sm:text-6xl">{formatCurrency(fundDisplay)}</p>
              <p className="mt-3 text-[13.5px] text-white/70">
                Rango estimado: <span className="font-mono font-medium text-white">{formatCurrency(result.fondoRangoBajo)}</span> —{" "}
                <span className="font-mono font-medium text-white">{formatCurrency(result.fondoRangoAlto)}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard emoji="💰" label="Capital aportado" value={formatCurrency(capitalAportado)} />
              <StatCard emoji="📈" label="Rendimiento esperado" value={`${config.annualReturnRatePct}% anual`} />
              <StatCard emoji="🎯" label="Edad de retiro" value={`${clampedRetiro} años`} />
              <StatCard emoji="💵" label="Ingreso mensual estimado" value={formatCurrency(incomeDisplay)} />
            </div>

            <div className="rounded-2xl border border-border-default bg-surface-1 p-5 shadow-[var(--elevation-md)] sm:p-6">
              <div className="mb-1 flex items-center gap-2">
                <TrendingUp className="size-4 text-accent-600" aria-hidden="true" />
                <h3 className="text-[15px] font-semibold text-foreground">Cómo crece tu fondo, año a año</h3>
              </div>
              <p className="mb-4 text-[13px] text-neutral-500">Lo que vos aportás vs. lo que te da el interés compuesto.</p>
              <RetirementGrowthChart series={series} />
              <div className="mt-2 flex flex-wrap justify-center gap-5 text-[12.5px] text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-accent-500" /> Aportado
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-success-strong" /> Interés compuesto
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <ScenarioChip label="Conservador" value={formatCurrency(result.fondoRangoBajo)} />
              <ScenarioChip label="Moderado" value={formatCurrency(result.fondoEstimado)} highlighted />
              <ScenarioChip label="Optimista" value={formatCurrency(result.fondoRangoAlto)} />
            </div>

            {replacementPct !== null && (
              <div className="rounded-2xl border border-border-default bg-surface-1 p-5 shadow-[var(--elevation-md)]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[13.5px] font-medium text-foreground">Cobertura de tu ritmo de vida actual</p>
                  <p className="font-mono text-lg font-semibold text-success-strong">{replacementPct}%</p>
                </div>
                <ProgressBar value={Math.min(100, replacementPct)} variant="success" />
                <p className="mt-2 text-[12.5px] text-neutral-500">
                  {replacementPct < 70
                    ? "Ahí está la brecha que conviene cerrar antes del retiro."
                    : "Vas por muy buen camino para mantener tu ritmo de vida."}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-border-default bg-surface-1 p-5 shadow-[var(--elevation-md)] sm:p-6">
              <h3 className="mb-3 text-[15px] font-semibold text-foreground">Por qué planificar temprano importa</h3>
              <ul className="flex flex-col gap-2.5">
                {[
                  "El interés compuesto hace la mayor parte del trabajo — cuanto antes empezás, menos tenés que poner vos.",
                  "Un plan de retiro formal ordena tus aportes y te protege de imprevistos en el camino.",
                  "Revisar tu plan cada año te permite ajustarlo a cambios reales en tu ingreso o tus metas.",
                ].map((text) => (
                  <li key={text} className="flex items-start gap-2.5 text-[13.5px] text-neutral-600">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-strong" aria-hidden="true" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-foreground p-6 text-center text-background shadow-[var(--elevation-lg)]">
              <p className="text-[16px] font-semibold">¡Gracias, {nombre.split(" ")[0]}!</p>
              <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] opacity-70">
                Ya recibimos tus datos — {config.assignedAgentName ?? "tu asesor"} te va a contactar por WhatsApp para armar tu plan real.
              </p>
            </div>

            <p className="px-2 text-center text-[11px] leading-relaxed text-neutral-400">
              Simulación con fines ilustrativos. Las cifras son estimaciones y no constituyen asesoría financiera certificada — los resultados reales
              dependen del plan que contrates y de las condiciones de mercado.
            </p>
          </div>
        )}
      </div>

      {privacyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
          onClick={(e) => e.target === e.currentTarget && setPrivacyOpen(false)}
        >
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface-1 p-6 shadow-[var(--elevation-lg)]">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-[17px] font-semibold text-foreground">Aviso de privacidad</h4>
              <button type="button" onClick={() => setPrivacyOpen(false)} aria-label="Cerrar" className="text-neutral-400 hover:text-foreground">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mb-2.5 text-[13px] leading-relaxed text-neutral-600">
              <strong className="text-foreground">Responsable:</strong> {config.assignedAgentName ?? "el asesor asignado"}. Los datos que compartís
              (nombre y WhatsApp) se usan únicamente para contactarte y darte orientación sobre tu plan de retiro.
            </p>
            <p className="text-[13px] leading-relaxed text-neutral-600">
              No se comparten con terceros ajenos a esta finalidad. Podés solicitar acceder, rectificar, cancelar tu información u oponerte a su uso
              en cualquier momento escribiendo por el mismo WhatsApp.
            </p>
            <Button variant="secondary" fullWidth className="mt-4" onClick={() => setPrivacyOpen(false)}>
              Entendido
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-1 p-4 shadow-[var(--elevation-sm)] transition-transform duration-[var(--duration-fast)] hover:-translate-y-0.5">
      <p className="text-2xl">{emoji}</p>
      <p className="mt-1.5 font-mono text-[17px] font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[12px] text-neutral-500">{label}</p>
    </div>
  );
}

function ScenarioChip({ label, value, highlighted }: { label: string; value: string; highlighted?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 text-center ${
        highlighted ? "border-accent-500 bg-accent-50" : "border-border-default bg-surface-1"
      }`}
    >
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${highlighted ? "text-accent-700" : "text-neutral-500"}`}>{label}</p>
      <p className="mt-1 font-mono text-[13px] font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
