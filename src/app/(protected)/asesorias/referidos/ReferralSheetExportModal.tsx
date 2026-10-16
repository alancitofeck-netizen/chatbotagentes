"use client";

import { useEffect, useState, useTransition } from "react";
import { Table2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { formatRelativeTime } from "@/lib/utils/format";
import {
  getReferralSheetConnectionAction,
  saveReferralSheetConnectionAction,
  testReferralSheetConnectionAction,
  disconnectReferralSheetAction,
  type ReferralSheetConnection,
} from "@/lib/asesorias/referralSheetActions";
import type { GoogleSheetsExportAccountStatus } from "@/lib/integrations/googleSheetsExport";

const DEFAULT_COLUMN_MAP = { numero: "A", lead: "B", nombre: "C", telefono: "D", agendo: "E" };

const COLUMN_FIELDS: { key: keyof typeof DEFAULT_COLUMN_MAP; label: string }[] = [
  { key: "numero", label: "Número" },
  { key: "lead", label: "Lead" },
  { key: "nombre", label: "Nombre" },
  { key: "telefono", label: "Teléfono" },
  { key: "agendo", label: "Agendó" },
];

const COLUMN_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

/** Mismo parseo que `parseSpreadsheetId` (googleSheetsExport.ts), duplicado
 * acá en una forma mínima solo para truncar el ID a mostrar en la tarjeta
 * "hoja vinculada" mientras el usuario todavía está escribiendo/pegando el
 * link — el parseo autoritativo (el que de verdad decide qué ID se guarda)
 * sigue pasando únicamente por el server action. */
function extractSheetIdForDisplay(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]+$/.test(trimmed)) return trimmed;
  return null;
}

function truncateMiddle(value: string, head = 8, tail = 8): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

type SheetInfo = { title: string; availableSheets: string[] };

/** Modal "Exportar referidos a hoja" — conectar la cuenta de Google, elegir
 * la hoja/pestaña de destino, la fila de inicio y el mapeo de columnas
 * (A–E por defecto, editable), y probar la conexión antes de guardar. Vive
 * en Asesorías > Referidos (no en Perfil > Integraciones) porque es
 * específico de este flujo, a pedido del usuario. */
