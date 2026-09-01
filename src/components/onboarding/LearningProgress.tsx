"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, MessageCircle, ChevronRight, Lightbulb } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOnboarding } from "./OnboardingContext";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ONBOARDING_STEPS, type OnboardingStepKey } from "@/lib/onboarding/types";
import { STEP_META, STEP_TOUR_KEY } from "@/lib/onboarding/stepMeta";
import { ALL_TOURS } from "@/lib/tours/registry";
import { getModuleRoute } from "@/lib/tours/moduleRoute";
import { SIDEBAR_MODULES } from "@/lib/navigation/sidebarConfig";
import { computeLearningStats } from "@/lib/onboarding/progressStats";

const STEP_ICON: Partial<Record<OnboardingStepKey, LucideIcon>> = { profile: User, whatsapp: MessageCircle };

/** Ícono real del módulo — reusa SIDEBAR_MODULES (ya tiene uno por
 * módulo), nunca un mapa nuevo inventado a mano. "profile"/"whatsapp" no
 * son módulos del sidebar, así que esos 2 son la única excepción manual. */
function getModuleIcon(moduleKey: string): LucideIcon {
  return SIDEBAR_MODULES.find((m) => m.id === moduleKey)?.icon ?? Lightbulb;
}

function getStepIcon(step: OnboardingStepKey): LucideIcon {
  return STEP_ICON[step] ?? getModuleIcon(step);
}

type RowStatus = "pending" | "in_progress" | "completed" | "skipped";

const STATUS_META: Record<RowStatus, { label: string; cta: string; dialogCta: string; badgeVariant: BadgeVariant; iconBg: string; iconColor: string }> = {
  completed: { label: "Completado", cta: "Volver a ver", dialogCta: "Volver a ver tutorial", badgeVariant: "success", iconBg: "bg-success-bg", iconColor: "text-success-strong" },
  in_progress: { label: "En progreso", cta: "Continuar", dialogCta: "Continuar tutorial", badgeVariant: "accent", iconBg: "bg-accent-100", iconColor: "text-accent-700" },
  skipped: { label: "Omitido", cta: "Repetir tutorial", dialogCta: "Repetir tutorial", badgeVariant: "neutral", iconBg: "bg-surface-3", iconColor: "text-neutral-400" },
  pending: { label: "Pendiente", cta: "Comenzar", dialogCta: "Comenzar tutorial", badgeVariant: "neutral", iconBg: "bg-surface-3", iconColor: "text-neutral-400" },
};

const FILTERS: { key: "all" | RowStatus; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "completed", label: "Completados" },
  { key: "in_progress", label: "En progreso" },
  { key: "pending", label: "Pendientes" },
  { key: "skipped", label: "Omitidos" },
];

interface LearningRowData {
  key: string;
  icon: LucideIcon;
  label: string;
  description: string;
  status: RowStatus;
  onOpen: () => void;
}

interface IntroState {
  label: string;
  description: string;
  status: string;
  onConfirm: () => void;
}

/** "Tu aprendizaje" — combina el checklist inicial (6 pasos fijos) con los
 * tours de módulo ya registrados (ALL_TOURS), sin inventar módulos que
 * todavía no tienen tour armado. Reusado en HelpCenterPanel, Perfil y el
 * Sheet que abre DashboardLearningCard.
 *
 * Cada fila es clickeable y reabre el tutorial correspondiente — nunca una
 * segunda implementación de tour, siempre `startTour()` (mismo motor que
 * el resto de la app). "Completado" y "Omitido" no son estados
 * definitivos: repetir un omitido lo pasa a 'in_progress' visible;
 * repetir un completado se queda 'completed' todo el tiempo (es una
 * revisión, no un aprendizaje nuevo). */
