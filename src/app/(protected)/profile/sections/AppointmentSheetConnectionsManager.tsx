"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, RefreshCw, Trash2, Pause, Play, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import { formatRelativeTime } from "@/lib/utils/format";
import {
  getAppointmentSheetConnectionsAction,
  pauseAppointmentSheetConnectionAction,
  deleteAppointmentSheetConnectionAction,
  triggerManualAppointmentSheetSyncAction,
  getAppointmentSheetRowErrorsAction,
} from "@/lib/appointmentSync/actions";
import type { AppointmentSheetConnectionRow, AppointmentSheetRowErrorItem } from "@/lib/appointmentSync/queries";
import { AppointmentSheetConnectionWizard } from "./AppointmentSheetConnectionWizard";

const STATUS_BADGE: Record<AppointmentSheetConnectionRow["lastSyncStatus"], { variant: "success" | "warning" | "error"; label: string }> = {
  ok: { variant: "success", label: "Sincronizado" },
  pending: { variant: "warning", label: "Pendiente" },
  error: { variant: "error", label: "Error" },
};

/** Vive dentro de la card "Google Sheets" de IntegrationsSection.tsx, mismo
 * criterio que LeadSheetConnectionsManager — reutiliza la misma conexión
 * OAuth 'google_sheets', no pide "Conectar Google" de nuevo. */
export function AppointmentSheetConnectionsManager({ canManage, accountConnected }: { canManage: boolean; accountConnected: boolean }) {
  const [connections, setConnections] = useState<AppointmentSheetConnectionRow[] | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [errorsFor, setErrorsFor] = useState<{ connectionId: string; rows: AppointmentSheetRowErrorItem[] } | null>(null);
  const [, startTransition] = useTransition();

  function refetch() {
    getAppointmentSheetConnectionsAction().then(setConnections);
  }

  useEffect(() => {
    refetch();
  }, []);

  function handleSyncNow(id: string) {
    setSyncingId(id);
    triggerManualAppointmentSheetSyncAction(id)
      .then((result) => {
        toast.success(`Sincronizado — ${result.created} nueva(s), ${result.updated} actualizada(s)${result.errors ? `, ${result.errors} con error` : ""}.`);
        refetch();
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo sincronizar."))
      .finally(() => setSyncingId(null));
  }

  function handleTogglePause(connection: AppointmentSheetConnectionRow) {
    const nextStatus = connection.status === "active" ? "paused" : "active";
    startTransition(async () => {
      try {
        await pauseAppointmentSheetConnectionAction(connection.id, nextStatus);
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar la conexión.");
      }
    });
  }

  function handleDelete(connection: AppointmentSheetConnectionRow) {
    if (!window.confirm(`¿Eliminar la conexión con "${connection.sheetName}"? Las citas ya creadas no se borran.`)) return;
    startTransition(async () => {
      try {
        await deleteAppointmentSheetConnectionAction(connection.id);
        refetch();
        toast.success("Conexión eliminada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar la conexión.");
      }
    });
  }

  function handleViewErrors(connectionId: string) {
    getAppointmentSheetRowErrorsAction(connectionId).then((rows) => setErrorsFor({ connectionId, rows }));
  }

  if (!accountConnected) return null;

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-border-default pt-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-foreground">Sincronización de agenda (setter → asesor)</p>
        <Button size="sm" variant="secondary" disabled={!canManage} onClick={() => setWizardOpen(true)}>
          <Plus size={14} aria-hidden="true" />
          Nueva conexión
        </Button>
      </div>

      {connections === null ? (
        <p className="text-[13px] text-neutral-500">Cargando…</p>
      ) : connections.length === 0 ? (
        <p className="text-[13px] text-neutral-500">Todavía no conectaste la hoja donde tus setters cargan citas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {connections.map((c) => {
            const badge = STATUS_BADGE[c.lastSyncStatus];
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{c.sheetName}</p>
                  <p className="text-[12px] text-neutral-500">
                    {c.lastSyncedAt ? `Última sync: ${formatRelativeTime(c.lastSyncedAt)}` : "Todavía no sincronizó"} · {c.rowCount} fila(s)
                  </p>
                  {c.lastSyncStatus === "error" && c.lastSyncError && (
                    <p className="truncate text-[12px] text-error-strong" title={c.lastSyncError}>
                      {c.lastSyncError}
                    </p>
                  )}
                </div>
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title="Sincronizar ahora"
                    disabled={!canManage || syncingId === c.id}
                    onClick={() => handleSyncNow(c.id)}
                    className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground disabled:opacity-40"
                  >
                    <RefreshCw size={14} className={syncingId === c.id ? "animate-spin" : ""} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    title="Ver filas con error"
                    onClick={() => handleViewErrors(c.id)}
                    className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
                  >
                    <AlertCircle size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    title={c.status === "active" ? "Pausar" : "Reanudar"}
                    disabled={!canManage}
                    onClick={() => handleTogglePause(c)}
                    className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground disabled:opacity-40"
                  >
                    {c.status === "active" ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    title="Eliminar"
                    disabled={!canManage}
                    onClick={() => handleDelete(c)}
                    className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-error-bg hover:text-error-strong disabled:opacity-40"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {errorsFor && (
        <div className="rounded-md border border-error-bg bg-error-bg/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-error-strong">Filas con error (últimas 50)</p>
            <button type="button" onClick={() => setErrorsFor(null)} className="text-[12px] text-neutral-500 hover:text-foreground">
              Cerrar
            </button>
          </div>
          {errorsFor.rows.length === 0 ? (
            <p className="text-[12.5px] text-neutral-500">Sin filas en error.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {errorsFor.rows.map((r) => (
                <li key={r.rowKey} className="text-[12px] text-neutral-600">
                  <span className="font-medium">{r.rowKey}</span> — {r.errorMessage}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {wizardOpen && (
        <AppointmentSheetConnectionWizard
          onClose={() => setWizardOpen(false)}
          onSaved={() => {
            setWizardOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
