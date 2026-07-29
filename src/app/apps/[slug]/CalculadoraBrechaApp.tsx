"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Lock,
  Share2,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { calculateBrechaRetiro, type Regimen } from "@/lib/miniApps/brechaEngine";
import { soften, useCountUp, MiniAppButton, MiniAppInput, DecorativeBackground, AgentBar, StepShell } from "@/components/miniApps/uiPrimitives";
import { submitMiniAppLeadFromHostedPage } from "@/lib/miniApps/actions";
import type { PublicMiniAppView } from "@/lib/miniApps/queries";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
}

/** Disclaimer — verbatim from the source calculator, shared across all 3
 * régimen branches. */
const DISCLAIMER =
  "Los montos son estimaciones con fines informativos para iniciar una asesoría, no constituyen un cálculo oficial del IMSS ni una oferta. El cálculo real depende de tu historial laboral, semanas cotizadas y régimen. Reglas de referencia: LSS 1973 (Art. 167) y LSS 1997 (Art. 154/162, reforma 2020).";

type BrechaStepKey = "intro" | "regimen" | "datos" | "captura";
type Phase = "wizard" | "calculando" | "resultado";

const REGIMEN_OPTIONS: { value: Regimen; year: string; label: string; description: string }[] = [
  { value: "73", year: "Antes de jul 1997", label: "Régimen Ley 73", description: "El IMSS te paga una pensión vitalicia calculada sobre tu salario." },
  { value: "97", year: "Desde jul 1997", label: "Régimen Ley 97", description: "Tu pensión depende del saldo ahorrado en tu AFORE." },
  { value: "unknown", year: "No lo sé", label: "No estoy seguro", description: "Te ayudamos a estimarlo y tu asesor lo confirma con tu historial." },
];

const REGIMEN_WHATSAPP_LABEL: Record<Regimen, string> = { "73": "Ley 73", "97": "Ley 97", unknown: "por confirmar" };

/** Big-tile chooser for the régimen step — mirrors the source calculator's
 * `.choice`/`.yr` visual structure (year badge + title + description) using
 * --ma-* tokens instead of hardcoded hex/Fraunces styling. Selecting one
 * advances immediately (no separate "Continuar" button on this step,
 * matching the original's own `setRegimen()` behavior). */
function RegimenChoiceCard({ year, label, description, onClick }: { year: string; label: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition-colors duration-150"
      style={{ borderColor: "var(--ma-border-strong)", background: "var(--ma-background-surface)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--ma-button-primary-bg)";
        e.currentTarget.style.background = "var(--ma-background-surface-alt)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--ma-border-strong)";
        e.currentTarget.style.background = "var(--ma-background-surface)";
      }}
    >
      <span
        className="flex shrink-0 items-center justify-center rounded-lg px-2.5 py-1.5 text-center text-[13px] font-semibold leading-tight whitespace-pre-line"
        style={{ background: "var(--ma-button-primary-bg)", color: "var(--ma-button-primary-text)", minWidth: "68px" }}
      >
        {year}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[15.5px] font-semibold" style={{ color: "var(--ma-title-color)" }}>
          {label}
        </span>
        <span className="text-[13px] leading-snug" style={{ color: "var(--ma-text-muted)" }}>
          {description}
        </span>
      </span>
    </button>
  );
}

/** Static, unblurred-on-purpose placeholder — NOT a live computed number
 * (the original doesn't compute anything until after consent+submit
 * either). A blurred tease behind a lock icon, matching the source's own
 * "🔒 Desbloquea tu número exacto" gate. */
function BlurredTeaser() {
  return (
    <div className="relative mb-5 overflow-hidden rounded-xl border" style={{ borderColor: "var(--ma-border)" }}>
      <div className="p-4" style={{ background: "var(--ma-gradient-hero)" }}>
        <p className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: "var(--ma-gradient-hero-text)", opacity: 0.7 }}>
          Tu brecha estimada
        </p>
        <p
          className="mt-1.5 font-mono text-4xl font-bold tabular-nums"
          style={{ color: "var(--ma-gradient-hero-text)", filter: "blur(6px)" }}
          aria-hidden="true"
        >
          $XX,XXX
        </p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--ma-gradient-hero-text)", opacity: 0.8 }}>
          al mes que te faltarían
        </p>
      </div>
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: `linear-gradient(180deg, ${soften("--ma-background-page", 20)}, ${soften("--ma-background-page", 75)})` }}
      >
        <span
          className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
          style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", color: "var(--ma-title-color)" }}
        >
          <Lock className="size-3.5" aria-hidden="true" /> Desbloquea tu número exacto
        </span>
      </div>
    </div>
  );
}

