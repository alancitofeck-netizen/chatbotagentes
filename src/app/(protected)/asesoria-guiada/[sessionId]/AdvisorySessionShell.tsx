"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { AdvisorySessionDetail } from "@/lib/advisorySessions/queries";
import { ADVISORY_STEPS, ADVISORY_BRANCHES, type AdvisoryStep } from "@/lib/advisorySessions/constants";
import { updateAdvisorySessionStepAction } from "@/lib/advisorySessions/actions";
import type { AdvisorySessionAnalysis } from "@/lib/advisorySessions/aiAnalysis";
import { ProfileStep } from "./steps/ProfileStep";
import { DiscoveryStep } from "./steps/DiscoveryStep";
import { BranchStep } from "./steps/BranchStep";
import { AiAnalysisStep } from "./steps/AiAnalysisStep";
import { SummaryStep } from "./steps/SummaryStep";

const SAVE_DEBOUNCE_MS = 1200;
const STEP_ORDER = ADVISORY_STEPS.map((s) => s.key);

function stepSummary(step: AdvisoryStep, session: AdvisorySessionDetail): string | null {
  switch (step) {
    case "perfil": {
      const p = session.profileData;
      const parts = [p.edad ? `${p.edad} años` : null, p.estadoCivil ? String(p.estadoCivil) : null, p.dependientes ? `${p.dependientes} dependiente(s)` : null].filter(
        (v): v is string => Boolean(v),
      );
      return parts.length ? parts.join(" · ") : null;
    }
    case "descubrimiento": {
      const filled = Object.values(session.discoveryData).filter((v) => v !== null && v !== undefined && v !== "").length;
      return filled > 0 ? `${filled} respuesta(s)` : null;
    }
    case "ramo": {
      if (!session.branchKey) return null;
      return ADVISORY_BRANCHES.find((b) => b.key === session.branchKey)?.label ?? session.branchKey;
    }
    case "analisis_ia":
      return session.aiAnalysis ? "Análisis listo" : null;
    case "resumen":
      return session.status === "completada" ? "Completada" : null;
    default:
      return null;
  }
}

function formatSavedLabel(lastSavedAt: Date | null, now: Date): string {
  if (!lastSavedAt) return "Sin cambios todavía";
  const diffSec = Math.max(0, Math.round((now.getTime() - lastSavedAt.getTime()) / 1000));
  if (diffSec < 3) return "Guardado";
  if (diffSec < 60) return `Guardado hace ${diffSec} segundos`;
  const diffMin = Math.round(diffSec / 60);
  return `Guardado hace ${diffMin} min`;
}

function formatElapsed(startedAt: string, now: Date): string {
  const diffMin = Math.max(0, Math.round((now.getTime() - new Date(startedAt).getTime()) / 60000));
  return `${diffMin} min`;
}

