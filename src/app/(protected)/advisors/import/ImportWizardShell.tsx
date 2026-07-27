"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Loader2,
  X,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { Select } from "@/components/ui/Select";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { toast } from "@/components/toast/toast";
import { FIELD_DICTIONARY, type ImportFieldEntity } from "@/lib/advisors/import/fieldDictionary";
import type { SheetInfo } from "@/lib/advisors/import/parseFile";
import type { ImportLookupRow } from "@/lib/advisors/import/queries";
import { DEFAULT_IMPORT_CONFIG, type ImportJobAnalysis, type ImportJobConfig, type ImportJobRecord } from "@/lib/advisors/import/types";
import {
  analyzeImportJobAction,
  cancelImportJobAction,
  confirmImportConfigAction,
  confirmImportMappingAction,
  getImportJobErrorsAction,
  getImportJobProgressAction,
  getImportJobStatusAction,
  getImportLookupsAction,
  resolveImportLookupsAction,
  selectImportSheetAction,
  startImportJobAction,
  type StartImportResult,
} from "@/lib/advisors/import/actions";

type WizardStep = "upload" | "sheet-select" | "mapping" | "analyzing" | "validation" | "resolution" | "config" | "progress" | "results";

const ENTITY_LABEL: Record<ImportFieldEntity, string> = {
  client: "Cliente",
  policy: "Póliza",
  dates: "Fechas",
  commercial: "Comercial",
};

const PHASE_LABEL: Record<string, string> = {
  idle: "Preparando…",
  lookups: "Resolviendo aseguradoras y ramos…",
  clients: "Importando clientes…",
  policies: "Importando pólizas…",
  renewals: "Calculando renovaciones…",
  finalizing: "Actualizando Dashboard y KPIs…",
  done: "Finalizado",
};