/** Two animated bar columns ("tendrías" vs "meta") — plain divs with
 * height animated via requestAnimationFrame on mount, NOT a charting
 * library, matching the source calculator's own non-chart-library
 * "horizonte" visual. */
function HorizonteBars({ have, need, haveLbl, needLbl, active }: { have: number; need: number; haveLbl: string; needLbl: string; active: boolean }) {
  const [heights, setHeights] = useState({ have: 0, need: 0 });
  useEffect(() => {
    if (!active) return;
    const max = Math.max(have, need) || 1;
    const target = { have: Math.max(8, Math.round((have / max) * 100)), need: Math.max(8, Math.round((need / max) * 100)) };
    const raf = requestAnimationFrame(() => setHeights(target));
    return () => cancelAnimationFrame(raf);
  }, [have, need, active]);

  return (
    <div className="mt-5 flex h-[150px] items-end gap-4 border-b" style={{ borderColor: soften("--ma-gradient-hero-text", 25) }}>
      {[
        { pct: heights.have, val: have, lbl: haveLbl, color: "--ma-chart-series-primary" },
        { pct: heights.need, val: need, lbl: needLbl, color: "--ma-chart-series-secondary" },
      ].map(({ pct, val, lbl, color }) => (
        <div key={lbl} className="flex h-full flex-1 flex-col items-center justify-end">
          <div
            className="w-[62%] rounded-t-lg transition-[height] duration-1000"
            style={{ height: `${pct}%`, background: `var(${color})`, transitionTimingFunction: "cubic-bezier(.22,1,.36,1)" }}
          />
          <p className="mt-2 text-center text-[11.5px]" style={{ color: soften("--ma-gradient-hero-text", 75) }}>
            <span className="block font-mono text-[16px] font-semibold" style={{ color: "var(--ma-gradient-hero-text)" }}>
              {formatCurrency(val)}
            </span>
            {lbl}
          </p>
        </div>
      ))}
    </div>
  );
}

function GapCalloutCard({ gap, gapLbl, gapPer, gapExpl, active }: { gap: number; gapLbl: string; gapPer: string; gapExpl: string; active: boolean }) {
  const gapDisplay = useCountUp(gap, active);
  return (
    <div className="mt-5 rounded-2xl p-5" style={{ background: soften("--ma-button-primary-bg", 12), border: "1px solid var(--ma-button-primary-bg)" }}>
      <p className="text-[12px] font-bold tracking-[0.06em] uppercase" style={{ color: "var(--ma-button-primary-bg)" }}>
        {gapLbl}
      </p>
      <p className="mt-1.5 font-mono text-4xl font-bold tabular-nums" style={{ color: "var(--ma-title-color)" }}>
        {formatCurrency(gapDisplay)}
      </p>
      <p className="mt-1 text-[13px]" style={{ color: "var(--ma-text-muted)" }}>
        {gapPer}
      </p>
      {/* gapExpl is app-authored copy (brechaEngine.ts), never user input */}
      <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--ma-text-color)" }} dangerouslySetInnerHTML={{ __html: gapExpl }} />
    </div>
  );
}

function FactsList({ facts }: { facts: [string, string, string] }) {
  return (
    <ul className="mt-5 flex flex-col gap-3">
      {facts.map((fact) => (
        <li key={fact} className="flex items-start gap-2.5 text-[13.5px]" style={{ color: "var(--ma-text-muted)" }}>
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" style={{ color: "var(--ma-chart-series-secondary)" }} aria-hidden="true" />
          {/* facts are app-authored copy (brechaEngine.ts), never user input */}
          <span dangerouslySetInnerHTML={{ __html: fact }} />
        </li>
      ))}
    </ul>
  );
}

