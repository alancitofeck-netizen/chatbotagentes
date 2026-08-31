"use client";

import { useEffect, useState } from "react";
import { getDataTransferHistoryAction, getBackupsAction } from "@/lib/dataTransfer/actions";
import type { HistoryEntry } from "@/lib/dataTransfer/queries";
import type { BackupSummary } from "@/lib/dataTransfer/backups";
import type { SyncStatus } from "@/lib/dataTransfer/actions";
import { ImportDropzone } from "./ImportDropzone";
import { ExportCenter } from "./ExportCenter";
import { SyncCenter } from "./SyncCenter";
import { BackupManager } from "./BackupManager";
import { HistoryTable } from "./HistoryTable";
import { FutureIntegrationsGrid } from "./FutureIntegrationsGrid";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

export function ImportExportShell({
  initialHistory,
  initialBackups,
  initialSync,
}: {
  initialHistory: HistoryEntry[];
  initialBackups: BackupSummary[];
  initialSync: SyncStatus;
}) {
  useAutoStartTour("data-transfer-intro");
  const [history, setHistory] = useState(initialHistory);
  const [backups, setBackups] = useState(initialBackups);

  function refreshHistory() {
    getDataTransferHistoryAction().then(setHistory);
  }

  function refreshAll() {
    refreshHistory();
    getBackupsAction().then(setBackups);
  }

  // Los botones de exportar son <a href> directos (descarga nativa del
  // navegador, no fetch) — este evento es la única forma de enterarse desde
  // acá de que uno terminó, para refrescar el Historial sin depender de que
  // el usuario recargue la página a mano.
  useEffect(() => {
    window.addEventListener("data-transfer:export", refreshHistory);
    return () => window.removeEventListener("data-transfer:export", refreshHistory);
  }, []);

  return (
    <div className="flex flex-col gap-5 px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ImportDropzone onImported={refreshAll} />
        <div className="flex flex-col gap-4">
          <ExportCenter />
          <SyncCenter sync={initialSync} />
          <BackupManager initialBackups={backups} driveConnected={initialSync.googleDrive.connected} onChanged={refreshAll} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Historial</p>
        <HistoryTable entries={history} />
      </div>

      <FutureIntegrationsGrid />
    </div>
  );
}
