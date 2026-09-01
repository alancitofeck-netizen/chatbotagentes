"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useOnboarding } from "./OnboardingContext";
import { computeLearningStats } from "@/lib/onboarding/progressStats";
import { CircularProgress } from "./CircularProgress";
import { LearningProgress } from "./LearningProgress";

/** "Tu progreso en Growth Link" — visible en el Dashboard, no solo en
 * Perfil/Ayuda (a diferencia de la Fase 1-3, que solo la mostraban ahí).
 * Regla central (§22 del pedido): en cuanto no queda nada pendiente
 * (completado u omitido cuentan como resuelto), este componente
 * directamente no renderiza nada — nunca queda un "100%" ni una tarjeta
 * vacía, el resto del Dashboard ocupa ese espacio solo.
 *
 * Card clara (no "contrast") a propósito: el Dashboard ya tiene una sola
 * tarjeta de contraste oscuro permitida (ExecutiveSummary, el saludo) —
 * el sistema de diseño documentado del proyecto es explícito en "nunca
 * más de una tarjeta de contraste por vista" (14-design-system.md §10),
 * así que esta usa el anillo en violeta sobre una superficie clara en vez
 * de repetir el fondo oscuro de la referencia visual. */
export function DashboardLearningCard() {
  const { steps, getLearningStatus } = useOnboarding();
  const [detailOpen, setDetailOpen] = useState(false);
  const stats = computeLearningStats(steps, getLearningStatus);

  if (stats.isComplete) return null;

  return (
    <>
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <GraduationCap className="size-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-foreground">Tu progreso en Growth Link</h2>
              <Badge variant="accent">Aprendizaje</Badge>
            </div>
            <p className="mt-0.5 text-sm text-neutral-500">
              {stats.completedCount} de {stats.totalCount} módulos aprendidos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative flex shrink-0 items-center justify-center">
            <CircularProgress value={stats.pct} />
            <span className="absolute font-mono text-[13px] font-semibold text-foreground">{stats.pct}%</span>
          </div>

          <div className="flex flex-col gap-0.5 text-xs text-neutral-500">
            <span>
              <span className="font-mono font-medium text-foreground">{stats.pendingCount}</span> pendientes
            </span>
            <span>
              <span className="font-mono font-medium text-foreground">{stats.skippedCount}</span> omitidos
            </span>
          </div>

          <Button size="sm" variant="secondary" onClick={() => setDetailOpen(true)}>
            Ver mi progreso →
          </Button>
        </div>
      </Card>

      <Sheet open={detailOpen} onClose={() => setDetailOpen(false)} title="Tu aprendizaje">
        <div className="p-5">
          <LearningProgress />
        </div>
      </Sheet>
    </>
  );
}
