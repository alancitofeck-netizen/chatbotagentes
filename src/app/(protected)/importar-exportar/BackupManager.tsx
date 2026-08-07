"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { DatabaseBackup, Download, RotateCcw, HardDrive } from "lucide-react";
import { createBackupAction, getBackupDownloadUrlAction, restoreBackupAction, uploadBackupToDriveAction } from "@/lib/dataTransfer/actions";
import type { BackupSummary } from "@/lib/dataTransfer/backups";
import { formatRelativeTime } from "@/lib/utils/format";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackupManager({ initialBackups, driveConnected, onChanged }: { initialBackups: BackupSummary[]; driveConnected: boolean; onChanged: () => void }) {
  const [backups, setBackups] = useState(initialBackups);
  const [isCreating, setIsCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate() {
    setIsCreating(true);
    try {
      const backup = await createBackupAction();
      setBackups((prev) => [backup, ...prev]);
      toast.success("Backup creado.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el backup.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDownload(id: string) {
    setBusyId(id);
    try {
      const url = await getBackupDownloadUrlAction(id);
      window.open(url, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo descargar.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestore(id: string) {
    if (!window.confirm("Esto va a recrear los registros del backup que falten (nunca borra ni sobreescribe lo que ya existe). ¿Continuar?")) return;
    setBusyId(id);
    try {
      const summary = await restoreBackupAction(id);
      const total = summary.contacts.created + summary.policies.created + summary.tasks.created + summary.events.created;
      toast.success(`Restauración completa — ${total} registro(s) agregado(s).`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo restaurar.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUploadToDrive(id: string) {
    setBusyId(id);
    try {
      await uploadBackupToDriveAction(id);
      toast.success("Backup subido a Google Drive.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir a Drive.");
    } finally {
      setBusyId(null);
    }
  }

  const latest = backups[0] ?? null;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Respaldos</p>
          <p className="text-[13px] text-neutral-500">Backup completo de clientes, pólizas, tareas y agenda</p>
        </div>
        <Button size="sm" onClick={handleCreate} loading={isCreating}>
          <DatabaseBackup className="size-3.5" aria-hidden="true" />
          Crear Backup
        </Button>
      </div>

      {latest && (
        <p className="text-xs text-neutral-500">
          Último respaldo: {formatRelativeTime(latest.createdAt)} · {formatSize(latest.sizeBytes)}
        </p>
      )}

      {backups.length === 0 ? (
        <p className="rounded-md bg-surface-2 px-3 py-4 text-center text-sm text-neutral-500">Todavía no creaste ningún backup.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-default">
          {backups.slice(0, 5).map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{formatRelativeTime(b.createdAt)}</p>
                <p className="truncate text-xs text-neutral-500">
                  {formatSize(b.sizeBytes)} · {Object.values(b.entityCounts).reduce((s, n) => s + n, 0)} registros · {b.createdByName ?? "—"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={busyId === b.id}
                  onClick={() => handleDownload(b.id)}
                  title="Descargar"
                  className="flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
                >
                  <Download className="size-4" aria-hidden="true" />
                </button>
                {driveConnected && (
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => handleUploadToDrive(b.id)}
                    title="Guardar en Google Drive"
                    className="flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
                  >
                    <HardDrive className="size-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === b.id}
                  onClick={() => handleRestore(b.id)}
                  title="Restaurar"
                  className="flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-neutral-400">
        Restaurar nunca borra ni sobreescribe — agrega los registros del backup que todavía no existan (mismo motor que Importar).
      </p>
    </Card>
  );
}