export function LearningProgress({ showHelpCta = true, onNavigateAway }: { showHelpCta?: boolean; onNavigateAway?: () => void }) {
  const { steps, getLearningStatus, setStepStatus, setLearningStatus, startTour, openHelpCenter } = useOnboarding();
  const router = useRouter();
  const stats = computeLearningStats(steps, getLearningStatus);
  const [filter, setFilter] = useState<"all" | RowStatus>("all");
  const [intro, setIntro] = useState<IntroState | null>(null);

  // Lista barata de recalcular (mapeos simples, sin trabajo pesado) — no
  // hace falta useMemo, y evita el problema de listar como dependencia
  // funciones (openStepIntro/openTourIntro) definidas más abajo en este
  // mismo componente.
  const stepRows: LearningRowData[] = ONBOARDING_STEPS.map((s) => ({
    key: `step:${s}`,
    icon: getStepIcon(s),
    label: STEP_META[s].label,
    description: STEP_META[s].description,
    status: steps[s] as RowStatus,
    onOpen: () => openStepIntro(s),
  }));
  const tourRows: LearningRowData[] = ALL_TOURS.map((tour) => ({
    key: `tour:${tour.key}`,
    icon: getModuleIcon(tour.moduleKey),
    label: tour.title,
    description: tour.steps[0]?.description ?? "Te vamos a mostrar cómo funciona, paso a paso.",
    status: getLearningStatus("tour", tour.key) as RowStatus,
    onOpen: () => openTourIntro(tour),
  }));
  const rows: LearningRowData[] = [...stepRows, ...tourRows];

  const filteredRows = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  function openStepIntro(step: OnboardingStepKey) {
    const meta = STEP_META[step];
    const status = steps[step];
    setIntro({
      label: meta.label,
      description: meta.description,
      status,
      onConfirm: () => {
        onNavigateAway?.();
        if (status !== "completed") setStepStatus(step, "in_progress");
        router.push(meta.href);
        const tourKey = STEP_TOUR_KEY[step];
        if (tourKey) startTour(tourKey);
        setIntro(null);
      },
    });
  }

  function openTourIntro(tour: (typeof ALL_TOURS)[number]) {
    const status = getLearningStatus("tour", tour.key);
    setIntro({
      label: tour.title,
      description: tour.steps[0]?.description ?? "Te vamos a mostrar cómo funciona, paso a paso.",
      status,
      onConfirm: () => {
        onNavigateAway?.();
        if (status !== "completed") setLearningStatus("tour", tour.key, "in_progress");
        const route = getModuleRoute(tour.moduleKey);
        if (route) router.push(route);
        startTour(tour.key);
        setIntro(null);
      },
    });
  }

  function goToHelpCenter() {
    onNavigateAway?.();
    openHelpCenter();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 flex flex-col gap-3 bg-surface-1 pb-1">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Tu progreso en Growth Link</span>
            <span className="font-mono text-neutral-500">{stats.pct}%</span>
          </div>
          <ProgressBar value={stats.pct} />
          <p className="mt-1.5 text-xs text-neutral-500">
            {stats.completedCount} de {stats.totalCount} módulos aprendidos
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const count = f.key === "all" ? stats.totalCount : f.key === "completed" ? stats.completedCount : f.key === "in_progress" ? stats.inProgressCount : f.key === "pending" ? stats.pendingCount : stats.skippedCount;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)]",
                  active ? "border-accent-500 bg-accent-500 text-white" : "border-border-default bg-surface-1 text-neutral-600 hover:bg-surface-2",
                )}
              >
                {f.label}
                <span className={cn("font-mono", active ? "text-white/80" : "text-neutral-400")}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        {filteredRows.length === 0 && <li className="py-6 text-center text-sm text-neutral-400">Nada acá por ahora.</li>}
        {filteredRows.map(({ key, ...row }) => (
          <LearningRow key={key} {...row} />
        ))}
      </ul>

      {showHelpCta && (
        <div className="flex flex-col gap-3 rounded-lg bg-accent-50 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
              <Lightbulb size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">¿Necesitás ayuda?</p>
              <p className="text-xs text-neutral-500">Explorá guías rápidas o contactá al soporte.</p>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={goToHelpCenter}>
            Ir al centro de ayuda →
          </Button>
        </div>
      )}

      {intro && (
        <ConfirmDialog
          open
          title={intro.label}
          description={intro.description}
          confirmLabel={STATUS_META[intro.status as RowStatus]?.dialogCta ?? "Comenzar tutorial"}
          cancelLabel="Cerrar"
          onConfirm={intro.onConfirm}
          onCancel={() => setIntro(null)}
        />
      )}
    </div>
  );
}

function LearningRow({ icon: Icon, label, description, status, onOpen }: Omit<LearningRowData, "key">) {
  const meta = STATUS_META[status];
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-start gap-3 rounded-lg border border-transparent p-2.5 text-left transition-colors duration-[var(--duration-fast)] hover:border-border-default hover:bg-surface-2"
      >
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", meta.iconBg)}>
          <Icon size={16} className={meta.iconColor} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{label}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">{description}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant={meta.badgeVariant} dot>
              {meta.label}
            </Badge>
            <span className="text-xs font-medium whitespace-nowrap text-accent-600 opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100 group-focus-visible:opacity-100">
              {meta.cta}
            </span>
          </div>
        </div>
        <ChevronRight
          size={16}
          aria-hidden="true"
          className="mt-1.5 shrink-0 text-neutral-300 transition-transform duration-[var(--duration-fast)] motion-safe:group-hover:translate-x-0.5"
        />
      </button>
    </li>
  );
}
