"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, RefreshCw, Trash2, Pause, Play, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import { formatRelativeTime } from "@/lib/utils/format";
import {
  getOwnAgendaSheetConnectionAction,
  pauseOwnAgendaSheetConnectionAction,
  deleteOwnAgendaSheetConnectionAction,
  triggerManualOwnAgendaSheetSyncAction,
  getOwnAgendaSheetRowErrorsAction,
} from "@/lib/advisorSync/actions";
import type { AdvisorSheetRowErrorItem } from "@/lib/advisorSync/queries";
import type { OwnAgendaSheetConnection } from "@/lib/advisorSync/types";
import { OwnAgendaSheetWizard } from "./OwnAgendaSheetWizard";

const STATUS_BADGE: Record<OwnAgendaSheetConnection["lastSyncStatus"], { variant: "success" | "warning" | "error"; label: string }> = {
  ok: { variant: "success", label: "Sincronizado" },
  pending: { variant: "warning", label: "Pendiente" },
  error: { variant: "error", label: "Error" },
};

/** Conexión propia de la Agenda de ESTE workspace — a diferencia de
 * AdvisorSheetConnectionsManager (agencia gestionando la hoja de OTROS
 * asesores), acá es autoservicio: cualquier workspace conecta su propia
 * hoja para alimentar su propia /agenda (0155_advisor_sheet_self_service.sql).
 * Se muestra a TODOS (canManage = owner/admin/agent del propio workspace,
 * mismo criterio que WhatsApp/Calendar/KpiSetters), sin depender de estar
 * afiliado a ninguna agencia. */
export function OwnAgendaSheetManager({ canManage, accountConnected }: { canManage: boolean; accountConnected: boolean }) {
  const [connection, setConnection] = useState<OwnAgendaSheetConnection | null | undefined>(undefined);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errors, setErrors] = useState<AdvisorSheetRowErrorItem[] | null>(null);
  const [, startTransition] = useTransition();

  function refetch() {
    getOwnAgendaSheetConnectionAction()
      .then(setConnection)
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo cargar la conexión."));
  }

  useEffect(() => {
    refetch();
  }, []);

  function handleSyncNow() {
    setSyncing(true);
    triggerManualOwnAgendaSheetSyncAction()
      .then((result) => {
        toast.success(`Sincronizado — ${result.created} nueva(s), ${result.updated} actualizada(s)${result.errors ? `, ${result.errors} con error` : ""}.`);
        refetch();
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo sincronizar."))
      .finally(() => setSyncing(false));
  }

  function handleTogglePause() {
    if (!connection) return;
    const nextStatus = connection.status === "active" ? "paused" : "active";
    startTransition(async () => {
      try {
        await pauseOwnAgendaSheetConnectionAction(connection.id, nextStatus);
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar la conexión.");
      }
    });
  }

  function handleDelete() {
    if (!connection) return;
    if (!window.confirm("¿Desconectar tu hoja de Agenda? Los leads y citas ya creados no se borran.")) return;
    startTransition(async () => {
      try {
        await deleteOwnAgendaSheetConnectionAction(connection.id);
        refetch();
        toast.success("Conexión eliminada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar la conexión.");
      }
    });
  }

  function handleViewErrors() {
    if (!connection) return;
    getOwnAgendaSheetRowErrorsAction(connection.id)
      .then(setErrors)
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudieron cargar los errores."));
  }

  if (!accountConnected) return null;

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-border-default pt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-foreground">Mi Agenda</p>
          <p className="text-[12px] text-neutral-500">Conectá tu hoja de Google Sheets para alimentar tu propia Agenda (citas, leads y KPIs).</p>
        </div>
        {!connection && (
          <Button size="sm" variant="secondary" disabled={!canManage} onClick={() => setWizardOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            Conectar
          </Button>
        )}
      </div>

      {connection === undefined ? (
        <p className="text-[13px] text-neutral-500">Cargando…</p>
      ) : connection === null ? (
        <p className="text-[13px] text-neutral-500">Todavía no conectaste tu hoja de Agenda.</p>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground" title={connection.sheetName}>
              {connection.sheetName}
            </p>
            <p className="truncate text-[12px] text-neutral-500">
              {connection.lastSyncedAt ? `Última sync: ${formatRelativeTime(connection.lastSyncedAt)}` : "Todavía no sincronizó"} · {connection.rowCount} fila(s)
            </p>
            {connection.lastSyncStatus === "error" && connection.lastSyncError && (
              <p className="truncate text-[12px] text-error-strong" title={connection.lastSyncError}>
                {connection.lastSyncError}
              </p>
            )}
          </div>
          <Badge variant={STATUS_BADGE[connection.lastSyncStatus].variant}>{STATUS_BADGE[connection.lastSyncStatus].label}</Badge>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              title="Sincronizar ahora"
              disabled={!canManage || syncing}
              onClick={handleSyncNow}
              className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground disabled:opacity-40"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Ver filas con error"
              onClick={handleViewErrors}
              className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
            >
              <AlertCircle size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              title={connection.status === "active" ? "Pausar" : "Reanudar"}
              disabled={!canManage}
              onClick={handleTogglePause}
              className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground disabled:opacity-40"
            >
              {connection.status === "active" ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
            </button>
            <button
              type="button"
              title="Eliminar"
              disabled={!canManage}
              onClick={handleDelete}
              className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-error-bg hover:text-error-strong disabled:opacity-40"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {errors && (
        <div className="rounded-md border border-error-bg bg-error-bg/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-error-strong">Filas con error (últimas 50)</p>
            <button type="button" onClick={() => setErrors(null)} className="text-[12px] text-neutral-500 hover:text-foreground">
              Cerrar
            </button>
          </div>
          {errors.length === 0 ? (
            <p className="text-[12.5px] text-neutral-500">Sin filas en error.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {errors.map((r) => (
                <li key={r.rowKey} className="text-[12px] text-neutral-600">
                  <span className="font-medium">{r.rowKey}</span> — {r.errorMessage}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {wizardOpen && (
        <OwnAgendaSheetWizard
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
