"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, FileSpreadsheet, RefreshCw, Settings2, AlertTriangle, ExternalLink, CalendarDays } from "lucide-react";
import { getAgendaAppointmentsAction } from "@/lib/agenda/actions";
import type { AgendaAppointment, EstadoCita } from "@/lib/agenda/queries";
import { ESTADO_CITA_META, ESTADO_CITA_OPTIONS } from "@/lib/agenda/estadoMeta";
import { getAgendaSheetStatusAction, syncAgendaSheetNowAction } from "@/lib/agenda/sheetPanelActions";
import type { AgendaSheetStatus } from "@/lib/agenda/sheetPanelTypes";
import { toast } from "@/components/toast/toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet } from "@/components/ui/Sheet";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";
import { AgendaSheetConnectPanel } from "./AgendaSheetConnectPanel";
import { AgendaLeadsSection } from "./AgendaLeadsSection";
import { AgendaWeekStrip } from "./AgendaWeekStrip";
import { AgendaStatsRow } from "./AgendaStatsRow";
import { AgendaCitaAccordionCard } from "./AgendaCitaAccordionCard";
import { AgendaRecordForm, type AgendaRecordFormRecord } from "./AgendaRecordForm";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

const LISTA_DAYS_BACK = 90;
const LISTA_DAYS_FORWARD = 60;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function formatMinutesAgo(iso: string): string {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return "un momento";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} h`;
  return `${Math.round(diffH / 24)} d`;
}
function citaToRecord(cita: AgendaAppointment): AgendaRecordFormRecord {
  return {
    appointmentId: cita.id,
    appointmentWorkspaceId: cita.workspaceId,
    name: cita.contactName ?? "",
    phone: cita.contactPhone,
    email: cita.contactEmail,
    producto: cita.producto,
    appointmentType: cita.appointmentType,
    setterName: cita.setterName,
    notas: cita.notes,
    estadoCita: cita.estadoCita,
    startTime: cita.startTime,
    sinHora: cita.sinHora,
    fromSheet: cita.fromSheet,
  };
}

/** Vista operativa de Agenda ("Citas") — rediseño (pedido explícito: que se vea y funcione como
 * agenda-movil.html, también en escritorio): franja de días de la semana + 3 stats + tarjetas de
 * cita expandibles en el lugar, más el formulario compartido para crear/editar a mano
 * (AgendaRecordForm). Todo sobre agenda_appointments real (espejo de la hoja conectada, ver
 * src/lib/agenda/queries.ts), nunca datos de ejemplo. Sincronización con Google Sheets intacta:
 * misma hoja, mismo "Sincronizar ahora", mismo panel "Conectar hoja de agendas". Un 'agent'
 * (setter) recibe del server solo sus propias citas; la edición de estado/notas está disponible
 * para los 3 roles (ver agenda/queries.ts). */
export function AgendaShell() {
  useAutoStartTour("agenda-intro");

  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [weekAnchor, setWeekAnchor] = useState(() => startOfDay(new Date()));
  const [showPending, setShowPending] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [citas, setCitas] = useState<AgendaAppointment[] | null>(null);
  const [setterFilter, setSetterFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoCita | "">("");
  const [search, setSearch] = useState("");

  const [view, setView] = useState<"citas" | "leads">("citas");
  const [sheetStatus, setSheetStatus] = useState<AgendaSheetStatus | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelKey, setPanelKey] = useState(0);
  const openPanel = useCallback(() => {
    setPanelKey((k) => k + 1);
    setPanelOpen(true);
  }, []);
  const [syncing, setSyncing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [recordSheetOpen, setRecordSheetOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AgendaRecordFormRecord | null>(null);
  function openCreate() {
    setEditingRecord(null);
    setRecordSheetOpen(true);
  }
  function openEdit(cita: AgendaAppointment) {
    setEditingRecord(citaToRecord(cita));
    setRecordSheetOpen(true);
  }

  const loadSheetStatus = useCallback(() => {
    getAgendaSheetStatusAction()
      .then(setSheetStatus)
      .catch(() => setSheetStatus({ account: { connected: false, email: null }, connection: null }));
  }, []);

  useEffect(() => {
    loadSheetStatus();
    // Vuelta del OAuth de Google ("Conectar cuenta de Google" en el panel): reabre el panel.
    const params = new URLSearchParams(window.location.search);
    if (params.has("sheet_export_connected") || params.has("sheet_export_error")) {
      if (params.has("sheet_export_error")) toast.error("No se pudo conectar la cuenta de Google.");
      window.history.replaceState(null, "", window.location.pathname);
      Promise.resolve().then(openPanel);
    }
  }, [loadSheetStatus, openPanel]);

  const afterSync = useCallback(() => {
    loadSheetStatus();
    setRefreshKey((k) => k + 1);
  }, [loadSheetStatus]);

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const result = await syncAgendaSheetNowAction();
      if (!result.ok) toast.error("No se pudo sincronizar", result.message);
      else {
        const extra = (result.deletedInSheet ? `, ${result.deletedInSheet} eliminadas en la hoja` : "") + (result.errors ? ` · ${result.errors} filas con problemas` : "");
        toast.success("Agenda sincronizada", `${result.created} citas nuevas, ${result.updated} actualizadas, ${result.newLeads} leads nuevos${extra}.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo sincronizar.");
    } finally {
      setSyncing(false);
      afterSync();
    }
  }

  function handleEstadoChanged(id: string, estado: EstadoCita) {
    setCitas((prev) => (prev ? prev.map((c) => (c.id === id ? { ...c, estadoCita: estado } : c)) : prev));
  }

  useEffect(() => {
    let cancelled = false;
    const start = addDays(startOfDay(new Date()), -LISTA_DAYS_BACK);
    const end = addDays(startOfDay(new Date()), LISTA_DAYS_FORWARD);
    getAgendaAppointmentsAction({ start: start.toISOString(), end: end.toISOString() }).then((data) => {
      if (!cancelled) setCitas(data);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const setterOptions = useMemo(() => [...new Set((citas ?? []).map((c) => c.setterName).filter((n): n is string => !!n))].sort(), [citas]);

  const filteredCitas = useMemo(() => {
    let rows = citas ?? [];
    if (setterFilter) rows = rows.filter((c) => c.setterName === setterFilter);
    if (estadoFilter) rows = rows.filter((c) => c.estadoCita === estadoFilter);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((c) => (c.contactName ?? "").toLowerCase().includes(q) || (c.contactPhone ?? "").includes(q));
    return rows;
  }, [citas, setterFilter, estadoFilter, search]);

  const dayCitas = useMemo(
    () => filteredCitas.filter((c) => !c.deletedInSheet && isSameDay(new Date(c.startTime), selectedDay)).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [filteredCitas, selectedDay],
  );
  const pendingCitas = useMemo(() => {
    const today = startOfDay(new Date());
    return filteredCitas
      .filter((c) => !c.deletedInSheet && new Date(c.startTime) < today && (c.estadoCita === "agendada" || c.estadoCita === "propuesta"))
      .sort((a, b) => b.startTime.localeCompare(a.startTime));
  }, [filteredCitas]);
  const listToShow = showPending ? pendingCitas : dayCitas;

  const sheetUrl = sheetStatus?.connection ? `https://docs.google.com/spreadsheets/d/${sheetStatus.connection.spreadsheetId}/edit${sheetStatus.connection.sheetGid ? `#gid=${sheetStatus.connection.sheetGid}` : ""}` : null;

  return (
    <div className="flex flex-col gap-4">
      <AgendaSheetConnectPanel key={panelKey} open={panelOpen} onClose={() => setPanelOpen(false)} status={sheetStatus} onSynced={afterSync} />

      {/* Encabezado compacto — título + estado de sync a la izquierda, selector Citas/Leads +
          Nueva cita a la derecha, todo en una línea (desktop). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div data-tour="agenda.sheet-status">
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-semibold text-foreground">Agenda</h1>
            <ModuleHelp
              compact
              description="La Agenda te permite organizar tus próximas citas y seguimientos — llegan solas desde tu hoja conectada, o las cargás a mano con Nueva cita."
              tourKey="agenda-intro"
            />
          </div>
          {sheetStatus === null ? (
            <div className="mt-1 h-4 w-48 animate-pulse rounded bg-surface-2" />
          ) : sheetStatus.connection ? (
            <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-neutral-500">
              {sheetStatus.connection.lastSyncStatus === "error" ? (
                <AlertTriangle className="size-3.5 text-error-strong" aria-hidden="true" />
              ) : (
                <span className="size-1.5 rounded-full bg-success-strong" aria-hidden="true" />
              )}
              <span>{sheetStatus.connection.lastSyncStatus === "error" ? "Error al sincronizar" : "Sincronizado con Google Sheets"}</span>
              <span className="text-neutral-300">·</span>
              <span>{sheetStatus.connection.lastSyncedAt ? `hace ${formatMinutesAgo(sheetStatus.connection.lastSyncedAt)}` : "todavía no"}</span>
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={syncing}
                title="Sincronizar ahora"
                aria-label="Sincronizar ahora"
                className="ml-0.5 flex size-6 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
              >
                {syncing ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
              </button>
              {sheetUrl && (
                <a href={sheetUrl} target="_blank" rel="noreferrer" title="Abrir hoja" aria-label="Abrir hoja" className="flex size-6 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground">
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              )}
              <button type="button" onClick={openPanel} title="Configurar" aria-label="Configurar" className="flex size-6 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground">
                <Settings2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={openPanel} className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-medium text-accent-600 hover:text-accent-700">
              <FileSpreadsheet className="size-3.5" aria-hidden="true" />
              Conectá tu hoja de agendas para empezar
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-surface-2 p-1" role="tablist" aria-label="Vista de la agenda">
            {(["citas", "leads"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`rounded-md px-4 py-1.5 text-[13px] font-medium ${view === v ? "bg-surface-1 text-foreground shadow-[var(--elevation-xs)]" : "text-neutral-500 hover:text-foreground"}`}
              >
                {v === "citas" ? "Citas" : "Leads"}
              </button>
            ))}
          </div>
          {view === "citas" && (
            <button
              type="button"
              data-tour="agenda.new-cita-button"
              onClick={openCreate}
              className="flex h-11 items-center gap-1.5 rounded-md bg-accent-500 px-4 text-[13px] font-medium text-white hover:bg-accent-600"
            >
              <Plus size={15} aria-hidden="true" />
              Nueva cita
            </button>
          )}
        </div>
      </div>

      {view === "leads" ? (
        <AgendaLeadsSection refreshKey={refreshKey} />
      ) : (
        <>
          <div data-tour="agenda.range-switcher">
            <AgendaWeekStrip
              weekAnchor={weekAnchor}
              selectedDay={selectedDay}
              onSelectDay={(d) => {
                setSelectedDay(d);
                setShowPending(false);
                setExpandedId(null);
              }}
              onPrevWeek={() => setWeekAnchor((d) => addDays(d, -7))}
              onNextWeek={() => setWeekAnchor((d) => addDays(d, 7))}
              citas={filteredCitas}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,260px)_1fr]">
            <AgendaStatsRow
              citas={filteredCitas}
              selectedDay={selectedDay}
              pendingActive={showPending}
              onTogglePending={() => {
                setShowPending((v) => !v);
                setExpandedId(null);
              }}
            />

            <div className="flex flex-wrap items-center gap-2 sm:justify-end" data-tour="agenda.filters-button">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o teléfono"
                aria-label="Buscar por nombre o teléfono"
                className="w-full max-w-[220px] rounded-md border border-border-strong bg-surface-1 px-3 py-1.5 text-[13px] text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
              <select
                value={setterFilter}
                onChange={(e) => setSetterFilter(e.target.value)}
                aria-label="Filtrar por setter"
                className="rounded-md border border-border-strong bg-surface-1 px-2.5 py-1.5 text-[13px] text-foreground"
              >
                <option value="">Setter: Todos</option>
                {setterOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value as EstadoCita | "")}
                aria-label="Filtrar por estado"
                className="rounded-md border border-border-strong bg-surface-1 px-2.5 py-1.5 text-[13px] text-foreground"
              >
                <option value="">Estado: Todos</option>
                {ESTADO_CITA_OPTIONS.map((e) => (
                  <option key={e} value={e}>
                    {ESTADO_CITA_META[e].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-baseline justify-between px-0.5">
            <h2 className="text-[15px] font-semibold text-foreground">
              {showPending ? "Sin resultado" : isSameDay(selectedDay, startOfDay(new Date())) ? "Hoy" : selectedDay.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
            </h2>
            <span className="text-[12.5px] text-neutral-500">
              {listToShow.length} {listToShow.length === 1 ? "cita" : "citas"}
            </span>
          </div>

          {citas === null ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Cargando agenda…
            </div>
          ) : listToShow.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={showPending ? "Todo al día" : "No hay citas"}
              description={showPending ? "No quedan citas sin resultado." : "No hay citas para este día — tocá Nueva cita para cargar una a mano."}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {listToShow.map((c) => (
                <AgendaCitaAccordionCard
                  key={c.id}
                  cita={c}
                  expanded={expandedId === c.id}
                  onToggle={() => setExpandedId((id) => (id === c.id ? null : c.id))}
                  onEstadoChanged={handleEstadoChanged}
                  onEditar={() => openEdit(c)}
                />
              ))}
            </div>
          )}

          <Sheet open={recordSheetOpen} onClose={() => setRecordSheetOpen(false)} title={editingRecord ? (editingRecord.fromSheet ? "Editar cita" : "Editar lead") : "Nueva cita"}>
            <AgendaRecordForm
              key={editingRecord?.appointmentId ?? "new"}
              record={editingRecord}
              defaultDate={selectedDay}
              onClose={() => setRecordSheetOpen(false)}
              onSaved={() => setRefreshKey((k) => k + 1)}
            />
          </Sheet>
        </>
      )}
    </div>
  );
}
