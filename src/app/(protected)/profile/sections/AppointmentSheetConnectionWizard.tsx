"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/toast/toast";
import { inspectAppointmentSpreadsheetAction, inspectAppointmentSheetColumnsAction, saveAppointmentSheetConnectionAction } from "@/lib/appointmentSync/actions";
import { APPOINTMENT_SYNC_FIELD_DICTIONARY, type AppointmentSyncFieldKey } from "@/lib/appointmentSync/fieldDictionary";

/** Calco de LeadSheetConnectionWizard.tsx sin los pasos de pipeline/etapa —
 * acá no se crea ninguna oportunidad, solo una cita (ver plan del Sistema
 * de Agendas). Un solo formulario progresivo: hoja → mapeo de columnas. */
export function AppointmentSheetConnectionWizard({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [spreadsheetInput, setSpreadsheetInput] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<{ sheetId: number; title: string }[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [loadingTabs, setLoadingTabs] = useState(false);

  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, AppointmentSyncFieldKey | "">>({});
  const [loadingColumns, setLoadingColumns] = useState(false);

  const [saving, setSaving] = useState(false);

  async function handleInspectSpreadsheet() {
    if (!spreadsheetInput.trim()) return;
    setLoadingTabs(true);
    try {
      const result = await inspectAppointmentSpreadsheetAction(spreadsheetInput);
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
      const result = await inspectAppointmentSheetColumnsAction(spreadsheetId, sheetName);
      setHeaders(result.headers);
      const suggested: Record<string, AppointmentSyncFieldKey | ""> = {};
      for (const s of result.suggestions) suggested[s.header] = s.fieldKey ?? "";
      setColumnMap(suggested);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron leer las columnas de esa hoja.");
    } finally {
      setLoadingColumns(false);
    }
  }

  async function handleSave() {
    if (!spreadsheetId || !sheetName) {
      toast.error("Elegí la hoja antes de guardar.");
      return;
    }
    const finalMap = Object.fromEntries(Object.entries(columnMap).filter(([, v]) => v !== "")) as Record<string, AppointmentSyncFieldKey>;
    setSaving(true);
    try {
      await saveAppointmentSheetConnectionAction({
        spreadsheetId,
        sheetGid: tabs.find((t) => t.title === sheetName)?.sheetId.toString() ?? null,
        sheetName,
        columnMap: finalMap,
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
    <Sheet open onClose={onClose} title="Conectar Google Sheets (Agenda)" className="max-w-lg">
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
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">2. Mapeo de columnas</p>
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
                      onChange={(e) => setColumnMap((prev) => ({ ...prev, [header]: e.target.value as AppointmentSyncFieldKey | "" }))}
                    >
                      <option value="">— No usar —</option>
                      {APPOINTMENT_SYNC_FIELD_DICTIONARY.map((f) => (
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
          <Button onClick={handleSave} loading={saving} disabled={!spreadsheetId || !sheetName}>
            Guardar conexión
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
