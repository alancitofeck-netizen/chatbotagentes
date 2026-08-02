"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/lib/utils/format";
import {
  getLeadSheetSyncRunsAction,
  getLeadSheetSyncRunErrorsAction,
} from "@/lib/leadSync/actions";
import type { LeadSheetSyncRunRow, LeadSheetSyncRowErrorRow } from "@/lib/leadSync/queries";

const STATUS_BADGE: Record<LeadSheetSyncRunRow["status"], { variant: BadgeVariant; label: string }> = {
  running: { variant: "info", label: "En curso" },
  ok: { variant: "success", label: "OK" },
  error: { variant: "error", label: "Con errores" },
};

const TRIGGER_LABEL: Record<LeadSheetSyncRunRow["trigger"], string> = {
  cron: "Automático",
  manual: "Manual",
};

function RunRow({ run }: { run: LeadSheetSyncRunRow }) {
  const [expanded, setExpanded] = useState(false);
  const [errors, setErrors] = useState<LeadSheetSyncRowErrorRow[] | null>(null);
  const badge = STATUS_BADGE[run.status];

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && errors === null && run.errorCount > 0) {
      getLeadSheetSyncRunErrorsAction(run.id).then(setErrors);
    }
  }

  return (
    <li className="rounded-md border border-border-default">
      <button
        type="button"
        onClick={toggle}
        disabled={run.errorCount === 0}
        className="flex w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-default"
      >
        {run.errorCount > 0 ? (
          expanded ? (
            <ChevronDown size={14} className="shrink-0 text-neutral-500" aria-hidden="true" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-neutral-500" aria-hidden="true" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground">{formatRelativeTime(run.startedAt)}</span>
            <Badge variant="neutral">{TRIGGER_LABEL[run.trigger]}</Badge>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="text-[12px] text-neutral-500">
            {run.rowsRead} leída(s) · {run.createdCount} creado(s) · {run.updatedCount} actualizado(s) · {run.skippedCount} omitido(s)
            {run.errorCount > 0 ? ` · ${run.errorCount} con error` : ""}
          </p>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border-default px-3 py-2">
          {errors === null ? (
            <p className="text-[12px] text-neutral-500">Cargando…</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {errors.map((e) => (
                <li key={e.id} className="text-[12px] text-neutral-600">
                  <span className="font-medium text-foreground">Fila {e.rowNumber}</span>
                  {e.rowKey ? ` (${e.rowKey})` : ""}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/** Pantalla de historial pedida por el usuario — no es un dashboard nuevo,
 * es un Sheet que se abre por conexión (misma UI mínima que el resto de
 * Fase A), listando las últimas corridas con sus conteos y, si una corrida
 * tuvo filas fallidas, el motivo de cada una. */
export function LeadSheetSyncHistorySheet({ connectionId, sheetName, onClose }: { connectionId: string; sheetName: string; onClose: () => void }) {
  const [runs, setRuns] = useState<LeadSheetSyncRunRow[] | null>(null);

  useEffect(() => {
    getLeadSheetSyncRunsAction(connectionId).then(setRuns);
  }, [connectionId]);

  return (
    <Sheet open onClose={onClose} title={`Historial — ${sheetName}`} className="max-w-lg">
      <div className="flex flex-col gap-3 p-5">
        {runs === null ? (
          <p className="text-[13px] text-neutral-500">Cargando…</p>
        ) : runs.length === 0 ? (
          <p className="text-[13px] text-neutral-500">Todavía no hay corridas registradas para esta conexión.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