export function AdvisorySessionShell({ session: initialSession }: { session: AdvisorySessionDetail }) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [activeStep, setActiveStep] = useState<AdvisoryStep>(initialSession.currentStep);
  const [now, setNow] = useState(() => new Date());
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Autosave debounced — el cliente manda el objeto acumulado completo de
  // cada grupo de campos cada vez, así que siempre alcanza con un solo
  // UPDATE (ver AdvisorySessionStepPatch en actions.ts).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaving(true);
      updateAdvisorySessionStepAction(session.id, {
        profileData: session.profileData,
        discoveryData: session.discoveryData,
        branchKey: session.branchKey,
        branchAnswers: session.branchAnswers,
        summaryNotes: session.summaryNotes ?? "",
      })
        .then(() => setLastSavedAt(new Date()))
        .finally(() => setSaving(false));
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.profileData, session.discoveryData, session.branchKey, session.branchAnswers, session.summaryNotes]);

  // Transición suave entre pasos — sin cambiar de ruta.
  useEffect(() => {
    Promise.resolve().then(() => setVisible(false));
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, [activeStep]);

  function goToStep(step: AdvisoryStep) {
    setActiveStep(step);
    updateAdvisorySessionStepAction(session.id, { currentStep: step }).catch(() => {});
  }

  function goNext() {
    const idx = STEP_ORDER.indexOf(activeStep);
    if (idx < STEP_ORDER.length - 1) goToStep(STEP_ORDER[idx + 1]);
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      {/* Barra superior */}
      <div className="flex flex-col gap-3 rounded-lg border border-border-default bg-surface-1 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-semibold tracking-[-0.01em] text-foreground">Asesoría Guiada</h1>
            <Badge variant="success" dot>
              En vivo con el cliente
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">Cuestionario inteligente para descubrir necesidades y recomendar productos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="text-right">
            <p className="font-mono text-foreground">{formatElapsed(session.startedAt, now)}</p>
            <p className="text-xs text-neutral-500">Tiempo</p>
          </div>
          <div className="text-right">
            <p className="font-medium text-foreground">{session.contactName ?? "Sin cliente"}</p>
            <p className="text-xs text-neutral-500">Cliente actual</p>
          </div>
          <Badge variant={session.status === "completada" ? "success" : "warning"}>{session.status === "completada" ? "Completada" : "En progreso"}</Badge>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            {saving && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
            {formatSavedLabel(lastSavedAt, now)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Sidebar de progreso */}
        <div className="flex shrink-0 flex-col gap-2 lg:sticky lg:top-4 lg:w-[280px]">
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Progreso</p>
          {ADVISORY_STEPS.map((step, i) => {
            const idx = STEP_ORDER.indexOf(activeStep);
            const status = step.key === activeStep ? "active" : i < idx ? "done" : "pending";
            const summary = stepSummary(step.key, session);
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => goToStep(step.key)}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors duration-150 ${
                  status === "active"
                    ? "border-accent-500 bg-accent-50"
                    : status === "done"
                      ? "border-border-default bg-surface-1 hover:border-accent-300"
                      : "border-border-default bg-surface-1 opacity-70 hover:opacity-100"
                }`}
              >
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    status === "done"
                      ? "bg-success text-white"
                      : status === "active"
                        ? "border-2 border-accent-500 text-accent-700"
                        : "bg-surface-3 text-neutral-400"
                  }`}
                >
                  {status === "done" ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${status === "active" ? "text-accent-700" : "text-foreground"}`}>{step.label}</span>
                  {summary && <span className="block truncate text-xs text-neutral-500">{summary}</span>}
                </span>
              </button>
            );
          })}
        </div>

        {/* Panel principal */}
        <div
          className={`min-w-0 flex-1 rounded-lg border border-border-default bg-surface-1 p-5 transition-all duration-300 ease-out ${
            visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
          }`}
        >
          {activeStep === "perfil" && (
            <ProfileStep data={session.profileData} onChange={(profileData) => setSession((s) => ({ ...s, profileData }))} />
          )}
          {activeStep === "descubrimiento" && (
            <DiscoveryStep data={session.discoveryData} onChange={(discoveryData) => setSession((s) => ({ ...s, discoveryData }))} />
          )}
          {activeStep === "ramo" && (
            <BranchStep
              branchKey={session.branchKey}
              answers={session.branchAnswers}
              onBranchChange={(branchKey) => setSession((s) => ({ ...s, branchKey, branchAnswers: s.branchKey === branchKey ? s.branchAnswers : {} }))}
              onAnswersChange={(branchAnswers) => setSession((s) => ({ ...s, branchAnswers }))}
            />
          )}
          {activeStep === "analisis_ia" && (
            <AiAnalysisStep
              sessionId={session.id}
              analysis={session.aiAnalysis as AdvisorySessionAnalysis | null}
              onAnalyzed={(analysis) => setSession((s) => ({ ...s, aiAnalysis: analysis as unknown as Record<string, unknown> }))}
            />
          )}
          {activeStep === "resumen" && (
            <SummaryStep
              session={session}
              onFinalized={() => {
                setSession((s) => ({ ...s, status: "completada", completedAt: new Date().toISOString() }));
                router.refresh();
              }}
            />
          )}

          {activeStep !== "resumen" && (
            <div className="mt-6 flex justify-end border-t border-border-default pt-4">
              <button type="button" onClick={goNext} className="text-sm font-medium text-accent-600 hover:text-accent-700">
                Siguiente →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
