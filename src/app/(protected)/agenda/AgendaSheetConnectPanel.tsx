"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, FileSpreadsheet, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/toast/toast";
import { ADVISOR_SYNC_FIELD_DICTIONARY, type AdvisorSyncFieldKey } from "@/lib/advisorSync/fieldDictionary";
import { AGENDA_ROW_PROBLEM_LABELS } from "@/lib/advisorSync/sheetRows";
import { ESTADO_CITA_META } from "@/lib/agenda/estadoMeta";
import { ESTADO_VALUES, PRODUCTO_OPTIONS, TIPO_CITA_OPTIONS, suggestEquivalence, type EquivalenceKind, type ValueMap } from "@/lib/agenda/sheetValueOptions";
import {
  inspectAgendaSpreadsheetAction,
  inspectAgendaSheetTabAction,
  previewAgendaSheetImportAction,
  saveAgendaSheetAndSyncAction,
} from "@/lib/agenda/sheetPanelActions";
import type { AgendaSheetConfigInput, AgendaSheetPreview, AgendaSheetStatus, AgendaSheetTabInspection } from "@/lib/agenda/sheetPanelTypes";

/** Nombres de los campos tal como los pide el panel (el diccionario es compartido con Perfil →
 * Integraciones, que usa otros textos). */
const FIELD_LABEL_OVERRIDES: Partial<Record<AdvisorSyncFieldKey, string>> = {
  date: "Fecha de cita",
  time: "Hora",
  leadName: "Nombre",
  phone: "Teléfono",
  notes: "Notas",
  contactado: "Contactado (Sí/No)",
  estado: "Estado de cita",
  producto: "Producto",
  appointmentType: "Tipo de cita",
  setterName: "Setter",
  advisorName: "Asesor",
  email: "Email",
  externalId: "ID externo",
};
const FIELD_ORDER: AdvisorSyncFieldKey[] = ["date", "time", "leadName", "notes", "phone", "contactado", "estado", "producto", "appointmentType", "email", "setterName", "advisorName", "externalId"];
const fieldLabel = (key: AdvisorSyncFieldKey) => FIELD_LABEL_OVERRIDES[key] ?? ADVISOR_SYNC_FIELD_DICTIONARY.find((f) => f.key === key)?.label ?? key;

const EQUIVALENCE_SECTIONS: { kind: EquivalenceKind; title: string }[] = [
  { kind: "estado", title: "Estado" },
  { kind: "producto", title: "Producto" },
  { kind: "appointmentType", title: "Tipo de cita" },
];

const KEEP = "";

function optionsFor(kind: EquivalenceKind): { value: string; label: string }[] {
  if (kind === "estado") return ESTADO_VALUES.map((v) => ({ value: v, label: ESTADO_CITA_META[v].label }));
  const list = kind === "producto" ? PRODUCTO_OPTIONS : TIPO_CITA_OPTIONS;
  return [{ value: KEEP, label: "Dejar como está en la hoja" }, ...list.map((v) => ({ value: v, label: v }))];
}

function utcLabel(offsetMinutes: number): string {
  const hours = -offsetMinutes / 60;
  return `UTC${hours >= 0 ? "+" : ""}${hours}`;
}

function StepTitle({ n, title, done }: { n: number; title: string; done: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={`flex size-6 items-center justify-center rounded-full text-[12px] font-semibold ${done ? "bg-success-strong text-white" : "bg-surface-3 text-neutral-600"}`}>
        {done ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : n}
      </span>
      <h3 className="text-[14px] font-semibold text-foreground">
        Paso {n} · {title}
      </h3>
    </div>
  );
}

