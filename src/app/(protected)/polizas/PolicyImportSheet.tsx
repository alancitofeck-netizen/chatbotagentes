"use client";

import { useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/toast/toast";
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { POLICY_FIELD_DICTIONARY } from "@/lib/policies/constants";
import { parsePolicyImportFileAction, parsePolicyImportSheetAction, confirmPolicyImportAction, type PolicyImportPreview } from "@/lib/policies/actions";
import type { PolicyImportResult } from "@/lib/policies/import";

type Step = "upload" | "sheet-select" | "mapping" | "importing" | "results";

/** Versión reducida (3 pasos, sin job en background) del importador de
 * cartera de Asesores — ver la nota en actions.ts sobre por qué. */
export function PolicyImportSheet({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [isBusy, setIsBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PolicyImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [result, setResult] = useState<PolicyImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setIsBusy(false);
    setFile(null);
    setPreview(null);
    setMapping({});
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileSelected(selected: File) {
    setFile(selected);
    setIsBusy(true);
    try {
      const formData = new FormData();
      formData.set("file", selected);
      const result = await parsePolicyImportFileAction(formData);
      if (result.needsSheetSelection) {
        setPreview(result);
        setStep("sheet-select");
      } else {
        setPreview(result);
        setMapping(result.suggestedMapping);
        setStep("mapping");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSheetChosen(sheetName: string) {
    if (!file) return;
    setIsBusy(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await parsePolicyImportSheetAction(formData, sheetName);
      setPreview(result);
      setMapping(result.suggestedMapping);
      setStep("mapping");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo leer la hoja elegida.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleConfirmImport() {
    if (!preview) return;
    setIsBusy(true);
    setStep("importing");
    try {
      const result = await confirmPolicyImportAction(preview.rows, mapping);
      setResult(result);
      setStep("results");
      if (result.created > 0) onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo importar el archivo.");
      setStep("mapping");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={handleClose} title="Importar pólizas desde Excel/CSV">
      <div className="flex flex-col gap-4 p-5">
        {step === "upload" && (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-strong bg-surface-2 p-10 text-center hover:border-accent-500">
            {isBusy ? <Loader2 className="size-8 animate-spin text-accent-500" aria-hidden="true" /> : <Upload className="size-8 text-neutral-400" aria-hidden="true" />}
            <p className="text-sm font-medium text-foreground">{isBusy ? "Leyendo archivo…" : "Arrastrá o hacé clic para subir tu Excel o CSV"}</p>
            <p className="text-xs text-neutral-500">Hasta 1000 pólizas por importación.</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              disabled={isBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelected(f);
                e.target.value = "";
              }}
            />
          </label>
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

        {step === "mapping" && preview && (
          <>
            <p className="text-xs text-neutral-500">
              Detectamos {Object.values(mapping).filter(Boolean).length} de {preview.headers.length} columna(s) automáticamente. Corregí lo que haga falta — nunca bloquea la importación.
            </p>
            <div className="flex flex-col divide-y divide-border-default">
              {preview.headers.map((header) => (
                <div key={header} className="grid grid-cols-1 items-center gap-2 py-2.5 sm:grid-cols-[1fr_auto_1fr]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{header}</p>
                    <p className="truncate text-xs text-neutral-500">{preview.rows[0]?.[header] || "—"}</p>
                  </div>
                  <ArrowRight className="hidden size-4 text-neutral-400 sm:block" aria-hidden="true" />
                  <Select label="" containerClassName="w-full" value={mapping[header] ?? ""} onChange={(e) => setMapping({ ...mapping, [header]: e.target.value || null })}>
                    <option value="">Sin mapear</option>
                    {POLICY_FIELD_DICTIONARY.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-500">{preview.totalRows} registro(s) — las pólizas importadas entran directo como &quot;Activa&quot;.</p>
            <Button onClick={handleConfirmImport} loading={isBusy}>
              Importar {preview.totalRows} póliza(s)
            </Button>
          </>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="size-8 animate-spin text-accent-500" aria-hidden="true" />
            <p className="text-sm text-foreground">Importando pólizas…</p>
          </div>
        )}

        {step === "results" && result && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {result.errors.length === 0 ? (
                <CheckCircle2 className="size-5 text-success-strong" aria-hidden="true" />
              ) : (
                <AlertTriangle className="size-5 text-warning-strong" aria-hidden="true" />
              )}
              <p className="text-sm font-medium text-foreground">{result.created} póliza(s) creada(s).</p>
            </div>
            {result.errors.length > 0 && (
              <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border border-border-default p-3 text-xs text-neutral-500">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Fila {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={reset}>
                Importar otro archivo
              </Button>
              <Button onClick={handleClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
