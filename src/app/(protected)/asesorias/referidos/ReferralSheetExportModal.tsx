"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import {
  getReferralSheetConnectionAction,
  saveReferralSheetConnectionAction,
  testReferralSheetConnectionAction,
  disconnectReferralSheetAction,
  type ReferralSheetConnection,
} from "@/lib/asesorias/referralSheetActions";
import type { GoogleSheetsExportAccountStatus } from "@/lib/integrations/googleSheetsExport";

const DEFAULT_COLUMN_MAP = { numero: "A", lead: "B", nombre: "C", telefono: "D", agendo: "E" };

/** Modal "Exportar referidos a hoja" — conectar la cuenta de Google,
 * elegir la hoja/pestaña de destino, la fila de inicio y el mapeo de
 * columnas (A–E por defecto, editable), y probar la conexión antes de
 * guardar. Vive en Asesorías > Referidos (no en Perfil > Integraciones)
 * porque es específico de este flujo, a pedido del usuario. */
export function ReferralSheetExportModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<GoogleSheetsExportAccountStatus | null>(null);
  const [existing, setExisting] = useState<ReferralSheetConnection | null>(null);
  const [spreadsheetInput, setSpreadsheetInput] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [startRow, setStartRow] = useState(3);
  const [columnMap, setColumnMap] = useState(DEFAULT_COLUMN_MAP);
  const [testResult, setTestResult] = useState<{ ok: true; title: string } | { ok: false; error: string } | null>(null);
  const [isTesting, startTesting] = useTransition();
  const [isSaving, startSaving] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- resetea el loading para este "open", solo corre cuando `open` cambia.
    getReferralSheetConnectionAction()
      .then(({ account: acc, connection }) => {
        setAccount(acc);
        setExisting(connection);
        if (connection) {
          setSpreadsheetInput(connection.spreadsheetId);
          setSheetName(connection.sheetName);
          setStartRow(connection.startRow);
          setColumnMap(connection.columnMap);
        }
      })
      .catch(() => toast.error("No se pudo cargar la configuración actual."))
      .finally(() => setLoading(false));
  }, [open]);

  function handleTest() {
    setTestResult(null);
    startTesting(async () => {
      const result = await testReferralSheetConnectionAction({ spreadsheetInput, sheetName });
      setTestResult(result);
    });
  }

  function handleSave() {
    if (!account?.connected) {
      toast.error("Conectá primero tu cuenta de Google.");
      return;
    }
    startSaving(async () => {
      try {
        await saveReferralSheetConnectionAction({ spreadsheetInput, sheetName, startRow, columnMap });
        toast.success("Configuración guardada.");
        onSaved();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  function handleDisconnect() {
    startSaving(async () => {
      try {
        await disconnectReferralSheetAction();
        toast.success("Cuenta de Google desconectada.");
        setAccount({ connected: false, email: null });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo desconectar.");
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Exportar referidos a hoja">
      {loading ? (
        <p className="py-8 text-center text-sm text-neutral-500">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-2 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Cuenta de Google</p>
              <p className="text-xs text-neutral-500">{account?.connected ? account.email : "No conectada todavía"}</p>
            </div>
            {account?.connected ? (
              <Button type="button" variant="secondary" onClick={handleDisconnect} disabled={isSaving}>
                Desconectar
              </Button>
            ) : (
              <a href="/api/integrations/google-sheets-export/connect">
                <Button type="button" variant="primary">
                  Conectar con Google
                </Button>
              </a>
            )}
          </div>

          {existing && (
            <div className="flex items-center gap-2 text-xs">
              <Badge variant={existing.lastSyncStatus === "ok" ? "success" : existing.lastSyncStatus === "error" ? "error" : "neutral"}>
                {existing.lastSyncStatus === "ok" ? "Última exportación: sin errores" : existing.lastSyncStatus === "error" ? "Hubo un error" : "Pendiente"}
              </Badge>
              {existing.lastSyncError && <span className="text-neutral-500">{existing.lastSyncError}</span>}
            </div>
          )}

          <Input
            label="URL o ID de la Google Sheet"
            value={spreadsheetInput}
            onChange={(e) => setSpreadsheetInput(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
          />
          <Input label="Nombre de la pestaña" value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="Hoja 1" />
          <Input
            label="Fila de inicio"
            type="number"
            min={1}
            value={startRow}
            onChange={(e) => setStartRow(Math.max(1, Number(e.target.value) || 1))}
            hint="Los encabezados no se tocan — acá empiezan los datos."
          />

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Columnas</p>
            <div className="grid grid-cols-5 gap-2">
              <Input label="Número" value={columnMap.numero} onChange={(e) => setColumnMap((m) => ({ ...m, numero: e.target.value.toUpperCase() }))} maxLength={2} />
              <Input label="Lead" value={columnMap.lead} onChange={(e) => setColumnMap((m) => ({ ...m, lead: e.target.value.toUpperCase() }))} maxLength={2} />
              <Input label="Nombre" value={columnMap.nombre} onChange={(e) => setColumnMap((m) => ({ ...m, nombre: e.target.value.toUpperCase() }))} maxLength={2} />
              <Input label="Teléfono" value={columnMap.telefono} onChange={(e) => setColumnMap((m) => ({ ...m, telefono: e.target.value.toUpperCase() }))} maxLength={2} />
              <Input label="Agendó" value={columnMap.agendo} onChange={(e) => setColumnMap((m) => ({ ...m, agendo: e.target.value.toUpperCase() }))} maxLength={2} />
            </div>
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${testResult.ok ? "bg-success-bg text-success-strong" : "bg-error-bg text-error-strong"}`}>
              {testResult.ok ? <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" /> : <XCircle className="size-4 shrink-0" aria-hidden="true" />}
              <span>{testResult.ok ? `Conectado a "${testResult.title}".` : testResult.error}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={handleTest} loading={isTesting} disabled={!account?.connected || !spreadsheetInput.trim()}>
              Probar conexión
            </Button>
            <Button type="button" variant="primary" onClick={handleSave} loading={isSaving} disabled={!account?.connected}>
              Guardar
            </Button>
            {existing && (
              <a href={`https://docs.google.com/spreadsheets/d/${existing.spreadsheetId}`} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-xs text-accent-600 hover:underline">
                Abrir hoja
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