const PHASE_ORDER = ["lookups", "clients", "policies", "renewals", "finalizing", "done"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Owns every step's state via plain useState (a linear 8-step flow with no
 * concurrent transitions doesn't need a reducer) — reuses this app's
 * existing primitives throughout (Card/Badge/Select/ProgressBar/Button/
 * toast), no new visual language. */
export function ImportWizardShell() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("upload");
  const [isBusy, setIsBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [analysis, setAnalysis] = useState<ImportJobAnalysis | null>(null);
  const [lookups, setLookups] = useState<ImportLookupRow[]>([]);
  const [config, setConfig] = useState<ImportJobConfig>(DEFAULT_IMPORT_CONFIG);
  const [job, setJob] = useState<ImportJobRecord | null>(null);
  const [progress, setProgress] = useState({ total: 0, done: 0 });
  const [errors, setErrors] = useState<{ rowNumber: number; errorMessage: string }[] | null>(null);

  function applyStartResult(result: StartImportResult) {
    setJobId(result.jobId);
    setFileInfo({ name: result.fileName, size: result.fileSize });
    if (result.needsSheetSelection) {
      setSheets(result.sheets);
      setStep("sheet-select");
      return;
    }
    setHeaders(result.headers);
    setSampleRows(result.sampleRows);
    setTotalRows(result.totalRows);
    setMapping(Object.fromEntries(result.suggestedMapping.map((s) => [s.header, s.fieldKey])));
    setStep("mapping");
  }

  async function handleFileSelected(file: File) {
    setIsBusy(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await startImportJobAction(formData);
      applyStartResult(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSheetChosen(sheetName: string) {
    if (!jobId) return;
    setIsBusy(true);
    try {
      const result = await selectImportSheetAction(jobId, sheetName);
      applyStartResult(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo leer la hoja elegida.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleConfirmMapping() {
    if (!jobId) return;
    setIsBusy(true);
    setStep("analyzing");
    try {
      await confirmImportMappingAction(jobId, mapping);
      const result = await analyzeImportJobAction(jobId);
      setAnalysis(result);
      setLookups(await getImportLookupsAction(jobId));
      setStep("validation");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo analizar el archivo.");
      setStep("mapping");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleConfirmResolutions() {
    if (!jobId) return;
    setIsBusy(true);
    try {
      await resolveImportLookupsAction(
        jobId,
        lookups.map((l) => ({ lookupId: l.id, resolution: l.resolution === "pending" ? "create_new" : l.resolution, useExistingId: l.matchCandidateId ?? undefined })),
      );
      setStep("config");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron guardar las decisiones.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStartImport() {
    if (!jobId) return;
    setIsBusy(true);
    try {
      await confirmImportConfigAction(jobId, config);
      setStep("progress");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar la importación.");
    } finally {
      setIsBusy(false);
    }
  }

  // Paso 7: polls the job's real status/phase + row progress every ~1.5s —
  // a single foreground user watching their own job, not a multi-viewer
  // scenario, so plain polling (not a Realtime subscription) is the right
  // tool here (see the approved plan's reasoning).
  useEffect(() => {
    if (step !== "progress" || !jobId) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      const [freshJob, freshProgress] = await Promise.all([getImportJobStatusAction(jobId), getImportJobProgressAction(jobId)]);
      if (cancelled) return;
      if (freshJob) setJob(freshJob);
      setProgress(freshProgress);
      if (freshJob && ["completed", "completed_with_errors", "failed", "cancelled"].includes(freshJob.status)) {
        setStep("results");
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [step, jobId]);

  async function handleCancel() {
    if (!jobId) return;
    if (!window.confirm("¿Cancelar esta importación?")) return;
    await cancelImportJobAction(jobId);
    router.push("/advisors");
  }

  async function handleViewErrors() {
    if (!jobId) return;
    const { errors: rows } = await getImportJobErrorsAction(jobId);
    setErrors(rows);
  }

  function handleRestart() {
    setStep("upload");
    setIsBusy(false);
    setJobId(null);
    setFileInfo(null);
    setSheets([]);
    setHeaders([]);
    setSampleRows([]);
    setTotalRows(0);
    setMapping({});
    setAnalysis(null);
    setLookups([]);
    setConfig(DEFAULT_IMPORT_CONFIG);
    setJob(null);
    setProgress({ total: 0, done: 0 });
    setErrors(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-[30px] tracking-[-0.02em] text-foreground">Importar cartera</h1>
          <p className="text-sm text-neutral-500">Migrá toda tu cartera de pólizas desde un Excel o CSV en pocos minutos.</p>
        </div>
        <LinkButton href="/advisors" variant="secondary">
          <X className="size-4" aria-hidden="true" />
          Salir
        </LinkButton>
      </div>

      {step === "upload" && <UploadStep isBusy={isBusy} onFileSelected={handleFileSelected} />}

      {step === "sheet-select" && <SheetSelectStep sheets={sheets} isBusy={isBusy} onChoose={handleSheetChosen} />}

      {step === "mapping" && (
        <MappingStep
          fileInfo={fileInfo}
          headers={headers}
          sampleRows={sampleRows}
          totalRows={totalRows}
          mapping={mapping}
          onChange={setMapping}
          onConfirm={handleConfirmMapping}
          isBusy={isBusy}
        />
      )}

      {step === "analyzing" && (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <Loader2 className="size-8 animate-spin text-accent-500" aria-hidden="true" />
          <p className="text-sm text-neutral-500">Analizando el archivo — validando filas y buscando duplicados…</p>
        </Card>
      )}

      {step === "validation" && analysis && (
        <ValidationStep analysis={analysis} onBack={() => setStep("mapping")} onContinue={() => setStep("resolution")} />
      )}

      {step === "resolution" && (
        <ResolutionStep
          lookups={lookups}
          onChange={setLookups}
          onBack={() => setStep("validation")}
          onContinue={handleConfirmResolutions}
          isBusy={isBusy}
        />
      )}

      {step === "config" && (
        <ConfigStep config={config} onChange={setConfig} onBack={() => setStep("resolution")} onContinue={handleStartImport} isBusy={isBusy} />
      )}

      {step === "progress" && <ProgressStep job={job} progress={progress} onCancel={handleCancel} />}

      {step === "results" && job && (
        <ResultsStep job={job} errors={errors} onViewErrors={handleViewErrors} onRestart={handleRestart} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paso 1 — selección del archivo.
// ---------------------------------------------------------------------------

function UploadStep({ isBusy, onFileSelected }: { isBusy: boolean; onFileSelected: (file: File) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <Card>
      <CardHeader title="Paso 1 de 8 — Seleccioná el archivo" />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors duration-[var(--duration-fast)] ${
          isDragging ? "border-accent-500 bg-accent-100/40" : "border-border-strong hover:border-accent-500"
        }`}
      >
        {isBusy ? (
          <Loader2 className="size-8 animate-spin text-accent-500" aria-hidden="true" />
        ) : (
          <Upload className="size-8 text-neutral-400" aria-hidden="true" strokeWidth={1.5} />
        )}
        <p className="text-sm font-medium text-foreground">{isBusy ? "Leyendo archivo…" : "Arrastrá tu archivo acá, o hacé clic para elegirlo"}</p>
        <p className="text-xs text-neutral-500">Excel (.xlsx) o CSV — hasta 10.000 pólizas por importación.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          disabled={isBusy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelected(file);
            e.target.value = "";
          }}
        />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Paso 1b — elegir hoja (Excel con varias hojas).
// ---------------------------------------------------------------------------

function SheetSelectStep({ sheets, isBusy, onChoose }: { sheets: SheetInfo[]; isBusy: boolean; onChoose: (name: string) => void }) {
  return (
    <Card>
      <CardHeader title="Este archivo tiene varias hojas — ¿cuál querés importar?" />
      <div className="flex flex-col gap-2">
        {sheets.map((sheet) => (
          <button
            key={sheet.name}
            type="button"
            disabled={isBusy}
            onClick={() => onChoose(sheet.name)}
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
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Paso 2/3 — lectura inteligente + mapeo de columnas.
// ---------------------------------------------------------------------------

function MappingStep({
  fileInfo,
  headers,
  sampleRows,
  totalRows,
  mapping,
  onChange,
  onConfirm,
  isBusy,
}: {
  fileInfo: { name: string; size: number } | null;
  headers: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  mapping: Record<string, string | null>;
  onChange: (next: Record<string, string | null>) => void;
  onConfirm: () => void;
  isBusy: boolean;
}) {
  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <Card>
      <CardHeader
        title="Paso 2/3 de 8 — Revisá el mapeo de columnas"
        action={
          fileInfo && (
            <span className="text-xs text-neutral-500">
              {fileInfo.name} · {formatBytes(fileInfo.size)} · {totalRows} registro(s)
            </span>
          )
        }
      />
      <p className="mb-3 text-[13px] text-neutral-500">
        Detectamos automáticamente {mappedCount} de {headers.length} columna(s). Corregí manualmente cualquiera que no coincida — nunca bloquea la importación.
      </p>
      <div className="flex flex-col divide-y divide-border-default">
        {headers.map((header) => (
          <div key={header} className="grid grid-cols-1 items-center gap-2 py-2.5 sm:grid-cols-[1fr_auto_1fr]">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{header}</p>
              <p className="truncate text-xs text-neutral-500">{sampleRows[0]?.[header] || "—"}</p>
            </div>
            <ArrowRight className="hidden size-4 text-neutral-400 sm:block" aria-hidden="true" />
            <Select
              label=""
              containerClassName="w-full"
              value={mapping[header] ?? ""}
              onChange={(e) => onChange({ ...mapping, [header]: e.target.value || null })}
            >
              <option value="">Sin mapear</option>
              {(["client", "policy", "dates", "commercial"] as ImportFieldEntity[]).map((entity) => (
                <optgroup key={entity} label={ENTITY_LABEL[entity]}>
                  {FIELD_DICTIONARY.filter((f) => f.entity === entity).map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={onConfirm} loading={isBusy}>
          Continuar <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Paso 4 — validación.
// ---------------------------------------------------------------------------

function IssueList({ title, items }: { title: string; items: { row: number; message: string }[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const preview = open ? items : items.slice(0, 5);
  return (
    <div className="rounded-md border border-border-default p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left text-sm font-medium text-foreground">
        {title} ({items.length})
        <span className="text-xs text-accent-600">{open ? "Ocultar" : "Ver todo"}</span>
      </button>
      <ul className="mt-2 flex flex-col gap-1 text-xs text-neutral-500">
        {preview.map((item, i) => (
          <li key={i}>
            Fila {item.row}: {item.message}
          </li>
        ))}
        {!open && items.length > 5 && <li>+ {items.length - 5} más…</li>}
      </ul>
    </div>
  );
}

function ValidationStep({ analysis, onBack, onContinue }: { analysis: ImportJobAnalysis; onBack: () => void; onContinue: () => void }) {
  const tiles: { label: string; value: number }[] = [
    { label: "Registros encontrados", value: analysis.totalRows },
    { label: "Clientes", value: analysis.clientsFound },
    { label: "Pólizas", value: analysis.policiesFound },
    { label: "Aseguradoras", value: analysis.insurersFound },
    { label: "Ramos/Subramos", value: analysis.branchesFound },
    { label: "Productos", value: analysis.productsFound },
  ];

  return (
    <Card>
      <CardHeader title="Paso 4 de 8 — Validación" />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-md bg-surface-2 p-3">
            <p className="font-mono text-xl font-semibold text-foreground">{t.value.toLocaleString("es")}</p>
            <p className="text-xs text-neutral-500">{t.label}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <IssueList title="Errores" items={analysis.errors} />
        <IssueList title="Advertencias" items={analysis.warnings} />
        <IssueList title="Registros incompletos" items={analysis.incomplete} />
        {(analysis.contactDuplicates > 0 || analysis.policyDuplicates > 0) && (
          <div className="flex items-center gap-2 rounded-md border border-warning-strong/30 bg-warning-bg p-3 text-sm text-warning-strong">
            <Copy className="size-4 shrink-0" aria-hidden="true" />
            {analysis.contactDuplicates} cliente(s) y {analysis.policyDuplicates} póliza(s) parecen ya existir — definís qué hacer en el próximo paso.
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden="true" /> Atrás
        </Button>
        <Button onClick={onContinue}>
          Continuar <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Paso 5 — resolución inteligente (fusión de aseguradoras/ramos/productos).
// ---------------------------------------------------------------------------

const ENTITY_TYPE_LABEL: Record<ImportLookupRow["entityType"], string> = {
  insurer: "Aseguradora",
  branch: "Ramo",
  subbranch: "Subramo",
  product: "Producto",
};

function ResolutionStep({
  lookups,
  onChange,
  onBack,
  onContinue,
  isBusy,
}: {
  lookups: ImportLookupRow[];
  onChange: (next: ImportLookupRow[]) => void;
  onBack: () => void;
  onContinue: () => void;
  isBusy: boolean;
}) {
  function updateOne(id: string, resolution: ImportLookupRow["resolution"]) {
    onChange(lookups.map((l) => (l.id === id ? { ...l, resolution } : l)));
  }

  return (
    <Card>
      <CardHeader title="Paso 5 de 8 — Resolución inteligente" />
      {lookups.length === 0 ? (
        <p className="text-sm text-neutral-500">No encontramos aseguradoras, ramos ni productos nuevos para revisar.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {lookups.map((l) => (
            <div key={l.id} className="flex flex-col gap-2 rounded-md border border-border-default p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs text-neutral-500">{ENTITY_TYPE_LABEL[l.entityType]}</p>
                <p className="truncate text-sm font-medium text-foreground">{l.fileValue}</p>
                {l.matchCandidateName && (
                  <p className="truncate text-xs text-neutral-500">
                    {l.isIntraFileMerge
                      ? <>Parece ser lo mismo que &quot;{l.matchCandidateName}&quot;, encontrado en este mismo archivo ({Math.round((l.matchScore ?? 0) * 100)}% similar)</>
                      : <>Parecido a &quot;{l.matchCandidateName}&quot; ya existente en tu catálogo ({Math.round((l.matchScore ?? 0) * 100)}% similar)</>}
                  </p>
                )}
              </div>
              <Select label="" containerClassName="w-full sm:w-56" value={l.resolution} onChange={(e) => updateOne(l.id, e.target.value as ImportLookupRow["resolution"])}>
                {l.matchCandidateName && (
                  <option value="use_existing">Unificar con &quot;{l.matchCandidateName}&quot;</option>
                )}
                <option value="create_new">Crear como nuevo</option>
                <option value="skip">Omitir</option>
              </Select>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden="true" /> Atrás
        </Button>
        <Button onClick={onContinue} loading={isBusy}>
          Continuar <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Paso 6 — configuración.
// ---------------------------------------------------------------------------

const CONFIG_CHECKBOXES: { key: keyof ImportJobConfig; label: string }[] = [
  { key: "createClients", label: "Crear clientes automáticamente" },
  { key: "createInsurers", label: "Crear aseguradoras automáticamente" },
  { key: "createBranches", label: "Crear ramos automáticamente" },
  { key: "createProducts", label: "Crear productos automáticamente" },
  { key: "updateExisting", label: "Actualizar registros existentes" },
  { key: "skipDuplicates", label: "Omitir duplicados" },
  { key: "createRenewals", label: "Crear renovaciones" },
  { key: "importObservations", label: "Importar observaciones" },
  { key: "assignToCurrentAdvisor", label: "Asignar todas las pólizas al asesor actual" },
];

function ConfigStep({
  config,
  onChange,
  onBack,
  onContinue,
  isBusy,
}: {
  config: ImportJobConfig;
  onChange: (next: ImportJobConfig) => void;
  onBack: () => void;
  onContinue: () => void;
  isBusy: boolean;
}) {
  return (
    <Card>
      <CardHeader title="Paso 6 de 8 — Configuración" />
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CONFIG_CHECKBOXES.map((item) => (
          <label key={item.key} className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={Boolean(config[item.key])}
              onChange={(e) => onChange({ ...config, [item.key]: e.target.checked })}
              className="size-4 rounded-xs border-border-strong text-accent-500 focus-visible:outline-2 focus-visible:outline-accent-500"
            />
            {item.label}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Si un cliente ya existe"
          value={config.contactDuplicateStrategy}
          onChange={(e) => onChange({ ...config, contactDuplicateStrategy: e.target.value as ImportJobConfig["contactDuplicateStrategy"] })}
        >
          <option value="update">Actualizar existente</option>
          <option value="create_new">Crear nuevo</option>
          <option value="skip">Omitir</option>
        </Select>
        <Select
          label="Si una póliza ya existe"
          value={config.policyDuplicateStrategy}
          onChange={(e) => onChange({ ...config, policyDuplicateStrategy: e.target.value as ImportJobConfig["policyDuplicateStrategy"] })}
        >
          <option value="update">Actualizar</option>
          <option value="skip">Ignorar</option>
          <option value="duplicate">Duplicar</option>
        </Select>
      </div>
      <div className="mt-4 flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden="true" /> Atrás
        </Button>
        <Button onClick={onContinue} loading={isBusy}>
          Iniciar importación <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Paso 7 — importación (progreso real, no animado).
// ---------------------------------------------------------------------------

function ProgressStep({ job, progress, onCancel }: { job: ImportJobRecord | null; progress: { total: number; done: number }; onCancel: () => void }) {
  const phaseIndex = job ? Math.max(0, PHASE_ORDER.indexOf(job.phase)) : 0;
  const phasePct = (phaseIndex / (PHASE_ORDER.length - 1)) * 100;
  const rowPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Card className="flex flex-col items-center gap-4 py-10 text-center">
      <Loader2 className="size-8 animate-spin text-accent-500" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{PHASE_LABEL[job?.phase ?? "idle"]}</p>
      <div className="w-full max-w-md">
        <ProgressBar value={phasePct} />
      </div>
      {progress.total > 0 && (
        <p className="text-xs text-neutral-500">
          {progress.done.toLocaleString("es")} / {progress.total.toLocaleString("es")} pólizas procesadas ({rowPct}%)
        </p>
      )}
      <Button variant="secondary" size="sm" onClick={onCancel}>
        Cancelar importación
      </Button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Paso 8 — resultado.
// ---------------------------------------------------------------------------

function ResultsStep({
  job,
  errors,
  onViewErrors,
  onRestart,
}: {
  job: ImportJobRecord;
  errors: { rowNumber: number; errorMessage: string }[] | null;
  onViewErrors: () => void;
  onRestart: () => void;
}) {
  const failed = job.status === "failed" || job.status === "cancelled";
  const tiles: { label: string; value: number }[] = [
    { label: "Pólizas creadas", value: job.totals.policiesCreated },
    { label: "Clientes creados", value: job.totals.clientsCreated },
    { label: "Aseguradoras creadas", value: job.totals.insurersCreated },
    { label: "Ramos/Subramos creados", value: job.totals.branchesCreated },
    { label: "Clientes actualizados", value: job.totals.clientsUpdated },
    { label: "Pólizas actualizadas", value: job.totals.policiesUpdated },
  ];

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        {failed ? <AlertTriangle className="size-5 text-error-strong" aria-hidden="true" /> : <CheckCircle2 className="size-5 text-success-strong" aria-hidden="true" />}
        <h3 className="text-[15px] font-medium text-foreground">{failed ? "Importación cancelada" : "Importación finalizada"}</h3>
      </div>
      {!failed && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-md bg-surface-2 p-3">
              <p className="font-mono text-xl font-semibold text-foreground">{t.value.toLocaleString("es")}</p>
              <p className="text-xs text-neutral-500">{t.label}</p>
            </div>
          ))}
        </div>
      )}
      {job.totals.errors > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-error-strong/30 bg-error-bg p-3 text-sm text-error-strong">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {job.totals.errors} fila(s) con errores.
        </div>
      )}
      {errors && (
        <ul className="mb-4 flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border border-border-default p-3 text-xs text-neutral-500">
          {errors.length === 0 ? <li>Sin errores.</li> : errors.map((e, i) => <li key={i}>Fila {e.rowNumber}: {e.errorMessage}</li>)}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {job.totals.errors > 0 && (
          <Button variant="secondary" onClick={onViewErrors}>
            Ver errores
          </Button>
        )}
        <LinkButton href="/advisors">Ir a Pólizas</LinkButton>
        <Button variant="secondary" onClick={onRestart}>
          Importar otro archivo
        </Button>
      </div>
    </Card>
  );
}