export function CalculadoraBrechaApp({ app }: { app: PublicMiniAppView<"calculadora_brecha_retiro"> }) {
  const { config } = app;
  const startedAtRef = useRef<number | null>(null);
  const leadIdRef = useRef<string | null>(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
    fetch(`/api/public/mini-apps/${app.slug}/visit`, { method: "POST", keepalive: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps: BrechaStepKey[] = ["intro", "regimen", "datos", "captura"];
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("wizard");
  const currentStep = steps[stepIndex];
  const progressPct = phase === "wizard" ? Math.round((stepIndex / steps.length) * 100) : 100;

  const [regimen, setRegimenState] = useState<Regimen | null>(null);
  const [edad, setEdad] = useState("");
  const [retiro, setRetiro] = useState("");
  const [sueldo, setSueldo] = useState("");
  const [semanas, setSemanas] = useState("");
  const [ahorro, setAhorro] = useState("");
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [consentWarning, setConsentWarning] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  function goBack() {
    setFieldErrors({});
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function selectRegimen(r: Regimen) {
    setRegimenState(r);
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  }

  function validateDatos(): boolean {
    const e = Number(edad);
    const r = Number(retiro);
    const s = Number(sueldo);
    const errs: Record<string, string> = {};
    if (!(e >= 18 && e <= 75)) errs.edad = "Ingresa una edad entre 18 y 75.";
    if (!(r >= 60 && r <= 75 && r > e)) errs.retiro = "La edad legal es 60 (cesantía) o 65 (vejez).";
    if (!(s > 0)) errs.sueldo = "Ingresa un monto válido.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goToCaptura() {
    if (validateDatos()) setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  }

  function validateCaptura(): boolean {
    const errs: Record<string, string> = {};
    if (nombre.trim().length < 2) errs.nombre = "Escribe tu nombre.";
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length < 10) errs.whatsapp = "Ingresa un WhatsApp de 10 dígitos.";
    if (email.trim().length > 0 && !/^[^@]+@[^@]+\.[^@]+$/.test(email.trim())) errs.email = "Revisa tu correo.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleReveal() {
    if (!validateCaptura()) return;
    if (!consentimiento) {
      setConsentWarning(true);
      setTimeout(() => setConsentWarning(false), 1800);
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
        email: email.trim() || undefined,
        consentimiento: true,
        consentimiento_fecha: nowIso,
        regimen,
        edad: Number(edad),
        retiro_deseado: Number(retiro),
        sueldo_mensual: Number(sueldo),
        semanas_cotizadas: semanas.trim() === "" ? undefined : Number(semanas),
        ahorro_mensual: ahorro.trim() === "" ? undefined : Number(ahorro),
        duration_seconds: Math.round((Date.now() - (startedAtRef.current ?? Date.now())) / 1000),
      });
      if (!outcome.ok) {
        setError("No pudimos guardar tus datos. Intentá de nuevo en unos minutos.");
        setPhase("wizard");
        return;
      }
      leadIdRef.current = outcome.leadId ?? null;
      await new Promise((r) => setTimeout(r, 900));
      setPhase("resultado");
    } catch {
      setError("No pudimos guardar tus datos. Intentá de nuevo en unos minutos.");
      setPhase("wizard");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = "Descubrí cuánto me alcanzaría mi pensión del IMSS con esta calculadora. Pruébala:";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: app.name, text, url });
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

  const result = regimen
    ? calculateBrechaRetiro({
        regimen,
        edad: Number(edad) || 0,
        retiroDeseado: Number(retiro) || 0,
        sueldoMensual: Number(sueldo) || 0,
        semanasCotizadas: semanas.trim() === "" ? null : Number(semanas),
        ahorroMensual: Number(ahorro) || 0,
      })
    : null;

  const agentName = config.assignedAgentName ?? "tu asesor";
  const showAhorro = regimen === "97" || regimen === "unknown";

  const whatsappHref = (() => {
    if (!result || !config.whatsappAsesor) return undefined;
    const primerNombre = nombre.split(" ")[0] || "";
    const agentePrimerNombre = agentName.split(" ")[0];
    const message =
      `Hola ${agentePrimerNombre}, soy ${primerNombre}. Hice la calculadora de retiro y quiero platicar mis opciones.\n\n` +
      `• Régimen: ${regimen ? REGIMEN_WHATSAPP_LABEL[regimen] : "por confirmar"}\n` +
      `• Edad: ${edad} | Retiro deseado: ${retiro}\n` +
      `• Pensión estimada: ${formatCurrency(result.have)}\n` +
      `• ${result.gapLbl}: ${formatCurrency(result.gap)}\n\n` +
      `¿Cuándo podríamos hablar?`;
    return `https://wa.me/${config.whatsappAsesor}?text=${encodeURIComponent(message)}`;
  })();

  return (
    <div
      data-mini-app-theme="true"
      className={`relative flex min-h-screen justify-center px-4 py-8 sm:py-12 ${phase === "resultado" ? "items-start" : "items-center"}`}
    >
      <DecorativeBackground />
      <div className={`flex w-full flex-col gap-4 transition-[max-width] duration-300 ${phase === "resultado" ? "max-w-2xl" : "max-w-md"}`}>
        <AgentBar app={app} badgeLabel="Calculadora" licenseBadge={config.licenseBadge || undefined} />

        {phase !== "resultado" && (
          <div className="px-1">
            <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--ma-background-surface-alt)" }}>
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${progressPct}%`, background: "var(--ma-button-primary-bg)" }}
              />
            </div>
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
                Calculando tu brecha…
              </p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--ma-text-muted)" }}>
                Estamos armando tu diagnóstico personalizado.
              </p>
            </div>
          </div>
        )}

        {phase === "wizard" && (
          <div
            className="rounded-2xl p-6 sm:p-7"
            style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-lg)" }}
          >
            {currentStep !== "intro" && (
              <button
                type="button"
                onClick={goBack}
                className="mb-4 flex items-center gap-1.5 text-[13px] font-medium"
                style={{ color: "var(--ma-text-muted)" }}
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" /> Atrás
              </button>
            )}

            {currentStep === "intro" && (
              <div className="flex flex-col items-center gap-5 py-4 text-center motion-safe:animate-[fade-in-up_0.35s_ease]">
                <span
                  className="flex size-16 items-center justify-center rounded-2xl"
                  style={{ background: "var(--ma-gradient-hero)", color: "var(--ma-gradient-hero-text)" }}
                >
                  <Calculator className="size-7" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: "var(--ma-button-primary-bg)" }}>
                    Diagnóstico de retiro · 2 min
                  </p>
                  <h2 className="mt-2 text-[21px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ma-title-color)" }}>
                    ¿La pensión del IMSS te va a alcanzar?
                  </h2>
                  <p className="mx-auto mt-2.5 max-w-xs text-[14px] leading-relaxed" style={{ color: "var(--ma-text-muted)" }}>
                    La mayoría de los mexicanos recibirá menos del 40% de su último sueldo como pensión. Descubre tu número real y qué puedes
                    hacer hoy.
                  </p>
                </div>
                <MiniAppButton type="button" onClick={() => setStepIndex(1)}>
                  Calcular mi pensión <ArrowRight className="size-4" aria-hidden="true" />
                </MiniAppButton>
                <p className="text-[12px]" style={{ color: "var(--ma-text-muted)" }}>
                  Gratis y sin compromiso. Tus datos solo los ve tu asesor.
                </p>
              </div>
            )}

            {currentStep === "regimen" && (
              <StepShell icon={CalendarClock} title="¿Cuándo empezaste a cotizar al IMSS?" subtitle="Es la fecha de tu primer trabajo formal registrado. Define cómo se calcula tu pensión.">
                <div className="flex flex-col gap-2.5">
                  {REGIMEN_OPTIONS.map((opt) => (
                    <RegimenChoiceCard
                      key={opt.value}
                      year={opt.year}
                      label={opt.label}
                      description={opt.description}
                      onClick={() => selectRegimen(opt.value)}
                    />
                  ))}
                </div>
              </StepShell>
            )}

            {currentStep === "datos" && (
              <StepShell icon={Wallet} title="Cuéntanos de ti" subtitle="Solo lo esencial para estimar tu pensión.">
                <div className="flex flex-col gap-4">
                  <MiniAppInput
                    label="Tu edad actual"
                    type="number"
                    inputMode="numeric"
                    value={edad}
                    onChange={(e) => setEdad(e.target.value)}
                    placeholder="Ej. 42"
                    error={fieldErrors.edad}
                  />
                  <MiniAppInput
                    label="¿A qué edad quieres retirarte?"
                    type="number"
                    inputMode="numeric"
                    value={retiro}
                    onChange={(e) => setRetiro(e.target.value)}
                    placeholder="Ej. 65"
                    error={fieldErrors.retiro}
                  />
                  <MiniAppInput
                    label="Tu sueldo mensual actual (bruto aproximado)"
                    type="number"
                    inputMode="numeric"
                    prefix="$"
                    value={sueldo}
                    onChange={(e) => setSueldo(e.target.value)}
                    placeholder="Ej. 25000"
                    error={fieldErrors.sueldo}
                  />
                  <MiniAppInput
                    label="Semanas cotizadas (aprox., si no sabes déjalo vacío)"
                    type="number"
                    inputMode="numeric"
                    value={semanas}
                    onChange={(e) => setSemanas(e.target.value)}
                    placeholder="Ej. 900"
                  />
                  {showAhorro && (
                    <MiniAppInput
                      label="¿Cuánto ahorras al mes para tu retiro? (aparte del IMSS)"
                      type="number"
                      inputMode="numeric"
                      prefix="$"
                      value={ahorro}
                      onChange={(e) => setAhorro(e.target.value)}
                      placeholder="Ej. 0"
                    />
                  )}
                </div>
                <div className="mt-6">
                  <MiniAppButton type="button" onClick={goToCaptura} className="w-full">
                    Ver mi resultado <ArrowRight className="size-4" aria-hidden="true" />
                  </MiniAppButton>
                </div>
              </StepShell>
            )}

            {currentStep === "captura" && (
              <StepShell icon={ShieldCheck} title="Tu resultado está listo" subtitle="Déjanos dónde enviártelo y con quién comentar tus opciones.">
                <BlurredTeaser />
                <div className="flex flex-col gap-4">
                  <MiniAppInput label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" error={fieldErrors.nombre} />
                  <MiniAppInput
                    label="WhatsApp"
                    type="tel"
                    inputMode="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="10 dígitos"
                    error={fieldErrors.whatsapp}
                  />
                  <MiniAppInput
                    label="Correo (opcional)"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@ejemplo.com"
                    error={fieldErrors.email}
                  />
                </div>
                <label
                  className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl p-4"
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
                    Acepto que <strong style={{ color: "var(--ma-text-color)" }}>{agentName}</strong> use mis datos para contactarme sobre mi
                    retiro, conforme al{" "}
                    {config.avisoPrivacidadUrl ? (
                      <a
                        href={config.avisoPrivacidadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                        style={{ color: "var(--ma-button-primary-bg)" }}
                      >
                        Aviso de Privacidad
                      </a>
                    ) : (
                      "Aviso de Privacidad"
                    )}{" "}
                    (LFPDPPP).
                  </span>
                </label>
                {error && (
                  <p className="mt-3 text-[13px]" style={{ color: "var(--color-error-strong)" }}>
                    {error}
                  </p>
                )}
                <div className="mt-5">
                  <MiniAppButton type="button" onClick={handleReveal} loading={submitting} className="w-full">
                    {consentWarning ? (
                      "Marca la casilla para continuar"
                    ) : (
                      <>
                        Ver mi brecha de retiro <ArrowRight className="size-4" aria-hidden="true" />
                      </>
                    )}
                  </MiniAppButton>
                </div>
              </StepShell>
            )}
          </div>
        )}

        {phase === "resultado" && result && (
          <div className="flex flex-col gap-5 motion-safe:animate-[fade-in-up_0.4s_ease]">
            <div className="overflow-hidden rounded-2xl p-7 sm:p-9" style={{ background: "var(--ma-gradient-hero)", boxShadow: "var(--ma-shadow-lg)" }}>
              <p className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: "var(--ma-gradient-hero-text)", opacity: 0.75 }}>
                {result.resEyebrow}
              </p>
              <h2 className="mt-2 text-[22px] font-semibold" style={{ color: "var(--ma-gradient-hero-text)" }}>
                {(nombre.split(" ")[0] || "").trim()}
                {result.resTitleSuffix}
              </h2>
              <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--ma-gradient-hero-text)", opacity: 0.85 }}>
                {result.resSub}
              </p>

              <HorizonteBars have={result.have} need={result.need} haveLbl={result.haveLbl} needLbl={result.needLbl} active />
            </div>

            <GapCalloutCard gap={result.gap} gapLbl={result.gapLbl} gapPer={result.gapPer} gapExpl={result.gapExpl} active />

            <div
              className="rounded-2xl p-6 sm:p-7"
              style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-lg)" }}
            >
              <div className="mb-1 flex items-center gap-2">
                <TrendingUp className="size-4" style={{ color: "var(--ma-icon-color)" }} aria-hidden="true" />
                <h3 className="text-[16px] font-semibold" style={{ color: "var(--ma-title-color)" }}>
                  Lo que necesitás saber
                </h3>
              </div>
              <FactsList facts={result.facts} />
            </div>

            <div className="flex flex-col gap-2.5">
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[15px] font-semibold text-white transition-opacity duration-150 hover:opacity-90"
                  style={{ background: "#25D366" }}
                >
                  Platicar con {agentName.split(" ")[0]} por WhatsApp
                </a>
              )}
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium"
                style={{ color: "var(--ma-text-muted)" }}
              >
                {shareCopied ? (
                  <>
                    <CheckCircle2 className="size-3.5" aria-hidden="true" /> ¡Enlace copiado!
                  </>
                ) : (
                  <>
                    <Share2 className="size-3.5" aria-hidden="true" /> Compartir con alguien que le sirva
                  </>
                )}
              </button>
              <p className="text-center text-[12px]" style={{ color: "var(--ma-text-muted)" }}>
                Tu asesor te dará el cálculo exacto y tus opciones para cerrar la brecha, sin costo.
              </p>
            </div>

            <p className="px-2 text-center text-[11px] leading-relaxed" style={{ color: "var(--ma-text-muted)" }}>
              {DISCLAIMER}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