export function ReferralSheetExportModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<GoogleSheetsExportAccountStatus | null>(null);
  const [existing, setExisting] = useState<ReferralSheetConnection | null>(null);
  const [spreadsheetInput, setSpreadsheetInput] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [startRow, setStartRow] = useState(3);
  const [columnMap, setColumnMap] = useState(DEFAULT_COLUMN_MAP);
  const [sheetInfo, setSheetInfo] = useState<SheetInfo | null>(null);
  const [testResult, setTestResult] = useState<{ ok: true; title: string } | { ok: false; error: string } | null>(null);
  const [isInspecting, startInspecting] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isSaving, startSaving] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- resetea el loading para este "open", solo corre cuando `open` cambia.
    setSheetInfo(null);
    setTestResult(null);
    getReferralSheetConnectionAction()
      .then(({ account: acc, connection }) => {
        setAccount(acc);
        setExisting(connection);
        if (connection) {
          setSpreadsheetInput(connection.spreadsheetId);
          setSheetName(connection.sheetName);
          setStartRow(connection.startRow);
          setColumnMap(connection.columnMap);
          if (acc.connected) inspectSheet(connection.spreadsheetId, connection.sheetName);
        }
      })
      .catch(() => toast.error("No se pudo cargar la configuración actual."))
      .finally(() => setLoading(false));
  }, [open]);

  /** Trae el título real de la hoja y sus pestañas — usa el mismo action que
   * "Probar conexión" (ya hace esto como parte de la validación), pero acá
   * sin mostrar el banner verde/rojo: solo alimenta la tarjeta "hoja
   * vinculada" y el combo de pestañas. */
  function inspectSheet(spreadsheetValue: string, currentSheetName: string) {
    if (!extractSheetIdForDisplay(spreadsheetValue)) return;
    startInspecting(async () => {
      const result = await testReferralSheetConnectionAction({ spreadsheetInput: spreadsheetValue, sheetName: currentSheetName });
      if (result.ok) {
        setSheetInfo({ title: result.title, availableSheets: result.availableSheets });
        if (!currentSheetName && result.availableSheets[0]) setSheetName(result.availableSheets[0]);
      } else {
        setSheetInfo(null);
      }
    });
  }

  function handleTest() {
    setTestResult(null);
    startTesting(async () => {
      const result = await testReferralSheetConnectionAction({ spreadsheetInput, sheetName });
      setTestResult(result);
      if (result.ok) {
        setSheetInfo({ title: result.title, availableSheets: result.availableSheets });
        if (!sheetName && result.availableSheets[0]) setSheetName(result.availableSheets[0]);
      }
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
        setSheetInfo(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo desconectar.");
      }
    });
  }

  const displayedId = existing?.spreadsheetId ?? extractSheetIdForDisplay(spreadsheetInput);
  const sheetUrl = displayedId ? `https://docs.google.com/spreadsheets/d/${displayedId}` : null;
  const headerRowsEnd = Math.max(1, startRow - 1);

  const statusDotColor = existing?.lastSyncStatus === "ok" ? "bg-success-strong" : existing?.lastSyncStatus === "error" ? "bg-error-strong" : "bg-neutral-400";
  const statusLabel = existing
    ? existing.lastSyncStatus === "ok"
      ? "Última exportación OK"
      : existing.lastSyncStatus === "error"
        ? `Error: ${existing.lastSyncError ?? "desconocido"}`
        : "Exportación pendiente"
    : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      className="max-w-[400px]"
      title={
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <Table2 className="size-4.5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-foreground">Exportar referidos a Google Sheets</p>
            <p className="text-xs font-normal text-neutral-500">Los referidos nuevos se agregan como filas en tu hoja.</p>
          </div>
        </div>
      }
    >
      {loading ? (
        <p className="py-8 text-center text-sm text-neutral-500">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-5 p-5">
          {account?.connected ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-2 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                  {(account.email ?? "?").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{account.email}</p>
                  <p className="flex items-center gap-1 text-xs text-neutral-500">
                    <span className="size-1.5 rounded-full bg-success-strong" aria-hidden="true" />
                    Cuenta de Google conectada
                  </p>
                </div>
              </div>
              <button type="button" onClick={handleDisconnect} disabled={isSaving} className="shrink-0 text-xs font-medium text-accent-600 hover:underline disabled:opacity-50">
                Cambiar
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-2 p-3">
              <p className="text-sm text-neutral-500">No conectada todavía</p>
              <a href="/api/integrations/google-sheets-export/connect">
                <Button type="button" variant="primary" size="sm">
                  Conectar con Google
                </Button>
              </a>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-100 text-[11px] font-bold text-accent-700">1</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Destino</span>
            </div>

            <Input
              label="Hoja de cálculo"
              value={spreadsheetInput}
              onChange={(e) => setSpreadsheetInput(e.target.value)}
              onBlur={() => account?.connected && inspectSheet(spreadsheetInput, sheetName)}
              placeholder="Pegá la URL o el ID de la hoja"
            />

            {sheetInfo && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-2 p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Table2 className="size-4 shrink-0 text-success-strong" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{sheetInfo.title}</p>
                    {displayedId && <p className="truncate text-xs text-neutral-500">{truncateMiddle(displayedId)}</p>}
                  </div>
                </div>
                {sheetUrl && (
                  <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 text-xs font-medium text-accent-600 hover:underline">
                    Abrir
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
            {isInspecting && !sheetInfo && <p className="text-xs text-neutral-500">Buscando la hoja…</p>}

            <div className="flex items-end gap-3">
              <div className="flex-1">
                {sheetInfo && sheetInfo.availableSheets.length > 0 ? (
                  <Select label="Pestaña" value={sheetName} onChange={(e) => setSheetName(e.target.value)}>
                    {!sheetInfo.availableSheets.includes(sheetName) && sheetName && <option value={sheetName}>{sheetName}</option>}
                    {sheetInfo.availableSheets.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input label="Pestaña" value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="Hoja 1" />
                )}
              </div>
              <div className="w-20 shrink-0">
                <Input
                  label="Fila de inicio"
                  type="number"
                  min={1}
                  value={startRow}
                  onChange={(e) => setStartRow(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
            </div>
            <p className="-mt-2 text-xs text-neutral-500">Las filas 1–{headerRowsEnd} (encabezados) no se modifican.</p>
          </div>

          <div className="flex flex-col gap-1 border-t border-border-default pt-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-100 text-[11px] font-bold text-accent-700">2</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Columnas</span>
            </div>
            <div className="flex items-center justify-between px-0.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              <span>Dato</span>
              <span>Columna</span>
            </div>
            {COLUMN_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-3 border-b border-border-default py-2.5 last:border-b-0">
                <span className="text-sm text-foreground">{label}</span>
                <div className="w-20 shrink-0">
                  <Select label="" value={columnMap[key]} onChange={(e) => setColumnMap((m) => ({ ...m, [key]: e.target.value }))}>
                    {COLUMN_LETTERS.map((letter) => (
                      <option key={letter} value={letter}>
                        {letter}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            ))}
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${testResult.ok ? "bg-success-bg text-success-strong" : "bg-error-bg text-error-strong"}`}>
              {testResult.ok ? <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" /> : <XCircle className="size-4 shrink-0" aria-hidden="true" />}
              <span>{testResult.ok ? `Conectado a "${testResult.title}".` : testResult.error}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-border-default pt-4">
            {statusLabel && (
              <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className={`size-1.5 rounded-full ${statusDotColor}`} aria-hidden="true" />
                {statusLabel}
                {existing?.lastSyncedAt && <span>· {formatRelativeTime(existing.lastSyncedAt)}</span>}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={handleTest} loading={isTesting} disabled={!account?.connected || !spreadsheetInput.trim()}>
                Probar conexión
              </Button>
              <Button type="button" variant="primary" onClick={handleSave} loading={isSaving} disabled={!account?.connected} className="ml-auto">
                Guardar cambios
              </Button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
