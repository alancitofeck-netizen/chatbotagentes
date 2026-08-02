"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/toast/toast";
import { getCrmPipelinesAction } from "@/lib/crm/actions";
import { getWorkspaceMembersAction } from "@/lib/inbox/actions";
import {
  inspectSpreadsheetAction,
  inspectSheetColumnsAction,
  saveLeadSheetConnectionAction,
  getPipelineStageOptionsAction,
} from "@/lib/leadSync/actions";
import type { PipelineStageOption } from "@/lib/leadSync/queries";
import { LEAD_SYNC_FIELD_DICTIONARY, type LeadSyncFieldKey } from "@/lib/leadSync/fieldDictionary";

/** Single-page progressive form instead of a step-indicator wizard chrome —
 * appropriate for Fase A's "UI mínima" (ver plan): elegir hoja → elegir
 * pipeline/etapa/agente por defecto → mapear columnas, cada sección se
 * habilita cuando la anterior está resuelta. El wizard completo con vista
 * previa fila-a-fila queda para la fase del panel de administración. */
export function LeadSheetConnectionWizard({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [spreadsheetInput, setSpreadsheetInput] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<{ sheetId: number; title: string }[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [loadingTabs, setLoadingTabs] = useState(false);

  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, LeadSyncFieldKey | "">>({});
  const [loadingColumns, setLoadingColumns] = useState(false);

  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [pipelineId, setPipelineId] = useState("");
  const [stages, setStages] = useState<PipelineStageOption[]>([]);
  const [defaultStageId, setDefaultStageId] = useState("");
  const [members, setMembers] = useState<{ memberId: string; fullName: string }[]>([]);
  const [defaultOwnerId, setDefaultOwnerId] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCrmPipelinesAction().then((data) => {
      setPipelines(data);
      if (data.length === 1) setPipelineId(data[0].id);
    });
    getWorkspaceMembersAction().then((data) => setMembers(data.map((m) => ({ memberId: m.memberId, fullName: m.fullName }))));
  }, []);

  useEffect(() => {
    if (!pipelineId) {
      Promise.resolve().then(() => setStages([]));
      return;
    }
    getPipelineStageOptionsAction(pipelineId).then(setStages);
  }, [pipelineId]);

  async function handleInspectSpreadsheet() {
    if (!spreadsheetInput.trim()) return;
    setLoadingTabs(true);
    try {
      const result = await inspectSpreadsheetAction(spreadsheetInput);
      setSpreadsheetId(result.spreadsheetId);
      setTabs(result.sheets);
      if (result.sheets.length === 1) setSheetName(result.sheets[0].title);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo leer ese archivo de Google Sheets.");
    } finally {
      setLoadingTabs(false);
    }
  }

  async function handleInspectColumns() {
    if (!spreadsheetId || !sheetName) return;
    setLoadingColumns(true);
    try {
      const result = await inspectSheetColumnsAction(spreadsheetId, sheetName);
      setHeaders(result.headers);
      const suggested: Record<string, LeadSyncFieldKey | ""> = {};
      for (const s of result.suggestions) suggested[s.header] = s.fieldKey ?? "";
      setColumnMap(suggested);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron leer las columnas de esa hoja.");
    } finally {
      setLoadingColumns(false);
    }
  }

  async function handleSave() {
    if (!spreadsheetId || !sheetName || !pipelineId || !defaultStageId) {
      toast.error("Completá hoja, pipeline y etapa por defecto antes de guardar.");
      return;
    }
    const finalMap = Object.fromEntries(Object.entries(columnMap).filter(([, v]) => v !== "")) as Record<string, LeadSyncFieldKey>;
    setSaving(true);
    try {
      await saveLeadSheetConnectionAction({
        spreadsheetId,
        sheetGid: tabs.find((t) => t.title === sheetName)?.sheetId.toString() ?? null,
        sheetName,
        columnMap: finalMap,
        pipelineId,
        defaultStageId,
        defaultOwnerId: defaultOwnerId || null,
      });
      toast.success("Conexión creada — el primer sync corre en los próximos minutos.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Conectar Google Sheets (Leads)" className="max-w-lg">
      <div className="flex flex-col gap-5 p-5">
        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">1. Hoja</p>
          <div className="flex gap-2">
            <Input
              label=""
              containerClassName="flex-1"
              placeholder="Link o ID de la Google Sheet"
              value={spreadsheetInput}
              onChange={(e) => setSpreadsheetInput(e.target.value)}
            />
            <Button size="sm" variant="secondary" onClick={handleInspectSpreadsheet} loading={loadingTabs}>
              Buscar
            </Button>
          </div>
          {tabs.length > 0 && (
            <Select label="Pestaña" value={sheetName} onChange={(e) => setSheetName(e.target.value)}>
              <option value="">Elegí una pestaña</option>
              {tabs.map((t) => (
                <option key={t.sheetId} value={t.title}>
                  {t.title}
                </option>
              ))}
            </Select>
          )}
        </section>

        {sheetName && (
          <section className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">2. Pipeline destino</p>
            <Select label="Pipeline" value={pipelineId} onChange={(e) => setPipelineId(e.target.value)}>
              <option value="">Elegí un pipeline</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {pipelineId && (
              <Select label="Etapa por defecto" value={defaultStageId} onChange={(e) => setDefaultStageId(e.target.value)}>
                <option value="">Elegí una etapa</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
            <Select label="Agente por defecto (opcional)" value={defaultOwnerId} onChange={(e) => setDefaultOwnerId(e.target.value)}>
              <option value="">Sin asignar</option>
              {members.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {m.fullName}
                </option>
              ))}
            </Select>
          </section>
        )}

        {sheetName && defaultStageId && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">3. Mapeo de columnas</p>
              {headers.length === 0 && (
                <Button size="sm" variant="secondary" onClick={handleInspectColumns} loading={loadingColumns}>
                  Leer columnas
                </Button>
              )}
            </div>
            {headers.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-border-default p-3">
                {headers.map((header) => (
                  <div key={header} className="flex items-center gap-2">
                    <span className="w-1/2 truncate text-[13px] text-foreground" title={header}>
                      {header}
                    </span>
                    <Select
                      label=""
                      containerClassName="flex-1"
                      value={columnMap[header] ?? ""}
                      onChange={(e) => setColumnMap((prev) => ({ ...prev, [header]: e.target.value as LeadSyncFieldKey | "" }))}
                    >
                      <option value="">— No usar —</option>
                      {LEAD_SYNC_FIELD_DICTIONARY.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                          {f.required ? " *" : ""}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="flex justify-end gap-2 border-t border-border-default pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!spreadsheetId || !sheetName || !pipelineId || !defaultStageId}>
            Guardar conexión
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
