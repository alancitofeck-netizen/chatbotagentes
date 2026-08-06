"use client";

import { Trophy, Target, Gift, History } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
          <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Metas y Bonificaciones</h1>
          <p className="text-sm text-neutral-500">Tu ritmo real, tu ranking, y lo que falta para cada objetivo</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onOpenHistory}>
          <History className="size-4" aria-hidden="true" />
          Historial
        </Button>
        {canManage && (
          <>
            <Button size="sm" variant="secondary" onClick={onCreateBono}>
              <Gift className="size-4" aria-hidden="true" />
              Crear Bono
            </Button>
            <Button size="sm" onClick={onCreateGoal}>
              <Target className="size-4" aria-hidden="true" />
              Crear Meta
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
