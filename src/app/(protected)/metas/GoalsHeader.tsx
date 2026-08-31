"use client";

import { Trophy, Target, Gift, History } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";

export function GoalsHeader({
  canManage,
  onCreateGoal,
  onCreateBono,
  onOpenHistory,
}: {
  canManage: boolean;
  onCreateGoal: () => void;
  onCreateBono: () => void;
  onOpenHistory: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-6 lg:px-8">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warning-bg text-warning-strong">
          <Trophy className="size-5" aria-hidden="true" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Metas y Bonificaciones</h1>
            <ModuleHelp description="Acá podés ver tus objetivos y el progreso hacia tus metas — cuánto llevás, tu ranking, y lo que falta para el bono." tourKey="goals-intro" />
          </div>
          <p className="text-sm text-neutral-500">Tu ritmo real, tu ranking, y lo que falta para cada objetivo</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onOpenHistory} data-tour="goals.history-button">
          <History className="size-4" aria-hidden="true" />
          Historial
        </Button>
        {canManage && (
          <>
            <Button size="sm" variant="secondary" onClick={onCreateBono}>
              <Gift className="size-4" aria-hidden="true" />
              Crear Bono
            </Button>
            <Button size="sm" onClick={onCreateGoal} data-tour="goals.create-button">
              <Target className="size-4" aria-hidden="true" />
              Crear Meta
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