export function AgendaSheetConnectPanel({ open, onClose, status, onSynced }: { open: boolean; onClose: () => void; status: AgendaSheetStatus | null; onSynced: () => void }) {
  // El padre remonta el panel (key) cada vez que se abre: el estado inicial sale de la hoja ya
  // configurada, sin sincronizar estado dentro de un efecto.
  const saved = status?.connection ?? null;
  const [urlInput, setUrlInput] = useState(saved ? `https://docs.google.com/spreadsheets/d/${saved.spreadsheetId}/edit` : "");
  const [spreadsheet, setSpreadsheet] = useState<{ spreadsheetId: string; title: string; tabs: { title: string; gid: string }[] } | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [headerRowInput, setHeaderRowInput] = useState("");
  const [inspection, setInspection] = useState<AgendaSheetTabInspection | null>(null);
  const [columnMap, setColumnMap] = useState<Record<string, AdvisorSyncFieldKey | "">>({});
  const [valueMap, setValueMap] = useState<ValueMap>(saved?.valueMap ?? {});
  const [createLeads, setCreateLeads] = useState(saved?.options.create_leads ?? true);
  const [writeBack, setWriteBack] = useState(saved?.options.write_back ?? true);
  const [preview, setPreview] = useState<AgendaSheetPreview | null>(null);
  const [loading, setLoading] = useState<null | "spreadsheet" | "tab" | "preview" | "import">(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const utcOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);

  // Al abrir con una hoja ya conectada: se vuelve a leer tal cual quedó configurada.
  useEffect(() => {
    if (!open || !saved || !status?.account.connected) return;
    Promise.resolve().then(() => loadSpreadsheet(`https://docs.google.com/spreadsheets/d/${saved.spreadsheetId}/edit`, saved.sheetName, saved.headerRow, saved.columnMap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadSpreadsheet(input: string, preferredTab?: string, headerRow?: number, savedColumnMap?: Record<string, AdvisorSyncFieldKey>) {
    setLoading("spreadsheet");
    setError(null);
    try {
      const result = await inspectAgendaSpreadsheetAction(input);
      setSpreadsheet(result);
      const tab = result.tabs.find((t) => t.title === preferredTab)?.title ?? result.tabs[0]?.title ?? "";
      setSheetName(tab);
      if (tab) await loadTab(result.spreadsheetId, tab, headerRow, savedColumnMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la hoja.");
    } finally {
      setLoading(null);
    }
  }

  async function loadTab(spreadsheetId: string, tab: string, headerRow?: number, savedColumnMap?: Record<string, AdvisorSyncFieldKey>) {
    setLoading("tab");
    setError(null);
    setPreview(null);
    try {
      const result = await inspectAgendaSheetTabAction({ spreadsheetId, sheetName: tab, headerRow });
      setInspection(result);
      setHeaderRowInput(String(result.headerRow));
      const next: Record<string, AdvisorSyncFieldKey | ""> = {};
      for (const col of result.columns) next[col.header] = savedColumnMap?.[col.header] ?? col.suggestion ?? "";
      setColumnMap(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer la pestaña.");
    } finally {
      setLoading(null);
    }
  }

  function setField(header: string, field: AdvisorSyncFieldKey | "") {
    setPreview(null);
    setColumnMap((prev) => {
      const next = { ...prev };
      // Un campo del CRM, una sola columna.
      if (field) for (const h of Object.keys(next)) if (next[h] === field) next[h] = "";
      next[header] = field;
      return next;
    });
  }

  const cleanColumnMap = useMemo(() => Object.fromEntries(Object.entries(columnMap).filter(([, v]) => v)) as Record<string, AdvisorSyncFieldKey>, [columnMap]);
  const mappedFields = new Set(Object.values(cleanColumnMap));
  const mappingComplete = mappedFields.has("leadName") && mappedFields.has("phone") && mappedFields.has("date");

  // Valores distintos de las columnas mapeadas a Estado / Producto / Tipo de cita.
  const equivalenceValues = useMemo(() => {
    const out: Partial<Record<EquivalenceKind, string[]>> = {};
    for (const { kind } of EQUIVALENCE_SECTIONS) {
      const header = Object.entries(cleanColumnMap).find(([, f]) => f === kind)?.[0];
      const col = inspection?.columns.find((c) => c.header === header);
      if (col) out[kind] = col.distinctValues;
    }
    return out;
  }, [cleanColumnMap, inspection]);

  function equivalenceFor(kind: EquivalenceKind, raw: string): string {
    const chosen = valueMap[kind]?.[raw];
    if (chosen !== undefined) return chosen;
    const suggested = suggestEquivalence(kind, raw);
    if (suggested) return suggested;
    return kind === "estado" ? "agendada" : KEEP;
  }

  function setEquivalence(kind: EquivalenceKind, raw: string, value: string) {
    setPreview(null);
    setValueMap((prev) => ({ ...prev, [kind]: { ...(prev[kind] ?? {}), [raw]: value } }));
  }

  /** Lo que se guarda: la equivalencia efectiva de cada valor que hoy aparece en la hoja (también
   * las sugeridas, así quedan fijas aunque cambie la lógica de sugerencias). "Dejar como está" no
   * se guarda (sin entrada = texto tal cual). */
  function buildValueMap(): ValueMap {
    const out: ValueMap = {};
    for (const { kind } of EQUIVALENCE_SECTIONS) {
      const entries: Record<string, string> = { ...(valueMap[kind] ?? {}) };
      for (const raw of equivalenceValues[kind] ?? []) entries[raw] = equivalenceFor(kind, raw);
      const filtered = Object.fromEntries(Object.entries(entries).filter(([, v]) => v !== KEEP));
      if (Object.keys(filtered).length > 0) out[kind] = filtered;
    }
    return out;
  }

  function buildConfig(): AgendaSheetConfigInput | null {
    if (!spreadsheet || !sheetName || !inspection) return null;
    return {
      spreadsheetId: spreadsheet.spreadsheetId,
      spreadsheetTitle: spreadsheet.title,
      sheetName,
      sheetGid: spreadsheet.tabs.find((t) => t.title === sheetName)?.gid ?? null,
      headerRow: inspection.headerRow,
      columnMap: cleanColumnMap,
      valueMap: buildValueMap(),
      options: { create_leads: createLeads, write_back: writeBack },
      utcOffsetMinutes,
    };
  }

  function runPreview() {
    const config = buildConfig();
    if (!config) return;
    setLoading("preview");
    setError(null);
    startTransition(async () => {
      try {
        setPreview(await previewAgendaSheetImportAction(config));
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo armar la vista previa.");
      } finally {
        setLoading(null);
      }
    });
  }

  function runImport() {
    const config = buildConfig();
    if (!config) return;
    setLoading("import");
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveAgendaSheetAndSyncAction(config);
        if (!result.ok) throw new Error(result.message ?? "La hoja quedó guardada pero no se pudo sincronizar.");
        toast.success(
          "Hoja conectada y sincronizada",
          `${result.created} citas nuevas, ${result.updated} actualizadas, ${result.newLeads} leads nuevos${result.errors ? ` · ${result.errors} filas con problemas` : ""}.`,
        );
        onSynced();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo importar.");
      } finally {
        setLoading(null);
      }
    });
  }

  const accountConnected = Boolean(status?.account.connected);
  const busy = loading !== null;

  return (
    <Sheet open={open} onClose={onClose} title="Conectar hoja de agendas" className="max-w-2xl">
      <div className="flex flex-col gap-6 px-5 py-5">
        <p className="text-[13px] text-neutral-500">
          Las citas de tu hoja de Google Sheets aparecen en la Agenda y cada persona queda guardada como lead. Se actualiza cuando tocás <strong>Sincronizar ahora</strong>.
        </p>

        {/* Paso 1 — Hoja */}
        <section>
          <StepTitle n={1} title="Hoja" done={Boolean(inspection)} />
          <div className="flex flex-col gap-3 rounded-lg border border-border-default p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <span className="text-neutral-500">Cuenta de Google</span>
              {accountConnected ? (
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <span className="size-2 rounded-full bg-success-strong" aria-hidden="true" />
                  {status?.account.email}
                </span>
              ) : (
                <a href="/api/integrations/google-sheets-export/connect?return=agenda" className="font-medium text-accent-600 hover:text-accent-700">
                  Conectar cuenta de Google →
                </a>
              )}
            </div>

            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
              URL o ID de la hoja
              <div className="flex gap-2">
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  disabled={!accountConnected}
                  className="min-w-0 flex-1 rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-[13px] font-normal"
                />
                <Button size="sm" variant="secondary" disabled={!accountConnected || !urlInput.trim() || busy} onClick={() => void loadSpreadsheet(urlInput)}>
                  {loading === "spreadsheet" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Buscar"}
                </Button>
              </div>
            </label>

            {spreadsheet && (
              <>
                <p className="flex items-center gap-1.5 text-[13px] text-foreground">
                  <FileSpreadsheet className="size-4 text-success-strong" aria-hidden="true" />
                  <strong>{spreadsheet.title}</strong>
                  <a href={`https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}/edit`} target="_blank" rel="noreferrer" className="text-accent-600" aria-label="Abrir hoja">
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
                    Pestaña
                    <select
                      value={sheetName}
                      disabled={busy}
                      onChange={(e) => {
                        setSheetName(e.target.value);
                        void loadTab(spreadsheet.spreadsheetId, e.target.value);
                      }}
                      className="rounded-md border border-border-strong bg-surface-1 px-2.5 py-2 text-[13px] font-normal"
                    >
                      {spreadsheet.tabs.map((t) => (
                        <option key={t.gid} value={t.title}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
                    Fila de títulos
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min={1}
                        value={headerRowInput}
                        onChange={(e) => setHeaderRowInput(e.target.value)}
                        className="w-full rounded-md border border-border-strong bg-surface-1 px-2.5 py-2 text-[13px] font-normal"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Volver a leer con esta fila"
                        disabled={busy || !Number(headerRowInput)}
                        onClick={() => void loadTab(spreadsheet.spreadsheetId, sheetName, Number(headerRowInput))}
                      >
                        <RefreshCw className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </label>
                </div>
              </>
            )}
            {loading === "tab" && (
              <p className="flex items-center gap-2 text-[13px] text-neutral-500">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Leyendo la pestaña…
              </p>
            )}
          </div>
        </section>

        {/* Paso 2 — Mapeo de columnas */}
        {inspection && (
          <section>
            <StepTitle n={2} title="Mapeo de columnas" done={mappingComplete} />
            <div className="overflow-hidden rounded-lg border border-border-default">
              <table className="w-full text-[13px]">
                <thead className="bg-surface-2 text-left text-[12px] text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Columna de la hoja</th>
                    <th className="px-3 py-2 font-medium">Campo del CRM</th>
                  </tr>
                </thead>
                <tbody>
                  {inspection.columns.map((col) => (
                    <tr key={col.letter} className="border-t border-border-default">
                      <td className="px-3 py-2">
                        <span className="mr-2 inline-flex size-5 items-center justify-center rounded bg-surface-3 text-[11px] font-semibold text-neutral-600">{col.letter}</span>
                        <span className="font-medium text-foreground">{col.header}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={columnMap[col.header] ?? ""}
                          onChange={(e) => setField(col.header, e.target.value as AdvisorSyncFieldKey | "")}
                          className="w-full rounded-md border border-border-strong bg-surface-1 px-2 py-1.5 text-[13px]"
                        >
                          <option value="">No importar</option>
                          {FIELD_ORDER.map((key) => (
                            <option key={key} value={key}>
                              {fieldLabel(key)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!mappingComplete && <p className="mt-2 text-[12.5px] text-warning-strong">Mapeá al menos Nombre, Teléfono y Fecha de cita.</p>}
          </section>
        )}

        {/* Paso 3 — Equivalencias */}
        {inspection && mappingComplete && (
          <section>
            <StepTitle n={3} title="Equivalencias" done />
            <div className="flex flex-col gap-4">
              {EQUIVALENCE_SECTIONS.map(({ kind, title }) => {
                const values = equivalenceValues[kind];
                if (!values) return null;
                return (
                  <div key={kind} className="rounded-lg border border-border-default">
                    <p className="border-b border-border-default bg-surface-2 px-3 py-2 text-[12.5px] font-semibold text-foreground">{title}</p>
                    {values.length === 0 ? (
                      <p className="px-3 py-2.5 text-[12.5px] text-neutral-500">La columna todavía no tiene valores.</p>
                    ) : (
                      <ul>
                        {values.map((raw) => (
                          <li key={raw} className="flex items-center gap-3 border-t border-border-default px-3 py-1.5 first:border-t-0">
                            <span className="min-w-0 flex-1 truncate text-[13px] text-foreground" title={raw}>
                              “{raw}”
                            </span>
                            <span className="text-neutral-400" aria-hidden="true">
                              →
                            </span>
                            <select
                              value={equivalenceFor(kind, raw)}
                              onChange={(e) => setEquivalence(kind, raw, e.target.value)}
                              aria-label={`Equivalencia de ${raw}`}
                              className="w-48 rounded-md border border-border-strong bg-surface-1 px-2 py-1.5 text-[13px]"
                            >
                              {optionsFor(kind).map((o) => (
                                <option key={o.value || "keep"} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              {Object.keys(equivalenceValues).length === 0 && <p className="text-[12.5px] text-neutral-500">No mapeaste Estado, Producto ni Tipo de cita — no hay equivalencias para elegir.</p>}
            </div>
          </section>
        )}

        {/* Paso 4 — Opciones */}
        {inspection && mappingComplete && (
          <section>
            <StepTitle n={4} title="Opciones" done />
            <div className="flex flex-col divide-y divide-border-default rounded-lg border border-border-default">
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium text-foreground">Crear el lead si no existe</p>
                  <p className="text-[12.5px] text-neutral-500">Se busca por teléfono (solo dígitos) para no duplicar; si ya existe, se actualiza.</p>
                </div>
                <Switch
                  checked={createLeads}
                  onChange={(v) => {
                    setCreateLeads(v);
                    setPreview(null);
                  }}
                  label="Crear el lead si no existe"
                />
              </div>
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium text-foreground">Escribir cambios de vuelta en la hoja</p>
                  <p className="text-[12.5px] text-neutral-500">Si cambiás el estado de una cita en el CRM, se actualiza la celda de ESTADO de esa fila.</p>
                </div>
                <Switch checked={writeBack} onChange={setWriteBack} label="Escribir cambios de vuelta en la hoja" />
              </div>
              <div className="px-4 py-3 text-[12.5px] text-neutral-500">
                Sincronización manual: la Agenda se actualiza cuando tocás <strong>Sincronizar ahora</strong>. Horas de la hoja en tu zona horaria ({utcLabel(utcOffsetMinutes)}).
              </div>
            </div>
          </section>
        )}

        {/* Vista previa */}
        {preview && (
          <section className="rounded-lg border border-accent-500/40 bg-accent-500/5 p-4">
            <h3 className="mb-3 text-[14px] font-semibold text-foreground">Vista previa</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Citas", value: preview.citas },
                { label: "Leads nuevos", value: preview.nuevosLeads },
                { label: "Leads que ya existen", value: preview.leadsExistentes },
                { label: "Filas con problemas", value: preview.problems.length },
              ].map((k) => (
                <div key={k.label} className="rounded-md bg-surface-1 px-3 py-2">
                  <p className="text-[11.5px] text-neutral-500">{k.label}</p>
                  <p className="text-[18px] font-semibold tabular-nums text-foreground">{k.value}</p>
                </div>
              ))}
            </div>
            {!createLeads && preview.nuevosLeads > 0 && (
              <p className="mt-3 text-[12.5px] text-warning-strong">“Crear el lead si no existe” está apagado: las citas de los {preview.nuevosLeads} leads nuevos no se van a importar.</p>
            )}
            {preview.problems.length > 0 && (
              <ul className="mt-3 flex max-h-48 flex-col gap-1 overflow-y-auto text-[12.5px]">
                {preview.problems.map((p) => (
                  <li key={p.rowNumber} className="flex items-center gap-2 text-neutral-600">
                    <AlertTriangle className="size-3.5 shrink-0 text-warning-strong" aria-hidden="true" />
                    <span>
                      Fila {p.rowNumber} · {p.name}: {p.problems.map((x) => AGENDA_ROW_PROBLEM_LABELS[x]).join(", ")}
                      {p.problems.every((x) => x === "sin_hora") ? " (se importa “sin hora”)" : " (no se importa)"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {error && <p className="rounded-md bg-error-bg px-3 py-2 text-[13px] text-error-strong">{error}</p>}

        <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-border-default bg-surface-1 px-5 py-3">
          <Button variant="ghost" onClick={onClose} disabled={loading === "import"}>
            Cancelar
          </Button>
          {preview ? (
            <Button onClick={runImport} disabled={busy}>
              {loading === "import" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Importar y sincronizar
            </Button>
          ) : (
            <Button onClick={runPreview} disabled={busy || !mappingComplete}>
              {loading === "preview" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Ver vista previa
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
