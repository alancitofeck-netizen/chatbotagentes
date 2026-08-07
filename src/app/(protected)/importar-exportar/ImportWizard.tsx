"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { toast } from "@/components/toast/toast";
import { Users, ShieldCheck, FileCheck2, Wallet, CalendarDays, CheckSquare, FileSpreadsheet, ArrowRight, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { IMPORT_ENTITY_TYPES, IMPORT_ENTITY_LABEL, REDIRECT_ENTITY_TYPES, type ImportEntityType } from "@/lib/dataTransfer/constants";
import { parseDataImportFileAction, parseDataImportSheetAction, confirmDataImportAction, getFieldDictionaryAction, type DataImportPreview } from "@/lib/dataTransfer/actions";
import type { ImportResult } from "@/lib/dataTransfer/importers";

type Step = "type" | "sheet-select" | "mapping" | "preview" | "importing" | "results";

const ENTITY_ICON: Record<ImportEntityType, typeof Users> = {
  contacts: Users,
  prospects: ShieldCheck,
  policies: FileCheck2,
  payments: Wallet,
  events: CalendarDays,
  tasks: CheckSquare,
};

export function ImportWizard({ file, onClose, onImported }: { file: File; onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<Step>("type");
  const [entityType, setEntityType] = useState<ImportEntityType | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [preview, setPreview] = useState<DataImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [dictionary, setDictionary] = useState<{ key: string; label: string }[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (step !== "importing") return;
    const interval = setInterval(() => setProgress((p) => Math.min(p + 8, 92)), 150);
    return () => clearInterval(interval);
  }, [step]);

  async function handleSelectType(type: ImportEntityType) {
    setEntityType(type);
    if (REDIRECT_ENTITY_TYPES.includes(type)) return; // el paso "mapping" queda oculto — se ofrece el link al importador dedicado
    setIsBusy(true);
    try {
      const [parsed, dict] = await Promise.all([
        (async () => {
          const formData = new FormData();
          formData.set("file", file);
          return parseDataImportFileAction(formData, type);
        })(),
        getFieldDictionaryAction(type),
      ]);
      setDictionary(dict);
      if (parsed.needsSheetSelection) {
        setPreview(parsed);
        setStep("sheet-select");
      } else {
        setPreview(parsed);
        setMapping(parsed.suggestedMapping);
        setStep("preview");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSheetChosen(sheetName: string) {
    if (!entityType) return;
    setIsBusy(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const parsed = await parseDataImportSheetAction(formData, sheetName, entityType);
      setPreview(parsed);
      setMapping(parsed.suggestedMapping);
      setStep("preview");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo leer la hoja elegida.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleConfirm() {
    if (!preview || !entityType) return;
    setIsBusy(true);
    setStep("importing");
    setProgress(10);
    try {
      const outcome = await confirmDataImportAction(entityType, file.name, preview.rows, mapping);
      setProgress(100);
      setResult(outcome);
      setStep("results");
      if (outcome.created > 0) onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo importar el archivo.");
      setStep("preview");
    } finally {
      setIsBusy(false);
    }
  }

  const duplicateCount = 0; // el motor de import dedupe silenciosamente (mismo teléfono/N° de póliza) — no hay un contador separado de "duplicado" distinto de "ya existía y se actualizó"

  return (
    <Sheet open onClose={onClose} title={`Importar — ${file.name}`} className="max-w-xl">
      <div className="flex flex-col gap-4 p-5">
        {step === "type" && (
          <>
            <p className="text-sm font-medium text-foreground">Paso 1 — ¿Qué tipo de datos contiene este archivo?</p>
            <div className="grid grid-cols-2 gap-2">
              {IMPORT_ENTITY_TYPES.map((type) => {
                const Icon = ENTITY_ICON[type];
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleSelectType(type)}
                    className="flex items-center gap-2 rounded-lg border border-border-default px-4 py-3 text-left text-sm hover:border-accent-500 hover:bg-surface-2 disabled:opacity-50"
                  >
                    <Icon className="size-4 text-neutral-400" aria-hidden="true" />
                    {IMPORT_ENTITY_LABEL[type]}
                  </button>
                );
              })}
            </div>
            {isBusy && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-neutral-500">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Leyendo archivo…
              </div>
            )}
            {entityType && REDIRECT_ENTITY_TYPES.includes(entityType) && (
              <div className="flex flex-col gap-2 rounded-md bg-info-bg px-3 py-3 text-sm text-info-strong">
                <p>Prospectos tiene su propio importador dedicado — corre en segundo plano y detecta aseguradora/ramo/producto automáticamente.</p>
                <a href="/advisors/import" className="font-medium underline">
                  Ir al importador de Prospectos →
                </a>
              </div>
            )}
          </>
        )}

        {step === "sheet-select" && preview && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Este archivo tiene varias hojas — ¿cuál querés importar?</p>
            {preview.sheets.map((sheet) => (
              <button
                key={sheet.name}
                type="button"
                disabled={isBusy}
                onClick={() => handleSheetChosen(sheet.name)}
                className="flex items-center justify-between rounded-md border border-border-default px-4 py-3 text-left text-sm hover:border-accent-500 hover:bg-surface-2 disabled:opacity-50"
              >
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <FileSpreadsheet className="size-4 text-neutral-400" aria-hidden="true" />
                  {sheet.name}
                </span>
                <span className="text-xs text-neutral-500">{sheet.rowCount} registro(s)</span>
              </button>
            ))}
          </div>
        )}

        {step === "preview" && preview && entityType && (
          <>
            <p className="text-sm font-medium text-foreground">Paso 2 — Mapeo de columnas</p>
            <p className="text-xs text-neutral-500">
              Detectamos {Object.values(mapping).filter(Boolean).length} de {preview.headers.length} columna(s) automáticamente. Corregí lo que haga falta.
            </p>
            <div className="flex max-h-52 flex-col divide-y divide-border-default overflow-y-auto">
              {preview.headers.map((header) => (
                <div key={header} className="grid grid-cols-1 items-center gap-2 py-2.5 sm:grid-cols-[1fr_auto_1fr]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{header}</p>
                    <p className="truncate text-xs text-neutral-500">{preview.rows[0]?.[header] || "—"}</p>
                  </div>
                  <ArrowRight className="hidden size-4 text-neutral-400 sm:block" aria-hidden="true" />
                  <Select label="" containerClassName="w-full" value={mapping[header] ?? ""} onChange={(e) => setMapping({ ...mapping, [header]: e.target.value || null })}>
                    <option value="">Sin mapear</option>
                    {dictionary.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>

            <p className="text-sm font-medium text-foreground">Paso 3 — Vista previa (primeras {Math.min(20, preview.rows.length)} filas)</p>
            <div className="max-h-56 overflow-auto rounded-md border border-border-default">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-surface-2">
                  <tr>
                    {preview.headers.map((h) => (
                      <th key={h} className="whitespace-nowrap px-2 py-1.5 font-medium text-neutral-500">
                        {mapping[h] ? dictionary.find((f) => f.key === mapping[h])?.label : h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {preview.rows.slice(0, 20).map((row, i) => (
                    <tr key={i}>
                      {preview.headers.map((h) => (
                        <td key={h} className="whitespace-nowrap px-2 py-1.5 text-foreground">
                          {row[h] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-neutral-500">{preview.totalRows} registro(s) en total.</p>
            <Button onClick={handleConfirm} loading={isBusy}>
              Paso 4 — Importar {preview.totalRows} {IMPORT_ENTITY_LABEL[entityType].toLowerCase()}
            </Button>
          </>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <Loader2 className="size-8 animate-spin text-accent-500" aria-hidden="true" />
            <p className="text-sm text-foreground">Importando…</p>
            <ProgressBar value={progress} className="w-full max-w-xs" />
          </div>
        )}

        {step === "results" && result && preview && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {result.errors.length === 0 ? (
                <CheckCircle2 className="size-5 text-success-strong" aria-hidden="true" />
              ) : (
                <AlertTriangle className="size-5 text-warning-strong" aria-hidden="true" />
              )}
              <p className="text-sm font-medium text-foreground">Importación completa.</p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-md bg-surface-2 p-2">
                <p className="font-mono text-lg font-semibold text-foreground">{preview.totalRows}</p>
                <p className="text-[11px] text-neutral-500">Total</p>
              </div>
              <div className="rounded-md bg-success-bg p-2">
                <p className="font-mono text-lg font-semibold text-success-strong">{result.created}</p>
                <p className="text-[11px] text-neutral-500">Correctos</p>
              </div>
              <div className="rounded-md bg-error-bg p-2">
                <p className="font-mono text-lg font-semibold text-error-strong">{result.errors.length}</p>
                <p className="text-[11px] text-neutral-500">Con errores</p>
              </div>
              <div className="rounded-md bg-surface-2 p-2">
                <p className="font-mono text-lg font-semibold text-foreground">{duplicateCount}</p>
                <p className="text-[11px] text-neutral-500">Duplicados</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border border-border-default p-3 text-xs text-neutral-500">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Fila {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
