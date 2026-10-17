"use client";

import { ExternalLink, FileSpreadsheet, Loader2, RefreshCw, Settings2, AlertTriangle } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils/format";
import type { AgendaSheetStatus } from "@/lib/agenda/sheetPanelTypes";

/** Franja arriba de la Agenda: estado de la hoja conectada + "Sincronizar ahora" (la única forma de
 * sincronizar — no hay cron), "Abrir hoja ↗" y "Configurar". Sin hoja: invitación a conectarla. */
export function AgendaSheetStatusBar({ status, syncing, onSync, onConfigure }: { status: AgendaSheetStatus | null; syncing: boolean; onSync: () => void; onConfigure: () => void }) {
  if (!status) return <div className="h-11 animate-pulse rounded-lg bg-surface-2" />;
  const c = status.connection;

  if (!c) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border-strong bg-surface-1 px-4 py-3">
        <p className="flex items-center gap-2 text-[13px] text-neutral-600">
          <FileSpreadsheet className="size-4 text-accent-600" aria-hidden="true" />
          Conectá la hoja de Google Sheets donde cargás las citas: aparecen solas acá y cada persona queda guardada como lead.
        </p>
        <button type="button" onClick={onConfigure} className="rounded-md bg-accent-500 px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-accent-600">
          Conectar hoja de agendas
        </button>
      </div>
    );
  }

  const isError = c.lastSyncStatus === "error";
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${c.spreadsheetId}/edit${c.sheetGid ? `#gid=${c.sheetGid}` : ""}`;

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-2.5 text-[13px] ${isError ? "border-error/40 bg-error-bg" : "border-border-default bg-surface-1"}`}>
      <span className="flex items-center gap-2 font-medium text-foreground">
        {isError ? <AlertTriangle className="size-4 text-error-strong" aria-hidden="true" /> : <span className="size-2 rounded-full bg-success-strong" aria-hidden="true" />}
        {isError ? "Error al sincronizar con Google Sheets" : "Sincronizado con Google Sheets"}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-neutral-600">
        <FileSpreadsheet className="size-4 shrink-0 text-success-strong" aria-hidden="true" />
        <span className="truncate">
          {c.spreadsheetTitle || "Hoja de agendas"} · {c.sheetName}
        </span>
      </span>
      <span className="text-neutral-500">Última sync: {c.lastSyncedAt ? formatRelativeTime(c.lastSyncedAt) : "todavía no"}</span>
      {isError && c.lastSyncError && <span className="basis-full text-[12.5px] text-error-strong">{c.lastSyncError}</span>}
      <span className="ml-auto flex items-center gap-3">
        <button type="button" onClick={onSync} disabled={syncing} className="flex items-center gap-1.5 font-medium text-accent-600 hover:text-accent-700 disabled:opacity-60">
          {syncing ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
          {syncing ? "Sincronizando…" : "Sincronizar ahora"}
        </button>
        <a href={sheetUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium text-accent-600 hover:text-accent-700">
          Abrir hoja <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
        <button type="button" onClick={onConfigure} className="flex items-center gap-1.5 font-medium text-accent-600 hover:text-accent-700">
          <Settings2 className="size-3.5" aria-hidden="true" />
          Configurar
        </button>
      </span>
    </div>
  );
}
