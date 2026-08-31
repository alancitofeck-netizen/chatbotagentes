"use client";

import Link from "next/link";
import { CheckCircle2, SkipForward, Circle, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { useOnboarding } from "./OnboardingContext";
import { ONBOARDING_STEPS, type OnboardingStepKey } from "@/lib/onboarding/types";

const STEP_META: Record<OnboardingStepKey, { label: string; description: string; ctaLabel: string; href: string }> = {
  profile: { label: "Perfil", description: "Completá tu nombre y foto para que tu equipo te reconozca.", ctaLabel: "Ir a mi perfil", href: "/profile" },
  whatsapp: { label: "WhatsApp", description: "Conectá WhatsApp para recibir y gestionar tus conversaciones directamente desde Growth Link.", ctaLabel: "Conectar WhatsApp", href: "/profile?tab=integrations" },
  manychat: { label: "Instagram / ManyChat", description: "Recibí y analizá los leads que ManyChat gestiona en tu Instagram.", ctaLabel: "Conectar ManyChat", href: "/manychat?tab=configuracion" },
  calendar: { label: "Calendario", description: "Sincronizá Google Calendar para que tus eventos se organicen solos.", ctaLabel: "Conectar Calendario", href: "/profile?tab=integrations" },
  crm: { label: "CRM", description: "Acá vas a gestionar tus leads y oportunidades — vas a aprender a crear el primero apenas entres.", ctaLabel: "Ir al CRM", href: "/crm" },
  automations: { label: "Automatizaciones", description: "Hacé que Growth Link trabaje automáticamente por vos.", ctaLabel: "Ir a Automatizaciones", href: "/automatizaciones" },
};

/** "Configuración de tu Growth Link" (§1-§3) — se auto-muestra una sola vez
 * (isFirstVisit, ver OnboardingContext), y después solo desde el botón de
 * Ayuda o Perfil (§3: "posteriormente debe poder retomarlo"). Ningún paso
 * bloquea: Omitir siempre avanza. */
export function WelcomeOnboardingModal() {
  const { showWelcome, closeWelcome, steps, setStepStatus } = useOnboarding();

  if (!showWelcome) return null;

  const activeIndex = ONBOARDING_STEPS.findIndex((s) => steps[s] === "pending" || steps[s] === "in_progress");
  const allDone = activeIndex === -1;
  const activeStep = allDone ? null : ONBOARDING_STEPS[activeIndex];
  const meta = activeStep ? STEP_META[activeStep] : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" aria-label="Cerrar" onClick={closeWelcome} className="absolute inset-0 bg-neutral-950/50" />
      <div className="relative flex w-full max-w-md flex-col gap-5 rounded-lg border border-border-default bg-surface-1 p-6 shadow-[var(--elevation-lg)]">
        <button type="button" onClick={closeWelcome} aria-label="Cerrar" className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600">
          <X size={18} aria-hidden="true" />
        </button>

        {allDone ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="text-3xl">🎉</span>
            <h2 className="text-lg font-semibold text-foreground">¡Listo! Tu espacio está configurado</h2>
            <p className="text-sm text-neutral-500">Podés seguir explorando Growth Link — cualquier módulo te va a ir guiando la primera vez que entres.</p>
            <Button onClick={closeWelcome}>Empezar</Button>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Bienvenido a Growth Link 👋</h2>
              <p className="mt-1 text-sm text-neutral-500">Vamos a configurar tu espacio de trabajo. No necesitás saber usar Growth Link. Te vamos a acompañar paso a paso.</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-neutral-400 uppercase">Configuración de tu Growth Link</p>
              <ol className="flex flex-col gap-1.5">
                {ONBOARDING_STEPS.map((s, i) => {
                  const status = steps[s];
                  const Icon = status === "completed" ? CheckCircle2 : status === "skipped" ? SkipForward : Circle;
                  return (
                    <li key={s} className={cn("flex items-center gap-2 text-sm", i === activeIndex ? "font-medium text-foreground" : "text-neutral-500")}>
                      <Icon size={15} aria-hidden="true" className={status === "completed" ? "text-success-strong" : status === "skipped" ? "text-neutral-400" : i === activeIndex ? "text-accent-500" : "text-neutral-300"} />
                      {STEP_META[s].label}
                    </li>
                  );
                })}
              </ol>
            </div>

            {meta && activeStep && (
              <div className="flex flex-col gap-3 rounded-md border border-border-default bg-surface-2 p-4">
                <p className="text-sm text-neutral-600">{meta.description}</p>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStepStatus(activeStep, "skipped")}
                    className="text-xs font-medium text-neutral-400 hover:text-neutral-600"
                  >
                    Omitir por ahora →
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStepStatus(activeStep, "completed")}
                      className="text-xs font-medium text-neutral-500 hover:text-foreground"
                    >
                      Listo, ya lo hice
                    </button>
                    <Link href={meta.href} onClick={() => setStepStatus(activeStep, "in_progress")}>
                      <Button size="sm">{meta.ctaLabel}</Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
